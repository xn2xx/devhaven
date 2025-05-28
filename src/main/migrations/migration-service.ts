import fs from 'fs'
import path from 'path'
import { getDb } from '../db-service'
import { app } from 'electron'
import os from 'os'
import { exec } from 'child_process'

interface MigrationInfo {
  version: string
  description: string
  filePath: string
  sql: string
}

class MigrationService {
  private readonly migrationsDir: string
  private readonly sqlDir: string
  private readonly mcpDir: string

  constructor() {
    // 使用app.getAppPath()获取应用程序路径
    const appPath = app.getAppPath()
    this.migrationsDir = path.join(appPath, 'src', 'main', 'migrations')
    this.sqlDir = path.join(this.migrationsDir, 'sql')
    this.mcpDir = path.join(this.migrationsDir, 'mcp')
    console.log('迁移目录:', this.migrationsDir)
    console.log('SQL脚本目录:', this.sqlDir)
    console.log('MCP目录:', this.mcpDir)
  }

  /**
   * 迁移mcp的文件
   */
  public migrateMcp(): void {
    try {
      // 确保目录存在
      if (!fs.existsSync(this.mcpDir)) {
        console.log(`MCP目录不存在: ${this.mcpDir}`)
        return
      }
      console.log('开始迁移mcp文件')
      const files = fs.readdirSync(this.mcpDir)
      console.log('读取mcp配置文件成功，读取到文件列表: ', files)
      const targetPath = path.join(os.homedir(), '.devhaven', 'prompt')
      // 确保目标目录存在
      if (!fs.existsSync(targetPath)) {
        console.log(`创建目标目录: ${targetPath}`)
        fs.mkdirSync(targetPath, { recursive: true })
      }
      for (const file of files) {
        // 将文件复制到目标目录
        const targetFilePath = path.join(targetPath, file)
        if (fs.existsSync(targetFilePath)) {
          console.log(`文件已存在: ${targetFilePath}`)
          // 删除文件
          fs.unlinkSync(targetFilePath)
        }
        console.log(`复制文件: ${path.join(this.mcpDir, file)},${targetFilePath}`)
        fs.copyFileSync(path.join(this.mcpDir, file), targetFilePath)
        console.log(`复制文件: ${targetFilePath}`)
      }
      // 解压node_modules.zip
      const unzipCmd = 'unzip -o node_modules.zip'
      exec(unzipCmd, { cwd: targetPath }, (error, stdout, stderr) => {
        if (error) {
          console.error('解压失败:', error)
          return
        }
        console.log('解压输出:', stdout)
        if (stderr) {
          console.error('解压错误输出:', stderr)
        }
      })

      // 可选：监听进程事件
    } catch (error) {
      console.error('迁移MCP文件失败:', error)
    }
  }

  /**
   * 确保迁移表存在
   */
  private ensureMigrationTableExists(): void {
    const db = getDb()
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations
      (
        version     TEXT NOT NULL PRIMARY KEY,
        description TEXT,
        applied_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  /**
   * 获取已应用的迁移版本
   */
  private getAppliedMigrations(): string[] {
    const db = getDb()
    const stmt = db.prepare('SELECT version FROM schema_migrations ORDER BY version')
    const result = stmt.all() as { version: string }[]
    return result.map((row) => row.version)
  }

  /**
   * 获取可用的迁移脚本
   */
  private getAvailableMigrations(): MigrationInfo[] {
    try {
      // 确保目录存在
      if (!fs.existsSync(this.sqlDir)) {
        console.log(`SQL目录不存在: ${this.sqlDir}`)
        return []
      }

      const files = fs
        .readdirSync(this.sqlDir)
        .filter((file) => file.match(/^V\d+__.*\.sql$/))
        .sort()

      return files.map((file) => {
        const match = file.match(/^V(\d+)__(.*)\.sql$/)
        if (!match) {
          throw new Error(`迁移文件名格式不正确: ${file}`)
        }

        const version = match[1].padStart(3, '0')
        const description = match[2].replace(/_/g, ' ')
        const filePath = path.join(this.sqlDir, file)
        const sql = fs.readFileSync(filePath, 'utf-8')

        return {
          version,
          description,
          filePath,
          sql
        }
      })
    } catch (error) {
      console.error('获取可用迁移脚本失败:', error)
      return []
    }
  }

  /**
   * 执行迁移
   */
  public async migrate(): Promise<{ applied: number; current: string }> {
    try {
      this.migrateMcp()
      this.ensureMigrationTableExists()

      const db = getDb()
      const appliedVersions = this.getAppliedMigrations()
      const availableMigrations = this.getAvailableMigrations()

      console.log(`已应用迁移: ${appliedVersions.length}`)
      console.log(`可用迁移: ${availableMigrations.length}`)

      let appliedCount = 0
      let currentVersion =
        appliedVersions.length > 0 ? appliedVersions[appliedVersions.length - 1] : '000'

      // 筛选出未应用的迁移
      const pendingMigrations = availableMigrations.filter(
        (migration) => !appliedVersions.includes(migration.version)
      )

      console.log(`待应用迁移: ${pendingMigrations.length}`)

      // 按版本号排序
      pendingMigrations.sort((a, b) => a.version.localeCompare(b.version))

      for (const migration of pendingMigrations) {
        console.log(`应用迁移: V${migration.version}__${migration.description}`)

        try {
          // 开始事务
          db.exec('BEGIN TRANSACTION')

          // 执行SQL脚本
          db.exec(migration.sql)

          // 记录已应用的迁移
          const stmt = db.prepare(
            'INSERT INTO schema_migrations (version, description) VALUES (?, ?)'
          )
          stmt.run(migration.version, migration.description)

          // 提交事务
          db.exec('COMMIT')

          appliedCount++
          currentVersion = migration.version
          console.log(`迁移成功: V${migration.version}__${migration.description}`)
        } catch (error) {
          // 回滚事务
          db.exec('ROLLBACK')
          console.error(`迁移失败: V${migration.version}__${migration.description}`, error)
        }
      }

      return { applied: appliedCount, current: currentVersion }
    } catch (error) {
      console.error('执行迁移失败:', error)
      throw error
    }
  }
}

export default MigrationService
