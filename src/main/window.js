const { BrowserWindow } = require('electron');
const path = require('path');
const { enable } = require('@electron/remote/main');

// 全局窗口引用，避免垃圾回收
let mainWindow;

/**
 * 创建主窗口
 * @returns {BrowserWindow} 创建的主窗口实例
 */
function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js')
    }
  });

  // 为该窗口启用远程模块
  enable(mainWindow.webContents);

  // 加载应用
  if (process.env.NODE_ENV === 'development') {
    // 开发模式：从Vite开发服务器加载
    mainWindow.loadURL('http://localhost:5173');
    // 打开开发者工具
    // mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：加载本地文件
    mainWindow.loadFile(path.join(__dirname, '../../out/renderer/index.html'));
  }

  // 处理窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * 获取主窗口实例
 * @returns {BrowserWindow|null} 主窗口实例或null
 */
function getMainWindow() {
  return mainWindow;
}

module.exports = {
  createWindow,
  getMainWindow
};
