import { app, BrowserWindow, dialog } from 'electron'
import { initialize } from '@electron/remote/main'
import { createTrayWindow, createWindow, getMainWindow } from './window'
import { initDatabase } from './db-service'
import { registerIpcHandlers } from './ipc-handlers'
import * as settingsService from './settings-service'
import * as ideService from './ide-service'
import * as githubService from './github-service'
import http from 'http'

// 开发环境下启用调试
if (process.env.NODE_ENV === 'development' && process.env.VITE_DEV_DEBUG === 'true') {
  // 启用源码映射支持
  require('source-map-support').install()

  // 设置调试环境变量
  process.env.ELECTRON_ENABLE_SOURCE_MAPS = 'true'
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

  // 启用远程调试
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
  app.commandLine.appendSwitch('inspect', '5858')
}

// Initialize remote module
initialize()

// 全局托盘实例
let trayWindow: BrowserWindow | null = null
let server: http.Server | null = null

/**
 * 注册自定义协议处理器
 */
function registerProtocol() {
  console.log('正在注册devhaven://协议...')

  // 检查是否在开发模式
  if (process.env.NODE_ENV === 'development' || process.defaultApp) {
    startLocalServer().then(r => {console.log(r)})
  } else {
    // 生产模式直接注册
    if (!app.setAsDefaultProtocolClient('devhaven')) {
      console.error('无法注册devhaven://协议')
    } else {
      console.log('成功注册devhaven://协议')
    }
  }
}

// 处理deeplink URL
function handleDeepLink(url: string) {
  console.log('收到协议URL:', url)
  if (url && url.startsWith('devhaven://oauth/callback')) {
    console.log('处理GitHub OAuth回调:', url)
    githubService.handleCallback(url).then(r => console.log(r))
  }
}

// 处理macOS上的自定义协议
app.on('open-url', (event, url) => {
  console.log('收到open-url事件:', url)
  event.preventDefault()
  handleDeepLink(url)
})

/**
 * 初始化应用程序
 */
async function initApp() {
  try {
    const dbPath = settingsService.getDbPath()
    await initDatabase(dbPath)
    // 检测并初始化IDE配置
    await ideService.initIdeConfigs()
    console.log('应用程序初始化成功')
  } catch (error: any) {
    console.error('应用程序初始化失败:', error)
    dialog.showErrorBox('初始化错误', `应用程序初始化失败: ${error.message}`)
  }
}

// 当Electron准备就绪时创建窗口
app.whenReady().then(async () => {
  // 注册自定义协议
  registerProtocol()

  await initApp()
  // 注册所有IPC处理程序
  registerIpcHandlers()
  // 创建主窗口
  createWindow()
  // 创建悬浮窗，但根据设置决定是否显示
  createTrayWindow()

  // 处理在 Windows 上的协议激活
  if (process.platform === 'win32') {
    const gotTheLock = app.requestSingleInstanceLock()
    if (!gotTheLock) {
      app.quit()
    } else {
      app.on('second-instance', (_1, commandLine, _): void => {
        // 有人试图运行第二个实例，我们应该聚焦到我们的窗口
        if (getMainWindow()) {
          if (getMainWindow()?.isMinimized()) getMainWindow()?.restore()
          getMainWindow()?.focus()
        }

        // 处理协议URL (Windows)
        if (commandLine.length > 0) {
          const url = commandLine.find((arg) => arg.startsWith('devhaven://'))
          if (url) {
            console.log('收到第二实例协议URL (Windows):', url)
            handleDeepLink(url)
          }
        }
      })
    }
  }

  // 在macOS上，当点击dock图标时重新创建窗口
  app.on('activate', () => {
    console.log('activate')
    if (!getMainWindow()) {
      createWindow()
    }
  })
})

// 处理启动参数中的协议URL (Windows)
if (process.platform === 'win32') {
  const args = process.argv.slice(1)
  const protocolUrl = args.find((arg) => arg.startsWith('devhaven://'))
  if (protocolUrl) {
    console.log('启动时收到协议URL (Windows):', protocolUrl)
    app.whenReady().then(() => {
      setTimeout(() => {
        handleDeepLink(protocolUrl)
      }, 1000) // 稍微延迟确保应用已完全初始化
    })
  }
}

// 当所有窗口关闭时退出应用，除了在macOS上
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 在应用退出前清理资源
app.on('before-quit', () => {
  // 关闭托盘窗口
  if (trayWindow) {
    trayWindow.destroy()
    trayWindow = null
  }

  // 关闭服务器
  if (server) {
    try {
      server.close()
    } catch (error) {
      console.error('关闭服务器失败:', error)
    }
  }
})

// 添加这个函数
function startLocalServer() {
  // 如果服务器已经存在，先关闭
  if (server) {
    try {
      server.close()
    } catch (error) {
      console.error('关闭旧服务器失败:', error)
    }
  }

  return new Promise<number>((resolve, reject) => {
    try {
      server = http.createServer((req, res) => {
        console.log('本地服务器收到请求:', req.url)

        if (req.url && req.url.startsWith('/oauth/callback')) {
          // 设置CORS头
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

          // 处理回调
          githubService.handleCallback('http://localhost:45678' + req.url).then(r => console.log(r))

          // 发送响应，关闭浏览器窗口
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(`
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
              <title>授权完成</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding-top: 50px; }
                .success { color: #4CAF50; }
              </style>
            </head>
            <body>
              <h2 class="success">GitHub 授权成功!</h2>
              <p>您可以关闭此窗口并返回应用程序。</p>
              <script>
                // 3秒后自动关闭窗口
                setTimeout(() => window.close(), 3000);
              </script>
            </body>
            </html>
          `)
        } else {
          res.writeHead(404)
          res.end()
        }
      })

      // 使用随机端口或固定端口
      const port = 45678
      server.listen(port, '127.0.0.1', () => {
        console.log(`本地OAuth回调服务器运行在 http://localhost:${port}`)
        resolve(port)
      })

      server.on('error', (err) => {
        console.error('启动本地服务器失败:', err)
        reject(err)
      })
    } catch (error) {
      console.error('创建服务器时出错:', error)
      reject(error)
    }
  })
}
