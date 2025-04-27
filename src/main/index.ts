import { app, BrowserWindow, dialog, Tray } from "electron";
import path from "path";
import { enable, initialize } from "@electron/remote/main";
import { createWindow, getMainWindow, setTrayWindow } from "./window";
import { initDatabase } from "./db-service";
import { registerIpcHandlers } from "./ipc-handlers";
import * as settingsService from "./settings-service";
import * as ideService from "./ide-service";
import * as githubService from "./github-service";
import http from "http";

// Initialize remote module
initialize();

// Database instance
let dbInstance = null;
// 全局托盘实例
let tray: Tray | null = null;
let trayWindow: BrowserWindow | null = null;
let server: http.Server | null = null;

/**
 * 注册自定义协议处理器
 */
function registerProtocol() {
  console.log("正在注册devhaven://协议...");

  // 检查是否在开发模式
  if (process.env.NODE_ENV === "development" || process.defaultApp) {
    startLocalServer();
  } else {
    // 生产模式直接注册
    if (!app.setAsDefaultProtocolClient("devhaven")) {
      console.error("无法注册devhaven://协议");
    } else {
      console.log("成功注册devhaven://协议");
    }
  }
}

// 处理deeplink URL
function handleDeepLink(url: string) {
  console.log("收到协议URL:", url);
  if (url && url.startsWith("devhaven://oauth/callback")) {
    console.log("处理GitHub OAuth回调:", url);
    githubService.handleCallback(url);
  }
}

// 处理macOS上的自定义协议
app.on("open-url", (event, url) => {
  console.log("收到open-url事件:", url);
  event.preventDefault();
  handleDeepLink(url);
});

/**
 * 创建悬浮窗
 */
function createTrayWindow() {
  trayWindow = new BrowserWindow({
    width: 280,
    // 移除固定高度，使用其他配置实现自适应
    height: 0, // 初始高度很小，后面会根据内容动态调整
    minHeight: 100, // 最小高度
    useContentSize: true, // 使用内容大小而不是窗口大小
    frame: false, // 无边框
    show: true, // 初始不显示
    alwaysOnTop: true,
    skipTaskbar: true, // 不在任务栏显示
    movable: true,
    transparent: true, // 启用窗口透明
    backgroundColor: '#00000000', // 完全透明背景
    // macOS特定配置
    titleBarStyle: 'hidden', // 统一使用hidden样式
    hasShadow: false, // 禁用阴影以提高透明效果
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload/index.js")
    }
  });

  // 为该窗口启用远程模块
  enable(trayWindow.webContents);

  // 在window模块中设置托盘窗口引用
  setTrayWindow(trayWindow);

  // 加载托盘窗口的 HTML 文件
  if (process.env.NODE_ENV === "development") {
    trayWindow.loadURL("http://localhost:5173/#/tray");
    // 打开开发者工具
    // trayWindow.webContents.openDevTools();
  } else {
    trayWindow.loadFile(path.join(__dirname, "../../out/renderer/index.html"), {
      hash: "/tray"
    });
  }

  // 监听内容大小变化，调整窗口高度
  trayWindow.webContents.on('did-finish-load', () => {
    // 等待DOM渲染完成后获取内容高度并调整窗口大小
    setTimeout(() => {
      trayWindow?.webContents.executeJavaScript(`
        document.body.offsetHeight;
      `).then(height => {
        // 根据内容高度调整窗口
        if (trayWindow && height > 0) {
          const [width] = trayWindow.getSize();
          // 给高度添加一些边距
          trayWindow.setSize(width, Math.min(Math.max(height, 100), 600));
        }
      }).catch(err => console.error('获取内容高度失败:', err));
    }, 300);
  });

  // 设置窗口始终在最前面 (最高级别的置顶)
  trayWindow.setAlwaysOnTop(true, "screen-saver", 1); // 使用level 1表示最高层级

  // 设置窗口在所有工作区都可见
  trayWindow.setVisibleOnAllWorkspaces(true, {visibleOnFullScreen: true});
  // 在macOS上，设置窗口层级为浮动面板，这有助于在全屏应用上方显示
  if (process.platform === 'darwin') {
    trayWindow.setWindowButtonVisibility(true); // 显示窗口按钮以便于拖动
    // 确保窗口可以显示在全屏应用的上方
    trayWindow.setAlwaysOnTop(true, "floating", 1);

    // 确保窗口背景透明
    trayWindow.setBackgroundColor('#00000000');
    trayWindow.setOpacity(1.0); // 设置完全不透明度（透明由backgroundColor控制）
  }
}

