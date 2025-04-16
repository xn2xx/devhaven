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
const { startServer } = require('../../electron/server.js')

// Initialize remote module
initialize()

// Database instance
let dbInstance = null

// Keep a global reference of the window object to avoid garbage collection
let mainWindow

// 全局托盘实例
let tray = null

/**
 * 初始化应用程序
 */
async function initApp() {
  try {
    const dbPath = settingsService.getDbPath()
    dbInstance = await initDatabase(dbPath)

    // 检测并初始化IDE配置
    await ideService.initIdeConfigs()

    // 启动 Express 服务器
    await startServer()

    console.log('应用程序初始化成功')
  } catch (error) {
    console.error('应用程序初始化失败:', error)
    dialog.showErrorBox(
      '初始化错误',
      `应用程序初始化失败: ${error.message}`
    )
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

  // 创建托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主窗口',
      click: () => {
        const mainWindow = getMainWindow()
        if (mainWindow) {
          mainWindow.show()
        }
      }
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => {
        const mainWindow = getMainWindow()
        if (mainWindow) {
          mainWindow.show()
          mainWindow.webContents.send('navigate-to-settings')
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // 点击托盘图标时显示主窗口
  tray.on('click', () => {
    const mainWindow = getMainWindow()
    if (mainWindow) {
      mainWindow.show()
    }
  })
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
