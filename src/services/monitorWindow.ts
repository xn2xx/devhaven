import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const MONITOR_WINDOW_LABEL = "cli-monitor";
const MONITOR_WINDOW_URL = "index.html?view=monitor";

export async function openMonitorWindow(): Promise<void> {
  const existing = await WebviewWindow.getByLabel(MONITOR_WINDOW_LABEL);
  if (existing) {
    try {
      await existing.show();
      await existing.setFocus();
    } catch (error) {
      console.error("唤起悬浮窗失败。", error);
    }
    return;
  }

  const window = new WebviewWindow(MONITOR_WINDOW_LABEL, {
    url: MONITOR_WINDOW_URL,
    title: "CLI 监控",
    width: 560,
    height: 360,
    minWidth: 360,
    minHeight: 240,
    resizable: true,
    decorations: false,
    visible: true,
    focus: true,
    center: true,
    alwaysOnTop: false,
  });

  window.once("tauri://created", async () => {
    try {
      await window.show();
      await window.setFocus();
    } catch (error) {
      console.error("悬浮窗显示失败。", error);
    }
  });

  window.once("tauri://error", (event) => {
    console.error("悬浮窗创建失败。", event);
  });
}

export async function closeMonitorWindow(): Promise<void> {
  const existing = await WebviewWindow.getByLabel(MONITOR_WINDOW_LABEL);
  if (!existing) {
    return;
  }
  try {
    await existing.close();
  } catch (error) {
    console.error("关闭悬浮窗失败。", error);
  }
}
