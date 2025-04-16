const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const { initialize, enable } = require('@electron/remote/main')
const { execFile } = require('child_process')
const Store = require('electron-store')
const { initDatabase, dbService } = require('./db.service')
const ideDetector = require('./ide-detector')
const { createWindow, getMainWindow } = require('./window')
const { registerIpcHandlers } = require('./ipc-handlers')
const settingsService = require('./settings-service')
const ideService = require('./ide-service')
// Initialize remote module
initialize()

// Database instance
let dbInstance = null
// 全局托盘实例
let tray = null
let trayWindow = null

/**
 * 创建托盘窗口
 */
function createTrayWindow() {
  trayWindow = new BrowserWindow({
    width: 280,
    height: 300,
    frame: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js')
    }
  })

  // 为该窗口启用远程模块
  enable(trayWindow.webContents);
  // 加载托盘窗口的 HTML 文件
  if (process.env.NODE_ENV === 'development') {
    trayWindow.loadURL('http://localhost:5173/#/tray')
    // 打开开发者工具
    trayWindow.webContents.openDevTools();
  } else {
    trayWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: '/tray'
    })
  }

  // 当窗口失去焦点时隐藏
  trayWindow.on('blur', () => {
    trayWindow.hide()
  })

  // 在 macOS 上设置窗口级别为浮动窗口
  if (process.platform === 'darwin') {
    trayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }
}

/**
 * 创建系统托盘
 */
function createTray() {
  // 创建托盘图标
  const iconPath = path.join(__dirname, '../../resources/icon.png')
  tray = new Tray(iconPath)
  tray.setToolTip('DevHaven')

  // 创建托盘窗口
  createTrayWindow()

  // 点击托盘图标时显示托盘窗口
  tray.on('click', () => {
    const trayBounds = tray.getBounds()
    const windowBounds = trayWindow.getBounds()

    // 计算窗口位置，使其显示在托盘图标上方
    const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2))
    const y = Math.round(trayBounds.y - windowBounds.height)

    trayWindow.setPosition(x, y)
    trayWindow.show()

    // 通知托盘窗口刷新项目列表
    trayWindow.webContents.send('refresh-tray-projects')
  })
}


/**
 * 初始化应用程序
 */
async function initApp() {
  try {
    const dbPath = settingsService.getDbPath()
    dbInstance = await initDatabase(dbPath)
    // 检测并初始化IDE配置
    await ideService.initIdeConfigs()
    console.log('应用程序初始化成功')
  } catch (error) {
    console.error('应用程序初始化失败:', error)
    dialog.showErrorBox(
      '初始化错误',
      `应用程序初始化失败: ${error.message}`
    )
  }
}

// 当Electron准备就绪时创建窗口
app.whenReady().then(async () => {
  await initApp()
  // 注册所有IPC处理程序
  registerIpcHandlers()
  // 创建主窗口
  createWindow()
  // 创建系统托盘
  createTray()
  // 在macOS上，当点击dock图标时重新创建窗口
  app.on('activate', () => {
    console.log('activate')
    if (!getMainWindow()) {
      createWindow()
    }
  })
})

// 当所有窗口关闭时退出应用，除了在macOS上
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (tray) {
      tray.destroy()
    }
    app.quit()
  }
})

// 在应用退出前清理托盘
app.on('before-quit', () => {
  if (tray) {
    tray.destroy()
  }
})
