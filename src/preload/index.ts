import { contextBridge, ipcRenderer } from 'electron'

// 定义ElectronAPI接口
interface ElectronAPI {
  // 文件系统操作
  selectDbPath: () => Promise<string>
  openFolder: (path: string) => Promise<void>
  openWithIDE: (path: string, ide: string) => Promise<void>
  resumeIde: (project: any) => Promise<void>
  selectFolder: () => Promise<string>
  openDirectoryDialog: () => Promise<string>
  openExecutableDialog: () => Promise<string>
  openExternalUrl: (url: string) => Promise<void>
  pathExists: (path: string) => Promise<boolean>
  cloneGithubRepo: (repoUrl: string, targetPath: string) => Promise<void>

  // 应用设置
  getAppSettings: () => Promise<any>
  saveAppSettings: (settings: any) => Promise<void>

  // IDE配置
  getIdeConfigs: () => Promise<any[]>
  getIdeConfig: (id: string) => Promise<any>
  createIdeConfig: (ideConfig: any) => Promise<any>
  updateIdeConfig: (id: string, data: any) => Promise<any>
  deleteIdeConfig: (id: string) => Promise<void>
  detectIdes: () => Promise<any[]>

  // 数据库操作 - 文件夹
  getFolders: () => Promise<any[]>
  getFolderChildren: (parentId: string) => Promise<any[]>
  getFolderRoots: () => Promise<any[]>
  createFolder: (folder: any) => Promise<any>
  updateFolder: (id: string, data: any) => Promise<any>
  deleteFolder: (id: string) => Promise<void>

  // 数据库操作 - 项目
  getProjects: (folderId: string) => Promise<any[]>
  createProject: (project: any) => Promise<any>
  updateProject: (id: string, data: any) => Promise<any>
  deleteProject: (id: string) => Promise<void>
  searchProjects: (query: string) => Promise<any[]>
  favoriteProjects: () => Promise<any[]>

  getOpenProjects: () => Promise<any[]>

  // GitHub相关操作
  authenticateGithub: () => Promise<void>
  getGithubAuthStatus: () => Promise<any>
  logoutGithub: () => Promise<void>
  getGithubStarredRepos: () => Promise<any[]>
  syncStarredRepositories: () => Promise<any[]>

  // IPC事件监听
  ipcRenderer: {
    on: (channel: string, listener: (...args: any[]) => void) => void
    removeListener: (channel: string, listener: (...args: any[]) => void) => void
    send: (channel: string, ...args: any[]) => void
  }
}

// 创建API对象
const electronAPI: ElectronAPI = {
  // 文件系统操作
  selectDbPath: () => ipcRenderer.invoke('select-db-path'),
  openFolder: (path) => ipcRenderer.invoke('open-folder', path),
  openWithIDE: (path, ide) => ipcRenderer.invoke('open-with-ide', path, ide),
  resumeIde: (project) => ipcRenderer.invoke('resume-ide', project),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  openExecutableDialog: () => ipcRenderer.invoke('open-executable-dialog'),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  pathExists: (path) => ipcRenderer.invoke('path-exists', path),
  cloneGithubRepo: (repoUrl, targetPath) =>
    ipcRenderer.invoke('clone-github-repo', repoUrl, targetPath),

  // 应用设置
  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),

  // IDE配置
  getIdeConfigs: () => ipcRenderer.invoke('db:getIdeConfigs'),
  getIdeConfig: (id) => ipcRenderer.invoke('get-ide-config', id),
  createIdeConfig: (ideConfig) => ipcRenderer.invoke('db:createIdeConfig', ideConfig),
  updateIdeConfig: (id, data) => ipcRenderer.invoke('db:updateIdeConfig', id, data),
  deleteIdeConfig: (id) => ipcRenderer.invoke('db:deleteIdeConfig', id),
  detectIdes: () => ipcRenderer.invoke('detect-ides'),

  // 数据库操作 - 文件夹
  getFolders: () => ipcRenderer.invoke('db:getFolders'),
  getFolderChildren: (parentId) => ipcRenderer.invoke('db:getFolderChildren', parentId),
  getFolderRoots: () => ipcRenderer.invoke('db:getFolderRoots'),
  createFolder: (folder) => ipcRenderer.invoke('db:createFolder', folder),
  updateFolder: (id, data) => ipcRenderer.invoke('db:updateFolder', id, data),
  deleteFolder: (id) => ipcRenderer.invoke('db:deleteFolder', id),

  // 数据库操作 - 项目
  getProjects: (folderId) => ipcRenderer.invoke('db:getProjects', folderId),
  createProject: (project) => ipcRenderer.invoke('db:createProject', project),
  updateProject: (id, data) => ipcRenderer.invoke('db:updateProject', id, data),
  deleteProject: (id) => ipcRenderer.invoke('db:deleteProject', id),
  searchProjects: (query) => ipcRenderer.invoke('db:searchProjects', query),
  // 获取收藏的项目列表
  favoriteProjects: () => ipcRenderer.invoke('db:getFavoriteProjects'),

  getOpenProjects: () => ipcRenderer.invoke('get-open-projects'),

  // GitHub相关操作
  authenticateGithub: () => ipcRenderer.invoke('github:authenticate'),
  getGithubAuthStatus: () => ipcRenderer.invoke('github:auth-status'),
  logoutGithub: () => ipcRenderer.invoke('github:logout'),
  getGithubStarredRepos: () => ipcRenderer.invoke('github:get-starred-repos'),
  syncStarredRepositories: () => ipcRenderer.invoke('github:syncStarredRepositories'),

  // IPC事件监听
  ipcRenderer: {
    on: (channel, listener) => ipcRenderer.on(channel, (event, ...args) => listener(...args)),
    removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args)
  }
}

// 在纯Electron环境下暴露API接口
contextBridge.exposeInMainWorld('electronAPI', electronAPI)
// 直接将API暴露到全局范围，适应纯客户端环境
contextBridge.exposeInMainWorld('api', electronAPI)

// 监听导航到设置页面的消息
ipcRenderer.on('navigate-to-settings', () => {
  // 假设window.api.router存在
  ;(window as any).api.router.push('/settings')
})

// 暴露 Node.js 环境变量
contextBridge.exposeInMainWorld('process', {
  env: {
    NODE_ENV: process.env.NODE_ENV || 'production'
  }
})

// 为了全局类型定义，声明全局命名空间
export {} // 确保这个文件被视为模块

// 全局类型声明，使Window接口包含我们的API
declare global {
  interface Window {
    api: ElectronAPI
    electronAPI: ElectronAPI
    process: {
      env: {
        NODE_ENV: string
      }
    }
  }
}
