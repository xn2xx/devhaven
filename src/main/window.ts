import { BrowserWindow } from "electron";
import path from "path";
import { enable } from "@electron/remote/main";
import * as settingsService from "./settings-service";
// 全局窗口引用，避免垃圾回收
let mainWindow: BrowserWindow | null = null;
let trayWindow: BrowserWindow | null = null;

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
      preload: path.join(__dirname, "../preload/index.js")
    }
  });

  // 为该窗口启用远程模块
  enable(mainWindow.webContents);

  // 加载应用
  if (process.env.NODE_ENV === "development") {
    // 开发模式：从Vite开发服务器加载
    mainWindow.loadURL("http://localhost:5173");
    // 打开开发者工具
    // mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：加载本地文件
    mainWindow.loadFile(path.join(__dirname, "../../out/renderer/index.html"));
  }

  // 处理窗口关闭事件
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

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
    backgroundColor: "#00000000", // 完全透明背景
    // macOS特定配置
    titleBarStyle: "hidden", // 统一使用hidden样式
    hasShadow: false, // 禁用阴影以提高透明效果
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload/index.js")
    }
  });

  // 为该窗口启用远程模块
  enable(trayWindow.webContents);
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
  trayWindow.webContents.on("did-finish-load", () => {
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
      }).catch(err => console.error("获取内容高度失败:", err));
    }, 300);
  });

  // 设置窗口始终在最前面 (最高级别的置顶)
  trayWindow.setAlwaysOnTop(true, "screen-saver", 1); // 使用level 1表示最高层级

  // 设置窗口在所有工作区都可见
  trayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // 在macOS上，设置窗口层级为浮动面板，这有助于在全屏应用上方显示
  if (process.platform === "darwin") {
    trayWindow.setWindowButtonVisibility(true); // 显示窗口按钮以便于拖动
    // 确保窗口可以显示在全屏应用的上方
    trayWindow.setAlwaysOnTop(true, "floating", 1);

    // 确保窗口背景透明
    trayWindow.setBackgroundColor("#00000000");
    trayWindow.setOpacity(1.0); // 设置完全不透明度（透明由backgroundColor控制）
  }

  // 根据设置决定是否显示悬浮窗
  const showTrayWindow = settingsService.getTrayWindowSetting();
  if (!showTrayWindow && trayWindow) {
    trayWindow.hide();
  }
}

/**
 * 获取主窗口实例
 * @returns {BrowserWindow|null} 主窗口实例或null
 */
function getMainWindow() {
  return mainWindow;
}

/**
 * 获取托盘窗口实例
 * @returns {BrowserWindow|null} 托盘窗口实例或null
 */
function getTrayWindow() {
  if (!trayWindow || trayWindow.isDestroyed()) {
    createTrayWindow();
  }
  return trayWindow;
}


export { createWindow, getMainWindow, getTrayWindow, createTrayWindow };
