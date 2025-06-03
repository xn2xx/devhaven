import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { getDb } from '../db-service'
import { app } from 'electron'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface MigrationInfo {
  version: string
  description: string
  filePath: string
  sql: string
}

interface MigrationResult {
  applied: number
  current: string
}

interface DirectoryPaths {
  migrations: string
  sql: string
  mcp: string
  target: string
}

class MigrationService {
  private readonly paths: DirectoryPaths

  constructor() {
    const appPath = app.getAppPath()
    this.paths = {
      migrations: path.join(appPath, 'src', 'main', 'migrations'),
      sql: path.join(appPath, 'src', 'main', 'migrations', 'sql'),
      mcp: path.join(appPath, 'src', 'main', 'migrations', 'mcp'),
      target: path.join(os.homedir(), '.devhaven', 'prompt')
    }

    console.log('Migration paths initialized:', this.paths)
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath)
    } catch {
      await fs.mkdir(dirPath, { recursive: true })
      console.log(`Created directory: ${dirPath}`)
    }
  }

  /**
   * 检查目录是否存在
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  /**
   * 复制单个文件
   */
  private async copyFile(sourcePath: string, targetPath: string): Promise<void> {
    try {
      // 检查目标文件是否存在，如果存在则删除
      try {
        await fs.access(targetPath)
        await fs.unlink(targetPath)
        console.log(`Removed existing file: ${targetPath}`)
      } catch {
        // 文件不存在，无需删除
      }

      await fs.copyFile(sourcePath, targetPath)
      console.log(`Copied file: ${sourcePath} -> ${targetPath}`)
    } catch (error) {
      console.error(`Failed to copy file ${sourcePath} to ${targetPath}:`, error)
      throw error
    }
  }

  /**
   * 解压node_modules.zip文件
   */
  private async extractNodeModules(targetPath: string): Promise<void> {
    try {
      const unzipCmd = 'unzip -o node_modules.zip'
      const { stdout, stderr } = await execAsync(unzipCmd, { cwd: targetPath })

      if (stdout) {
        console.log('Extract output:', stdout)
      }
      if (stderr) {
        console.warn('Extract warnings:', stderr)
      }
    } catch (error) {
      console.error('Failed to extract node_modules.zip:', error)
      throw error
    }
  }

  /**
   * 迁移mcp的文件
   */
  public async migrateMcp(): Promise<void> {
    try {
      console.log('Starting MCP file migration...')

      // 检查MCP目录是否存在
      if (!(await this.directoryExists(this.paths.mcp))) {
        console.log(`MCP directory does not exist: ${this.paths.mcp}`)
        return
      }

      // 确保目标目录存在
      await this.ensureDirectoryExists(this.paths.target)

      // 读取MCP目录中的文件
      const files = await fs.readdir(this.paths.mcp)
      console.log('MCP files found:', files)

      // 并行复制文件
      const copyPromises = files.map(async (file) => {
        const sourcePath = path.join(this.paths.mcp, file)
        const targetPath = path.join(this.paths.target, file)
        return this.copyFile(sourcePath, targetPath)
      })

      await Promise.all(copyPromises)

      // 解压node_modules.zip（如果存在）
      const nodeModulesZip = path.join(this.paths.target, 'node_modules.zip')
      try {
        await fs.access(nodeModulesZip)
        await this.extractNodeModules(this.paths.target)
      } catch {
        console.log('node_modules.zip not found, skipping extraction')
      }

      console.log('MCP file migration completed successfully')
    } catch (error) {
      console.error('MCP file migration failed:', error)
      throw error
    }
  }

  /**
   * 确保迁移表存在
   */
  private ensureMigrationTableExists(): void {
    try {
      const db = getDb()
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations
        (
          version     TEXT NOT NULL PRIMARY KEY,
          description TEXT,
          applied_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)
      console.log('Migration table ensured')
    } catch (error) {
      console.error('Failed to create migration table:', error)
      throw error
    }
  }

  /**
   * 获取已应用的迁移版本
   */
  private getAppliedMigrations(): string[] {
    try {
      const db = getDb()
      const stmt = db.prepare('SELECT version FROM schema_migrations ORDER BY version')
      const result = stmt.all() as { version: string }[]
      return result.map((row) => row.version)
    } catch (error) {
      console.error('Failed to get applied migrations:', error)
      throw error
    }
  }

  /**
   * 解析迁移文件名
   */
  private parseMigrationFileName(fileName: string): { version: string; description: string } | null {
    const match = fileName.match(/^V(\d+)__(.*)\.sql$/)
    if (!match) {
      return null
    }

    return {
      version: match[1].padStart(3, '0'),
      description: match[2].replace(/_/g, ' ')
    }
  }

  /**
   * 读取迁移文件内容
   */
  private async readMigrationFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch (error) {
      console.error(`Failed to read migration file ${filePath}:`, error)
      throw error
    }
  }

  /**
   * 获取可用的迁移脚本
   */
  private async getAvailableMigrations(): Promise<MigrationInfo[]> {
    try {
      // 检查SQL目录是否存在
      if (!(await this.directoryExists(this.paths.sql))) {
        console.log(`SQL directory does not exist: ${this.paths.sql}`)
        return []
      }

      const files = await fs.readdir(this.paths.sql)
      const migrationFiles = files
        .filter((file) => file.match(/^V\d+__.*\.sql$/))
        .sort()

      const migrations: MigrationInfo[] = []

      for (const file of migrationFiles) {
        const parsed = this.parseMigrationFileName(file)
        if (!parsed) {
          console.warn(`Invalid migration file name format: ${file}`)
          continue
        }

        const filePath = path.join(this.paths.sql, file)
        const sql = await this.readMigrationFile(filePath)

        migrations.push({
          version: parsed.version,
          description: parsed.description,
          filePath,
          sql
        })
      }

      return migrations
    } catch (error) {
      console.error('Failed to get available migrations:', error)
      throw error
    }
  }

  /**
   * 执行单个迁移
   */
  private executeSingleMigration(migration: MigrationInfo): void {
    const db = getDb()

    try {
      console.log(`Applying migration: V${migration.version}__${migration.description}`)

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

      console.log(`Migration successful: V${migration.version}__${migration.description}`)
    } catch (error) {
      // 回滚事务
      try {
        db.exec('ROLLBACK')
      } catch (rollbackError) {
        console.error('Failed to rollback transaction:', rollbackError)
      }

      console.error(`Migration failed: V${migration.version}__${migration.description}`, error)
      throw error
    }
  }

  /**
   * 执行迁移
   */
  public async migrate(): Promise<MigrationResult> {
    try {
      console.log('Starting database migration process...')

      // 先执行MCP迁移
      await this.migrateMcp()

      // 确保迁移表存在
      this.ensureMigrationTableExists()

      const appliedVersions = this.getAppliedMigrations()
      const availableMigrations = await this.getAvailableMigrations()

      console.log(`Applied migrations: ${appliedVersions.length}`)
      console.log(`Available migrations: ${availableMigrations.length}`)

      let appliedCount = 0
      let currentVersion = appliedVersions.length > 0
        ? appliedVersions[appliedVersions.length - 1]
        : '000'

      // 筛选出未应用的迁移
      const pendingMigrations = availableMigrations
        .filter((migration) => !appliedVersions.includes(migration.version))
        .sort((a, b) => a.version.localeCompare(b.version))

      console.log(`Pending migrations: ${pendingMigrations.length}`)

      // 执行待应用的迁移
      for (const migration of pendingMigrations) {
        this.executeSingleMigration(migration)
        appliedCount++
        currentVersion = migration.version
      }

      const result: MigrationResult = { applied: appliedCount, current: currentVersion }
      console.log('Migration process completed:', result)

      return result
    } catch (error) {
      console.error('Migration process failed:', error)
      throw error
    }
  }
}

export default MigrationService
