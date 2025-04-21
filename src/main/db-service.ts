import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

let db = null

// 初始化数据库
const initDatabase = async (customDbPath = null) => {
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
      verbose: process.env.NODE_ENV === 'development' ? console.log : null
    })

    // 启用外键支持
    db.pragma('foreign_keys = ON')

    // 创建表
    createTables()

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

// 创建表结构
const createTables = () => {
  // 创建文件夹表
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders
    (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      parent_id   INTEGER,
      icon        TEXT      DEFAULT 'folder',
      description TEXT,
      order_index INTEGER   DEFAULT 0,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE CASCADE
    )
  `)

  // 创建项目表
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects
    (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id      INTEGER NOT NULL,
      name           TEXT    NOT NULL,
      description    TEXT,
      path           TEXT    NOT NULL,
      preferred_ide  TEXT      DEFAULT '["vscode"]',
      icon           TEXT      DEFAULT 'code',
      is_favorite    INTEGER   DEFAULT 0,
      branch         TEXT,
      source_type    TEXT      DEFAULT 'local',
      github_url     TEXT,
      is_cloned      INTEGER   DEFAULT 1,
      last_opened_at TIMESTAMP,
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE
    )
  `)

  // 创建标签表
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags
    (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      color      TEXT      DEFAULT 'primary',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建项目标签关联表
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_tags
    (
      project_id INTEGER NOT NULL,
      tag_id     INTEGER NOT NULL,
      PRIMARY KEY (project_id, tag_id),
      FOREIGN KEY (project_id) REFERENCES projects
        (id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
    )
  `)

  // 创建文档表
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents
    (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      content    TEXT,
      type       TEXT      DEFAULT 'general',
      folder_id  INTEGER,
      project_id INTEGER,
      icon       TEXT      DEFAULT 'file-alt',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
      CHECK (
        (folder_id IS NULL AND project_id IS NOT NULL) OR (folder_id IS NOT NULL AND project_id IS NULL)
        )
    )
  `)

  // 创建设置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings
    (
      id          INTEGER PRIMARY KEY CHECK ( id = 1 ),
      db_path     TEXT,
      theme       TEXT      DEFAULT 'light',
      default_ide TEXT      DEFAULT 'vscode',
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建IDE配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS ide_configs
    (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      command      TEXT NOT NULL,
      args         TEXT,
      icon         TEXT,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

// 数据库操作函数
const dbService = {
  // 文件夹相关操作
  folders: {
    // 获取所有文件夹
    getAll: () => {
      const stmt = db.prepare('SELECT * FROM folders ORDER BY parent_id, order_index, name ASC')
      return stmt.all()
    },

    // 根据ID获取文件夹
    getById: (id) => {
      const stmt = db.prepare('SELECT * FROM folders WHERE id = ?')
      return stmt.get(id)
    },

    // 获取子文件夹
    getChildren: (parentId) => {
      const stmt = db.prepare(
        'SELECT * FROM folders WHERE parent_id = ? ORDER BY order_index, name ASC'
      )
      return stmt.all(parentId)
    },

    // 获取根文件夹（没有父文件夹的文件夹）
    getRoots: () => {
      const stmt = db.prepare(
        'SELECT * FROM folders WHERE parent_id IS NULL ORDER BY order_index, name ASC'
      )
      return stmt.all()
    },

    // 创建文件夹
    create: (folder) => {
      const now = new Date().toISOString()

      // 计算新文件夹的排序索引
      let orderIndex = 0
      if (folder.parent_id) {
        // 获取同级文件夹中最大的order_index
        const stmt = db.prepare(
          'SELECT MAX(order_index) as max_order FROM folders WHERE parent_id = ?'
        )
        const result = stmt.get(folder.parent_id)
        orderIndex = (result.max_order || 0) + 1
      } else {
        // 获取根文件夹中最大的order_index
        const stmt = db.prepare(
          'SELECT MAX(order_index) as max_order FROM folders WHERE parent_id IS NULL'
        )
        const result = stmt.get()
        orderIndex = (result.max_order || 0) + 1
      }

      const stmt = db.prepare(`
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
        return dbService.folders.getById(result.lastInsertRowid)
      }
      return null
    },

    // 更新文件夹
    update: (id, data) => {
      const folder = dbService.folders.getById(id)
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
          const stmt = db.prepare(
            'SELECT MAX(order_index) as max_order FROM folders WHERE parent_id = ?'
          )
          const result = stmt.get(data.parent_id)
          orderIndex = (result.max_order || 0) + 1
          console.log('计算了新的order_index:', orderIndex, '(在新父文件夹下)')
        } else {
          // 获取根文件夹中最大的order_index
          const stmt = db.prepare(
            'SELECT MAX(order_index) as max_order FROM folders WHERE parent_id IS NULL'
          )
          const result = stmt.get()
          orderIndex = (result.max_order || 0) + 1
          console.log('文件夹将变为根级别, 新排序值:', orderIndex)
        }
      }

      const now = new Date().toISOString()
      const stmt = db.prepare(`
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
    delete: (id) => {
      const stmt = db.prepare('DELETE FROM folders WHERE id = ?')
      const result = stmt.run(id)
      return result.changes > 0
    }
  },

  // 项目相关操作
  projects: {
    // 获取所有项目或指定文件夹的项目
    getAll: (folderId = null) => {
      let stmt
      if (folderId) {
        // 查询当前文件夹以及所有子文件夹的项目
        stmt = db.prepare(`
          SELECT p.*
          FROM projects p
                 JOIN folders f ON p.folder_id = f.id
          WHERE f.parent_id = ?
             or f.id = ?
          ORDER BY p.name ASC
        `)
        return stmt.all(folderId, folderId)
      } else {
        stmt = db.prepare('SELECT * FROM projects ORDER BY name ASC')
        return stmt.all()
      }
    },

    // 根据ID获取项目
    getById: (id) => {
      const stmt = db.prepare('SELECT * FROM projects WHERE id = ?')
      return stmt.get(id)
    },

    // 创建项目
    create: (project) => {
      const now = new Date().toISOString()
      const stmt = db.prepare(`
        INSERT INTO projects (folder_id, name, description, path,
                              preferred_ide, icon, branch, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const result = stmt.run(
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
        return dbService.projects.getById(result.lastInsertRowid)
      }
      return null
    },

    // 更新项目
    update: (id, data) => {
      const project = dbService.projects.getById(id)
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

      const stmt = db.prepare(`
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
    delete: (id) => {
      const stmt = db.prepare('DELETE FROM projects WHERE id = ?')
      const result = stmt.run(id)
      return result.changes > 0
    },

    // 搜索项目
    search: (query) => {
      const searchTerm = `%${query}%`
      const stmt = db.prepare(`
        SELECT p.*, f.name as folder_name
        FROM projects p
               LEFT JOIN folders f ON p.folder_id = f.id
        WHERE p.name LIKE ?
           OR p.description LIKE ?
        ORDER BY p.name ASC
      `)

      return stmt.all(searchTerm, searchTerm)
    },
    getFavoriteProjects: () => {
      const stmt = db.prepare('SELECT * FROM projects WHERE is_favorite = 1 ORDER BY name ASC')
      return stmt.all()
    },
    getByPath: (path) => {
      const stmt = db.prepare('SELECT * FROM projects WHERE path = ? ORDER BY name ASC limit 1')
      return stmt.get(path)
    }
  },
  // IDE配置相关操作
  ideConfigs: {
    // 获取所有IDE配置
    getAll: () => {
      const stmt = db.prepare('SELECT * FROM ide_configs ORDER BY display_name ASC')
      return stmt.all()
    },

    // 根据ID获取IDE配置
    getById: (id) => {
      const stmt = db.prepare('SELECT * FROM ide_configs WHERE id = ?')
      return stmt.get(id)
    },

    // 根据名称获取IDE配置
    getByName: (name) => {
      const stmt = db.prepare('SELECT * FROM ide_configs WHERE name = ?')
      return stmt.get(name)
    },

    // 创建IDE配置
    create: (ideConfig) => {
      const now = new Date().toISOString()

      const stmt = db.prepare(`
        INSERT INTO ide_configs (name, display_name, command, args,
                                 icon, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      const result = stmt.run(
        ideConfig.name,
        ideConfig.display_name,
        ideConfig.command,
        ideConfig.args || null,
        ideConfig.icon || 'desktop',
        now,
        now
      )

      if (result.changes > 0) {
        return dbService.ideConfigs.getById(result.lastInsertRowid)
      }

      return null
    },

    // 更新IDE配置
    update: (id, data) => {
      const ideConfig = dbService.ideConfigs.getById(id)
      if (!ideConfig) {
        throw new Error('IDE config not found')
      }

      const now = new Date().toISOString()

      const stmt = db.prepare(`
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
        data.icon || ideConfig.icon,
        now,
        id
      )

      return dbService.ideConfigs.getById(id)
    },

    // 删除IDE配置
    delete: (id) => {
      const stmt = db.prepare('DELETE FROM ide_configs WHERE id = ?')
      const result = stmt.run(id)
      return result.changes > 0
    }
  }
}

export { initDatabase, getDb, dbService }