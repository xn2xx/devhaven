const { contextBridge, ipcRenderer } = require("electron");

// 创建API对象
const electronAPI = {
  // 文件系统操作
  selectDbPath: () => ipcRenderer.invoke("select-db-path"),
  openFolder: (path) => ipcRenderer.invoke("open-folder", path),
  openWithIDE: (path, ide) => ipcRenderer.invoke("open-with-ide", path, ide),
  resumeIde: (project) => ipcRenderer.invoke("resume-ide", project),
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  openDirectoryDialog: () => ipcRenderer.invoke("open-directory-dialog"),
  openExecutableDialog: () => ipcRenderer.invoke("open-executable-dialog"),

  // 应用设置
  getAppSettings: () => ipcRenderer.invoke("get-app-settings"),
  saveAppSettings: (settings) => ipcRenderer.invoke("save-app-settings", settings),

  // IDE配置
  getIdeConfigs: () => ipcRenderer.invoke("db:getIdeConfigs"),
  getIdeConfig: (id) => ipcRenderer.invoke("get-ide-config", id),
  createIdeConfig: (ideConfig) => ipcRenderer.invoke("db:createIdeConfig", ideConfig),
  updateIdeConfig: (id, data) => ipcRenderer.invoke("db:updateIdeConfig", id, data),
  deleteIdeConfig: (id) => ipcRenderer.invoke("db:deleteIdeConfig", id),
  detectIdes: () => ipcRenderer.invoke("detect-ides"),

  // 数据库操作 - 文件夹
  getFolders: () => ipcRenderer.invoke("db:getFolders"),
  getFolderChildren: (parentId) => ipcRenderer.invoke("db:getFolderChildren", parentId),
  getFolderRoots: () => ipcRenderer.invoke("db:getFolderRoots"),
  createFolder: (folder) => ipcRenderer.invoke("db:createFolder", folder),
  updateFolder: (id, data) => ipcRenderer.invoke("db:updateFolder", id, data),
  deleteFolder: (id) => ipcRenderer.invoke("db:deleteFolder", id),

  // 数据库操作 - 项目
  getProjects: (folderId) => ipcRenderer.invoke("db:getProjects", folderId),
  createProject: (project) => ipcRenderer.invoke("db:createProject", project),
  updateProject: (id, data) => ipcRenderer.invoke("db:updateProject", id, data),
  deleteProject: (id) => ipcRenderer.invoke("db:deleteProject", id),
  searchProjects: (query) => ipcRenderer.invoke("db:searchProjects", query),
  // 获取收藏的项目列表
  favoriteProjects: () => ipcRenderer.invoke("db:getFavoriteProjects"),

  getOpenProjects: () => ipcRenderer.invoke("get-open-projects"),

  // GitHub相关操作
  authenticateGithub: () => ipcRenderer.invoke("github:authenticate"),
  getGithubAuthStatus: () => ipcRenderer.invoke("github:auth-status"),
  logoutGithub: () => ipcRenderer.invoke("github:logout"),
  getGithubStarredRepos: () => ipcRenderer.invoke("github:get-starred-repos"),

  // IPC事件监听
  ipcRenderer: {
    on: (channel, listener) => ipcRenderer.on(channel, (event, ...args) => listener(...args)),
    removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener)
  }
};

// 在纯Electron环境下暴露API接口
contextBridge.exposeInMainWorld("electronAPI", electronAPI);
// 直接将API暴露到全局范围，适应纯客户端环境
contextBridge.exposeInMainWorld("api", electronAPI);

// 监听导航到设置页面的消息
ipcRenderer.on('navigate-to-settings', () => {
  window.api.router.push('/settings');
});

// 暴露 Node.js 环境变量
contextBridge.exposeInMainWorld("process", {
  env: {
    NODE_ENV: process.env.NODE_ENV || "production"
  }
});
