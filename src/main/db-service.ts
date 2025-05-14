import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import MigrationService from './migrations/migration-service'

let db: Database.Database | null = null

// 初始化数据库
const initDatabase = async (customDbPath: string | null = null) => {
  try {
    // 获取数据库路径
    const dbPath = customDbPath || path.join(app.getPath('userData'), 'devhaven.db')

    // 确保目录存在
    const dbDir = path.dirname(dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }

    // 初始化数据库连接
    db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
    })

    // 启用外键支持
    db.pragma('foreign_keys = ON')

    // 应用数据库迁移
    const migrationService = new MigrationService()
    const migrationResult = await migrationService.migrate()
    console.log(
      `数据库迁移完成，应用了 ${migrationResult.applied} 个迁移，当前版本: ${migrationResult.current}`
    )

    console.log('Database connection established successfully.')
    return db
  } catch (error) {
    console.error('Unable to connect to the database:', error)
    throw error
  }
}

// 获取数据库实例
const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

// 数据库操作函数
const dbService = {
  tags: {
    create: (tag: DevHaven.Tag): DevHaven.Tag => {
      const stmt = getDb().prepare('INSERT INTO tags (name, color, created_at) VALUES (?,?,?)')
      const result = stmt.run(tag.name, tag.color, new Date().toISOString())
      return dbService.tags.getById(result.lastInsertRowid as number)
    },
    getById: (id: number): DevHaven.Tag => {
      const stmt = getDb().prepare('SELECT * FROM tags WHERE id =?')
      return stmt.get(id) as DevHaven.Tag
    },

    getAll(): DevHaven.Tag[] {
      const stmt = getDb().prepare('SELECT * FROM tags')
      return stmt.all() as DevHaven.Tag[]
    }
  },
  // 文件夹相关操作
  folders: {
    // 获取所有文件夹
    getAll: () => {
      const stmt = getDb().prepare('SELECT * FROM folders ORDER BY parent_id, order_index, name ')
      return stmt.all()
    },

    // 根据ID获取文件夹
    getById: (id: number) => {
      const stmt = getDb().prepare('SELECT * FROM folders WHERE id = ?')
      return stmt.get(id)
    },

    // 获取子文件夹
    getChildren: (parentId: number) => {
      const stmt = getDb().prepare(
        'SELECT * FROM folders WHERE parent_id = ? ORDER BY order_index, name '
      )
      return stmt.all(parentId)
    },

    // 获取根文件夹（没有父文件夹的文件夹）
    getRoots: () => {
      const stmt = getDb().prepare(
        'SELECT * FROM folders WHERE parent_id IS NULL ORDER BY order_index, name '
      )
      return stmt.all()
    },

    // 创建文件夹
    create: (folder: DevHaven.Folder) => {
      const now = new Date().toISOString()

      // 计算新文件夹的排序索引
      let orderIndex: number
      if (folder.parent_id) {
        // 获取同级文件夹中最大的order_index
        const stmt = getDb().prepare(
          'SELECT MAX(order_index) as max_order FROM folders WHERE parent_id = ?'
        )
        const result: any = stmt.get(folder.parent_id)
        orderIndex = (result.max_order || 0) + 1
      } else {
        // 获取根文件夹中最大的order_index
        const stmt = getDb().prepare(
          'SELECT MAX(order_index) as max_order FROM folders WHERE parent_id IS NULL'
        )
        const result: any = stmt.get()
        orderIndex = (result.max_order || 0) + 1
      }

      const stmt = getDb().prepare(`
        INSERT INTO folders (name, parent_id, icon, description, order_index, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      const result = stmt.run(
        folder.name,
        folder.parent_id || null,
        folder.icon || 'folder',
        folder.description || null,
        orderIndex,
        now,
        now
      )

      if (result.changes > 0) {
        return dbService.folders.getById(result.lastInsertRowid as number)
      }
      return null
    },

    // 更新文件夹
    update: (id: number, data: DevHaven.Folder) => {
      const folder: DevHaven.Folder = dbService.folders.getById(id) as DevHaven.Folder
      if (!folder) {
        throw new Error('Folder not found')
      }

      // 防止创建循环引用
      if (data.parent_id && data.parent_id == id) {
        throw new Error('A folder cannot be its own parent')
      }

      // 检查是否改变了父文件夹
      const parentChanged =
        data.parent_id !== undefined &&
        (data.parent_id !== folder.parent_id ||
          (data.parent_id === null && folder.parent_id !== null))

      console.log(
        '更新文件夹:',
        id,
        '原parent_id:',
        folder.parent_id,
        '新parent_id:',
        data.parent_id,
        '父级已改变:',
        parentChanged
      )

      // 处理order_index，优先使用传入值
      let orderIndex = folder.order_index

      // 如果明确传入了order_index，则直接使用
      if (data.order_index !== undefined) {
        orderIndex = data.order_index
        console.log('使用传入的order_index:', orderIndex)
      }
      // 如果改变了父文件夹但没有传入order_index，则重新计算
      else if (parentChanged) {
        if (data.parent_id) {
          // 获取新父文件夹下最大的order_index
          const stmt = getDb().prepare(
            'SELECT MAX(order_index) as max_order FROM folders WHERE parent_id = ?'
          )
          const result: any = stmt.get(data.parent_id)
          orderIndex = (result.max_order || 0) + 1
          console.log('计算了新的order_index:', orderIndex, '(在新父文件夹下)')
        } else {
          // 获取根文件夹中最大的order_index
          const stmt = getDb().prepare(
            'SELECT MAX(order_index) as max_order FROM folders WHERE parent_id IS NULL'
          )
          const result: any = stmt.get()
          orderIndex = (result.max_order || 0) + 1
          console.log('文件夹将变为根级别, 新排序值:', orderIndex)
        }
      }

      const now = new Date().toISOString()
      const stmt = getDb().prepare(`
        UPDATE folders
        SET name        = ?,
            parent_id   = ?,
            icon        = ?,
            description = ?,
            order_index = ?,
            updated_at  = ?
        WHERE id = ?
      `)

      // 明确处理parent_id，确保null值正确传递
      const parentId = data.parent_id !== undefined ? data.parent_id : folder.parent_id

      console.log('执行更新:', {
        id,
        name: data.name || folder.name,
        parent_id: parentId,
        order_index: orderIndex
      })

      const result = stmt.run(
        data.name || folder.name,
        parentId, // 可以为null，表示根级文件夹
        data.icon || folder.icon,
        data.description !== undefined ? data.description : folder.description,
        orderIndex,
        now,
        id
      )

      console.log('数据库更新结果:', result)

      const updatedFolder = dbService.folders.getById(id)
      console.log('更新后的文件夹状态:', updatedFolder)

      return updatedFolder
    },

    // 删除文件夹
    delete: (id: number) => {
      const stmt = getDb().prepare('DELETE FROM folders WHERE id = ?')
      const result = stmt.run(id)
      return result.changes > 0
    }
  },

  // 项目相关操作
  projects: {
    // 获取所有项目或指定文件夹的项目
    getAll: (folderId: string | null = null): DevHaven.Project[] => {
      let stmt
      if (folderId) {
        // 查询当前文件夹以及所有子文件夹的项目
        stmt = getDb().prepare(`
          SELECT p.*
          FROM projects p
                 JOIN folders f ON p.folder_id = f.id
          WHERE f.parent_id = ?
             or f.id = ?
          ORDER BY p.name
        `)
        return stmt.all(folderId, folderId) as DevHaven.Project[]
      } else {
        stmt = getDb().prepare('SELECT * FROM projects ORDER BY name ')
        return stmt.all() as DevHaven.Project[]
      }
    },

    // 根据ID获取项目
    getById: (id: number) => {
      const stmt = getDb().prepare('SELECT * FROM projects WHERE id = ?')
      return stmt.get(id)
    },

    // 创建项目
    create: (project: DevHaven.Project): DevHaven.Project | null => {
      const now = new Date().toISOString()
      const stmt = getDb().prepare(`
        INSERT INTO projects (folder_id, name, description, path,
                              preferred_ide, icon, branch, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const result: any = stmt.run(
        project.folder_id,
        project.name,
        project.description || null,
        project.path,
        project.preferred_ide || '["vscode"]',
        project.icon || 'code',
        project.branch || null,
        now,
        now
      )

      if (result.changes > 0) {
        return dbService.projects.getById(result.lastInsertRowid as number) as DevHaven.Project
      }
      return null
    },
    getProjectTags: (projectId: number): DevHaven.Tag[] => {
      const stmt = getDb().prepare('SELECT t.* FROM tags t JOIN project_tags pt ON t.id = pt.tag_id WHERE pt.project_id = ?')
      return stmt.all(projectId) as DevHaven.Tag[]
    },

    // 更新项目
    update: (id: number, data: DevHaven.Project) => {
      const project: DevHaven.Project = dbService.projects.getById(id) as DevHaven.Project
      if (!project) {
        throw new Error('Project not found')
      }

      const now = new Date().toISOString()

      // 确保last_opened_at是字符串类型
      let lastOpenedAt = project.last_opened_at
      if (data.last_opened_at) {
        if (data.last_opened_at instanceof Date) {
          lastOpenedAt = data.last_opened_at.toISOString()
        } else {
          lastOpenedAt = data.last_opened_at
        }
      }

      const stmt = getDb().prepare(`
        UPDATE projects
        SET folder_id      = ?,
            name           = ?,
            description    = ?,
            path           = ?,
            preferred_ide  = ?,
            icon           = ?,
            branch         = ?,
            last_opened_at = ?,
            updated_at     = ?,
            is_favorite    = ?
        WHERE id = ?
      `)

      stmt.run(
        data.folder_id || project.folder_id,
        data.name || project.name,
        data.description !== undefined ? data.description : project.description,
        data.path || project.path,
        data.preferred_ide || project.preferred_ide,
        data.icon || project.icon,
        data.branch !== undefined ? data.branch : project.branch,
        lastOpenedAt,
        now,
        data.is_favorite !== undefined ? data.is_favorite : project.is_favorite,
        id
      )

      return dbService.projects.getById(id)
    },

    // 删除项目
    delete: (id: number) => {
      const stmt = getDb().prepare('DELETE FROM projects WHERE id = ?')
      const result = stmt.run(id)
      return result.changes > 0
    },

    // 搜索项目
    search: (query: string) => {
      const searchTerm = `%${query}%`
      const stmt = getDb().prepare(`
        SELECT p.*, f.name as folder_name
        FROM projects p
               LEFT JOIN folders f ON p.folder_id = f.id
        WHERE p.name LIKE ?
           OR p.description LIKE ?
        ORDER BY p.name
      `)

      return stmt.all(searchTerm, searchTerm)
    },
    getFavoriteProjects: () => {
      const stmt = getDb().prepare('SELECT * FROM projects WHERE is_favorite = 1 ORDER BY name ')
      return stmt.all()
    },
    getByPath: (path: string) => {
      const stmt = getDb().prepare('SELECT * FROM projects WHERE path = ? ORDER BY name limit 1')
      return stmt.get(path)
    },
    saveProjectTag: (projectId: number, tags: DevHaven.Tag[]) => {
      // 清空原有tag
      let stmt = getDb().prepare('DELETE FROM project_tags WHERE project_id = ?')
      stmt.run(projectId)
      // 保存项目标签到project_tags表中
      stmt = getDb().prepare(`
        INSERT INTO project_tags (project_id, tag_id)
        VALUES (?, ?)
      `)
      tags.forEach((tag: DevHaven.Tag) => {
        stmt.run(projectId, tag.id)
      })
    }
  },
  // IDE配置相关操作
  ideConfigs: {
    // 获取所有IDE配置
    getAll: () => {
      const stmt = getDb().prepare('SELECT * FROM ide_configs ORDER BY display_name ')
      return stmt.all()
    },

    // 根据ID获取IDE配置
    getById: (id: number) => {
      const stmt = getDb().prepare('SELECT * FROM ide_configs WHERE id = ?')
      return stmt.get(id)
    },

    // 根据名称获取IDE配置
    getByName: (name: string) => {
      const stmt = getDb().prepare('SELECT * FROM ide_configs WHERE name = ?')
      return stmt.get(name)
    },

    // 创建IDE配置
    create: (ideConfig: DevHaven.IdeConfig) => {
      const now = new Date().toISOString()

      const stmt = getDb().prepare(`
        INSERT INTO ide_configs (name, display_name, command, args,
                                 icon, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      const result = stmt.run(
        ideConfig.name,
        ideConfig.display_name,
        ideConfig.command,
        ideConfig.args || null,
        now,
        now
      )

      if (result.changes > 0) {
        return dbService.ideConfigs.getById(result.lastInsertRowid as number)
      }

      return null
    },

    // 更新IDE配置
    update: (id: number, data: DevHaven.IdeConfig) => {
      const ideConfig: DevHaven.IdeConfig = dbService.ideConfigs.getById(id) as DevHaven.IdeConfig
      if (!ideConfig) {
        throw new Error('IDE config not found')
      }

      const now = new Date().toISOString()

      const stmt = getDb().prepare(`
        UPDATE ide_configs
        SET display_name = ?,
            command      = ?,
            args         = ?,
            icon         = ?,
            updated_at   = ?
        WHERE id = ?
      `)

      stmt.run(
        data.display_name || ideConfig.display_name,
        data.command || ideConfig.command,
        data.args !== undefined ? data.args : ideConfig.args,
        now,
        id
      )

      return dbService.ideConfigs.getById(id)
    },

    // 删除IDE配置
    delete: (id: number) => {
      const stmt = getDb().prepare('DELETE FROM ide_configs WHERE id = ?')
      const result = stmt.run(id)
      return result.changes > 0
    }
  },
  // github仓库相关操作
  githubRepositories: {
    // 获取所有github仓库
    getAll: (): GitHub.Repository[] => {
      const stmt = getDb().prepare('SELECT * FROM github_repositories ORDER BY name ')
      const result = stmt.all() as unknown as GitHub.Repository[]
      // 将topics和owner从json字符串转换为对象
      result.forEach((repo: GitHub.Repository) => {
        repo.topics = JSON.parse(repo.topics as unknown as string) as string[]
        repo.owner = JSON.parse(repo.owner as unknown as string)
      })
      return result
    },
    clear: () => {
      const stmt = getDb().prepare('DELETE FROM github_repositories where true')
      const result = stmt.run()
      return result.changes > 0
    },
    // 同步仓库
    sync: (repositories: GitHub.Repository[]) => {
      const db = getDb()
      const BATCH_SIZE = 500 // SQLite 参数限制是 999，我们使用 500 作为安全值

      try {
        // 开始事务
        db.exec('BEGIN TRANSACTION')

        // 1. 获取现有记录的ID列表
        const rows = db.prepare('SELECT id FROM github_repositories').all() as Array<{ id: number }>
        const existingIds = rows.map((row) => row.id)

        // 2. 分类处理：需要更新的和需要插入的
        const toUpdate = repositories.filter((repo) => existingIds.includes(repo.id))
        const toInsert = repositories.filter((repo) => !existingIds.includes(repo.id))

        // 3. 分批删除不再存在的记录
        if (repositories.length > 0) {
          // 将repositories分成多个批次
          for (let i = 0; i < repositories.length; i += BATCH_SIZE) {
            const batch = repositories.slice(i, i + BATCH_SIZE)
            const placeholders = batch.map(() => '?').join(',')
            const deleteStmt = db.prepare(`DELETE
                                           FROM github_repositories
                                           WHERE id NOT IN (${placeholders})`)
            deleteStmt.run(batch.map((repo) => repo.id))
          }
        }

        // 4. 更新现有记录
        const updateStmt = db.prepare(`
          UPDATE github_repositories
          SET name             = ?,
              full_name        = ?,
              html_url         = ?,
              description      = ?,
              stargazers_count = ?,
              forks_count      = ?,
              language         = ?,
              topics           = ?,
              owner            = ?
          WHERE id = ?
        `)

        // 分批处理更新
        for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
          const batch = toUpdate.slice(i, i + BATCH_SIZE)
          for (const repo of batch) {
            updateStmt.run(
              repo.name,
              repo.full_name,
              repo.html_url,
              repo.description,
              repo.stargazers_count,
              repo.forks_count,
              repo.language,
              JSON.stringify(repo.topics),
              JSON.stringify(repo.owner),
              repo.id
            )
          }
        }

        // 5. 插入新记录
        const insertStmt = db.prepare(`
          INSERT INTO github_repositories (id, name, full_name, html_url, description,
                                           stargazers_count, forks_count, language, topics, owner)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        // 分批处理插入
        for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
          const batch = toInsert.slice(i, i + BATCH_SIZE)
          for (const repo of batch) {
            insertStmt.run(
              repo.id,
              repo.name,
              repo.full_name,
              repo.html_url,
              repo.description,
              repo.stargazers_count,
              repo.forks_count,
              repo.language,
              JSON.stringify(repo.topics),
              JSON.stringify(repo.owner)
            )
          }
        }

        // 提交事务
        db.exec('COMMIT')

        return {
          updated: toUpdate.length,
          inserted: toInsert.length,
          deleted: existingIds.length - toUpdate.length,
          hasUpdated:
            toUpdate.length > 0 || toInsert.length > 0 || existingIds.length - toUpdate.length > 0
        }
      } catch (error) {
        // 发生错误时回滚事务
        db.exec('ROLLBACK')
        console.error('同步GitHub仓库失败:', error)
        throw error
      }
    }
  }
}

export { initDatabase, getDb, dbService }
