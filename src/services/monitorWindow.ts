import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { MONITOR_COLLAPSED_SIZE } from "../constants/monitorWindow";

const MONITOR_WINDOW_LABEL = "cli-monitor";
const MONITOR_WINDOW_URL = "index.html?view=monitor";

async function enableMonitorWindowFullscreenAuxiliary(): Promise<void> {
  try {
    await invoke("set_window_fullscreen_auxiliary", {
      windowLabel: MONITOR_WINDOW_LABEL,
      enabled: true,
    });
  } catch (error) {
    console.error("设置悬浮窗全屏辅助显示失败。", error);
  }
}

export async function openMonitorWindow(): Promise<void> {
  const existing = await WebviewWindow.getByLabel(MONITOR_WINDOW_LABEL);
  if (existing) {
    try {
      await existing.setAlwaysOnTop(true).catch(() => undefined);
      await enableMonitorWindowFullscreenAuxiliary();
      await existing.setVisibleOnAllWorkspaces(true).catch(() => undefined);
      await existing.show();
      await existing.setFocus();
    } catch (error) {
      console.error("唤起悬浮窗失败。", error);
    }
    return;
  }

  const window = new WebviewWindow(MONITOR_WINDOW_LABEL, {
    url: MONITOR_WINDOW_URL,
    title: "悬浮监控",
    width: MONITOR_COLLAPSED_SIZE.width,
    height: MONITOR_COLLAPSED_SIZE.height,
    resizable: false,
    decorations: false,
    visible: false,
    focus: true,
    center: true,
    alwaysOnTop: true,
    visibleOnAllWorkspaces: true,
    transparent: true,
    shadow: false,
    skipTaskbar: true,
  });

  window.once("tauri://created", async () => {
    try {
      await window.setAlwaysOnTop(true).catch(() => undefined);
      await enableMonitorWindowFullscreenAuxiliary();
      await window.setVisibleOnAllWorkspaces(true).catch(() => undefined);
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
