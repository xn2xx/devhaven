import { emitTo } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { Project } from "../models/types";

export const TERMINAL_WINDOW_LABEL = "terminal";
export const TERMINAL_OPEN_PROJECT_EVENT = "terminal-open-project";

export type TerminalOpenProjectPayload = {
  projectId: string | null;
  projectPath: string;
  projectName: string | null;
};

function buildTerminalUrl(project?: Project) {
  const params = new URLSearchParams({ view: "terminal" });
  if (project) {
    params.set("projectId", project.id);
    params.set("projectPath", project.path);
    params.set("projectName", project.name);
  }
  return `index.html?${params.toString()}`;
}

export async function openTerminalWorkspaceWindow(project: Project): Promise<void> {
  const existing = await WebviewWindow.getByLabel(TERMINAL_WINDOW_LABEL);
  if (existing) {
    await existing.show().catch(() => undefined);
    await existing.setFocus().catch(() => undefined);
    await emitTo<TerminalOpenProjectPayload>(TERMINAL_WINDOW_LABEL, TERMINAL_OPEN_PROJECT_EVENT, {
      projectId: project.id,
      projectPath: project.path,
      projectName: project.name,
    }).catch(() => undefined);
    return;
  }
  const window = new WebviewWindow(TERMINAL_WINDOW_LABEL, {
    url: buildTerminalUrl(project),
    title: "终端",
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