/**
 * 创建系统托盘
 */
// function createTray() {
//   // 创建托盘图标
//   const iconPath = path.join(__dirname, "../../resources/icon.png");
//   tray = new Tray(iconPath);
//   tray.setToolTip("DevHaven");
//
//   // 创建托盘窗口
//   createTrayWindow();
//
//   // 点击托盘图标时显示托盘窗口
//   tray.on("click", () => {
//     if (!tray || !trayWindow) return;
//
//     const trayBounds = tray.getBounds();
//     const windowBounds = trayWindow.getBounds();
//
//     // 计算窗口位置，使其显示在托盘图标上方
//     const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
//     const y = Math.round(trayBounds.y - windowBounds.height);
//
//     trayWindow.setPosition(x, y);
//     trayWindow.show();
//
//     // 通知托盘窗口刷新项目列表
//     trayWindow.webContents.send("refresh-tray-projects");
//   });
// }

/**
 * 初始化应用程序
 */
async function initApp() {
  try {
    const dbPath = settingsService.getDbPath();
    dbInstance = await initDatabase(dbPath);
    // 检测并初始化IDE配置
    await ideService.initIdeConfigs();
    console.log("应用程序初始化成功");
  } catch (error: any) {
    console.error("应用程序初始化失败:", error);
    dialog.showErrorBox(
      "初始化错误",
      `应用程序初始化失败: ${error.message}`
    );
  }
}

// 当Electron准备就绪时创建窗口
app.whenReady().then(async () => {
  // 注册自定义协议
  registerProtocol();

  await initApp();
  // 注册所有IPC处理程序
  registerIpcHandlers();
  // 创建主窗口
  createWindow();
  // 创建系统托盘
  createTrayWindow();

  // 处理在 Windows 上的协议激活
  if (process.platform === "win32") {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      app.quit();
    } else {
      app.on("second-instance", (event, commandLine, workingDirectory) => {
        // 有人试图运行第二个实例，我们应该聚焦到我们的窗口
        if (getMainWindow()) {
          if (getMainWindow().isMinimized()) getMainWindow().restore();
          getMainWindow().focus();
        }

        // 处理协议URL (Windows)
        if (commandLine.length > 0) {
          const url = commandLine.find(arg => arg.startsWith("devhaven://"));
          if (url) {
            console.log("收到第二实例协议URL (Windows):", url);
            handleDeepLink(url);
          }
        }
      });
    }
  }

  // 在macOS上，当点击dock图标时重新创建窗口
  app.on("activate", () => {
    console.log("activate");
    if (!getMainWindow()) {
      createWindow();
    }
  });
});

// 处理启动参数中的协议URL (Windows)
if (process.platform === "win32") {
  const args = process.argv.slice(1);
  const protocolUrl = args.find(arg => arg.startsWith("devhaven://"));
  if (protocolUrl) {
    console.log("启动时收到协议URL (Windows):", protocolUrl);
    app.whenReady().then(() => {
      setTimeout(() => {
        handleDeepLink(protocolUrl);
      }, 1000); // 稍微延迟确保应用已完全初始化
    });
  }
}

// 当所有窗口关闭时退出应用，除了在macOS上
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// 在应用退出前清理资源
app.on("before-quit", () => {
  // 关闭托盘窗口
  if (trayWindow) {
    trayWindow.destroy();
    trayWindow = null;
  }

  // 关闭服务器
  if (server) {
    try {
      server.close();
    } catch (error) {
      console.error("关闭服务器失败:", error);
    }
  }
});

// 添加这个函数
function startLocalServer() {
  // 如果服务器已经存在，先关闭
  if (server) {
    try {
      server.close();
    } catch (error) {
      console.error("关闭旧服务器失败:", error);
    }
  }

  return new Promise<number>((resolve, reject) => {
    try {
      server = http.createServer((req, res) => {
        console.log("本地服务器收到请求:", req.url);

        if (req.url && req.url.startsWith("/oauth/callback")) {
          // 设置CORS头
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

          // 处理回调
          githubService.handleCallback("http://localhost:45678" + req.url);

          // 发送响应，关闭浏览器窗口
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
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
          `);
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      // 使用随机端口或固定端口
      const port = 45678;
      server.listen(port, "127.0.0.1", () => {
        console.log(`本地OAuth回调服务器运行在 http://localhost:${port}`);
        resolve(port);
      });

      server.on("error", (err) => {
        console.error("启动本地服务器失败:", err);
        reject(err);
      });
    } catch (error) {
      console.error("创建服务器时出错:", error);
      reject(error);
    }
  });
}
