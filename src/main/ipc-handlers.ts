import { app, ipcMain, shell } from 'electron'
import { dbService, initDatabase } from './db-service'
import * as fileService from './file-service'
import * as ideService from './ide-service'
import * as settingsService from './settings-service'
import * as openProjectService from './open-project-service'
import * as githubService from './github-service'
import path from 'path'
import { getTrayWindow } from './window'
import * as projectService from './project-service'

/**
 * 注册所有IPC处理程序
 */
function registerIpcHandlers() {
  // ========== 数据库相关 IPC 处理程序 ==========

  // 获取文件夹
  ipcMain.handle('db:getFolders', async () => {
    try {
      return dbService.folders.getAll()
    } catch (error) {
      console.error('获取文件夹失败:', error)
      throw error
    }
  })

  // 获取文件夹子项
  ipcMain.handle('db:getFolderChildren', async (_, parentId) => {
    try {
      return dbService.folders.getChildren(parentId)
    } catch (error) {
      console.error('获取文件夹子项失败:', error)
      throw error
    }
  })

  // 获取根文件夹
  ipcMain.handle('db:getFolderRoots', async () => {
    try {
      return dbService.folders.getRoots()
    } catch (error) {
      console.error('获取根文件夹失败:', error)
      throw error
    }
  })

  // 获取项目
  ipcMain.handle('db:getProjects', async (_, folderId = null) => {
    try {
      return projectService.getProjects(folderId)
    } catch (error) {
      console.error('获取项目失败:', error)
      throw error
    }
  })

  // 创建文件夹
  ipcMain.handle('db:createFolder', async (_, folderData) => {
    try {
      return dbService.folders.create(folderData)
    } catch (error) {
      console.error('创建文件夹失败:', error)
      throw error
    }
  })

  // 创建项目
  ipcMain.handle('db:createProject', async (_, projectData) => {
    try {
      // 创建项目
      return projectService.createProject(projectData)
    } catch (error) {
      console.error('创建项目失败:', error)
      throw error
    }
  })

  // 更新文件夹
  ipcMain.handle('db:updateFolder', async (_, id, data) => {
    try {
      return dbService.folders.update(id, data)
    } catch (error) {
      console.error('更新文件夹失败:', error)
      throw error
    }
  })

  // 更新项目
  ipcMain.handle('db:updateProject', async (_, id, data) => {
    try {
      return projectService.updateProject(id, data)
    } catch (error) {
      console.error('更新项目失败:', error)
      throw error
    }
  })

  // 获取喜欢的项目列表
  ipcMain.handle('db:getFavoriteProjects', async () => {
    try {
      return dbService.projects.getFavoriteProjects()
    } catch (error) {
      console.error('获取喜欢的项目列表失败:', error)
      throw error
    }
  })

  // 删除文件夹
  ipcMain.handle('db:deleteFolder', async (_, id) => {
    try {
      return dbService.folders.delete(id)
    } catch (error) {
      console.error('删除文件夹失败:', error)
      throw error
    }
  })

  // 删除项目
  ipcMain.handle('db:deleteProject', async (_, id) => {
    try {
      return dbService.projects.delete(id)
    } catch (error) {
      console.error('删除项目失败:', error)
      throw error
    }
  })

  // 搜索项目
  ipcMain.handle('db:searchProjects', async (_, query) => {
    try {
      return dbService.projects.search(query)
    } catch (error) {
      console.error('搜索项目失败:', error)
      throw error
    }
  })

  // ========== IDE 相关 IPC 处理程序 ==========

  // 获取所有IDE配置
  ipcMain.handle('db:getIdeConfigs', async () => {
    try {
      return dbService.ideConfigs.getAll()
    } catch (error) {
      console.error('获取IDE配置失败:', error)
      throw error
    }
  })

  // 获取IDE配置
  ipcMain.handle('get-ide-config', async (_, id) => {
    try {
      return dbService.ideConfigs.getById(id)
    } catch (error) {
      console.error('获取IDE配置失败:', error)
      throw error
    }
  })

  // 创建IDE配置
  ipcMain.handle('db:createIdeConfig', async (_, ideConfig) => {
    try {
      return dbService.ideConfigs.create(ideConfig)
    } catch (error) {
      console.error('创建IDE配置失败:', error)
      throw error
    }
  })

  // 更新IDE配置
  ipcMain.handle('db:updateIdeConfig', async (_, id, data) => {
    try {
      return dbService.ideConfigs.update(id, data)
    } catch (error) {
      console.error('更新IDE配置失败:', error)
      throw error
    }
  })

  // 删除IDE配置
  ipcMain.handle('db:deleteIdeConfig', async (_, id) => {
    try {
      return dbService.ideConfigs.delete(id)
    } catch (error) {
      console.error('删除IDE配置失败:', error)
      throw error
    }
  })

  // 重新检测IDE
  ipcMain.handle('detect-ides', async () => {
    try {
      await ideService.initIdeConfigs()
      return dbService.ideConfigs.getAll()
    } catch (error) {
      console.error('重新检测IDE失败:', error)
      throw error
    }
  })

  // 使用IDE打开项目
  ipcMain.handle('open-with-ide', async (_, projectPath, ideName) => {
    return ideService.openWithIde(projectPath, ideName)
  })

  // ========== 文件操作相关 IPC 处理程序 ==========

  // 选择数据库路径
  ipcMain.handle('select-db-path', async () => {
    const result = await fileService.selectDatabasePath(
      path.join(app.getPath('home'), 'devhaven.db')
    )

    if (!result.canceled && result.filePath) {
      settingsService.setDbPath(result.filePath)
      // 重新初始化数据库
      try {
        await initDatabase(result.filePath)
      } catch (error) {
        console.error('使用新路径初始化数据库失败:', error)
      }
    }

    return result
  })

  // 在系统默认浏览器中打开外部URL
  ipcMain.handle('open-external-url', async (_, url) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      console.error('打开外部URL失败:', error)
      throw error
    }
  })

  // 选择文件夹
  ipcMain.handle('select-folder', async () => {
    return fileService.selectFolder()
  })

  // 打开项目目录选择对话框
  ipcMain.handle('open-directory-dialog', async () => {
    return fileService.selectFolder()
  })

  // 打开文件夹
  ipcMain.handle('open-folder', async (_, folderPath) => {
    return fileService.openFolder(folderPath)
  })

  // 选择可执行文件
  ipcMain.handle('open-executable-dialog', async () => {
    return fileService.selectExecutable()
  })

  ipcMain.handle('openExecutableDialog', async () => {
    return fileService.selectExecutable()
  })

  // ========== 设置相关 IPC 处理程序 ==========
  // 获取应用设置

  ipcMain.handle('get-app-settings', () => {
    return settingsService.getSettings()
  })

  // 保存应用设置
  ipcMain.handle('save-app-settings', (_, settings) => {
    return settingsService.saveSettings(settings)
  })

  // 获取打开的项目
  ipcMain.handle('get-open-projects', () => {
    console.log('get-open-projects')
    return openProjectService.getOpenProjects()
  })
  ipcMain.handle('resume-ide', (_, project) => {
    console.log('resume-ide', project)
    return ideService.resumeIde(project)
  })

  // ========== GitHub 相关 IPC 处理程序 ==========

  // GitHub认证
  ipcMain.handle('github:authenticate', async () => {
    try {
      return await githubService.authenticate()
    } catch (error) {
      console.error('GitHub认证失败:', error)
      throw error
    }
  })

  // 获取GitHub认证状态
  ipcMain.handle('github:auth-status', async () => {
    try {
      return await githubService.getAuthStatus()
    } catch (error) {
      console.error('获取GitHub认证状态失败:', error)
      throw error
    }
  })

  // GitHub登出
  ipcMain.handle('github:logout', async () => {
    try {
      return await githubService.logout()
    } catch (error) {
      console.error('GitHub登出失败:', error)
      throw error
    }
  })

  // 获取GitHub已加星标的仓库
  ipcMain.handle('github:get-starred-repos', async () => {
    try {
      return await githubService.getStarredRepositories()
    } catch (error) {
      console.error('获取GitHub已加星标的仓库失败:', error)
      throw error
    }
  })
  ipcMain.handle('github:syncStarredRepositories', async () => {
    try {
      return await githubService.syncStarredRepositories()
    } catch (error) {
      console.error('获取GitHub已加星标的仓库失败:', error)
      throw error
    }
  })

  // 克隆GitHub仓库
  ipcMain.handle('clone-github-repo', async (event, repoUrl, targetPath) => {
    try {
      // 创建一个webContents引用，用于发送进度更新
      const { sender } = event

      // 开始克隆过程
      return await fileService.cloneGitRepository(repoUrl, targetPath, (progress) => {
        // 通过IPC发送进度更新
        sender.send('clone-progress-update', progress)
      })
    } catch (error) {
      console.error('克隆GitHub仓库失败:', error)
      throw error
    }
  })

  // 检查路径是否存在
  ipcMain.handle('path-exists', async (_, path) => {
    try {
      return fileService.pathExists(path)
    } catch (error) {
      console.error('检查路径失败:', error)
      throw error
    }
  })

  // 注册调整悬浮窗高度的处理程序
  ipcMain.on('update-tray-height', (_, height) => {
    const trayWindow = getTrayWindow()
    if (trayWindow) {
      const [width] = trayWindow.getSize()
      // 适当添加一些边距，并限制最大高度
      const newHeight = Math.min(Math.max(height + 16, 100), 600)
      trayWindow.setSize(width, newHeight)
    }
  })

  // 注册控制悬浮窗显示的处理程序
  ipcMain.on('toggle-tray-window', (_, show) => {
    const trayWindow = getTrayWindow()

    if (show) {
      // 如果窗口已经存在，确保它是可见的
      if (!trayWindow?.isVisible()) {
        trayWindow?.show()
      }
    } else {
      // 如果设置为不显示，则隐藏窗口
      trayWindow?.hide()
    }

    // 保存到设置中，以便下次启动时使用
    settingsService.saveTrayWindowSetting(show)
  })
}

export { registerIpcHandlers }
