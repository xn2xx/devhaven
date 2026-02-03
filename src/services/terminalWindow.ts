import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { Project } from "../models/types";

const TERMINAL_WINDOW_PREFIX = "terminal-";

function buildTerminalUrl(project: Project) {
  const params = new URLSearchParams({
    view: "terminal",
    projectId: project.id,
    projectPath: project.path,
    projectName: project.name,
  });
  return `index.html?${params.toString()}`;
}

export async function openTerminalWorkspaceWindow(project: Project): Promise<void> {
  const label = `${TERMINAL_WINDOW_PREFIX}${project.id}`;
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.show().catch(() => undefined);
    await existing.setFocus().catch(() => undefined);
    return;
  }
  const window = new WebviewWindow(label, {
    url: buildTerminalUrl(project),
    title: `${project.name} - 终端`,
    width: 1000,
    height: 720,
    minWidth: 640,
    minHeight: 420,
    resizable: true,
    center: true,
  });
  window.once("tauri://created", async () => {
    await window.show().catch(() => undefined);
    await window.setFocus().catch(() => undefined);
  });
  window.once("tauri://error", (event) => {
    console.error("终端窗口创建失败。", event);
  });
}

export function getTerminalWindowLabel(projectId: string | null) {
  if (!projectId) {
    return "terminal";
  }
  return `${TERMINAL_WINDOW_PREFIX}${projectId}`;
}
