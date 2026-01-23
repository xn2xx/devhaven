import { invoke } from "@tauri-apps/api/core";

import type {
  TerminalSessionInfo,
  TmuxPaneInfo,
  TmuxSupportStatus,
  TmuxWindowInfo,
} from "../models/terminal";

type TerminalSessionPayload = {
  id: string;
  project_id: string;
  project_path: string;
  created_at: number;
};

const normalizeSession = (payload: TerminalSessionPayload): TerminalSessionInfo => ({
  id: payload.id,
  projectId: payload.project_id,
  projectPath: payload.project_path,
  createdAt: payload.created_at,
});

export const TMUX_OUTPUT_EVENT = "tmux-output";
export const TMUX_STATE_EVENT = "tmux-state";

/** 获取 tmux 控制模式支持状态。 */
export async function getTmuxSupportStatus(): Promise<TmuxSupportStatus> {
  return invoke<TmuxSupportStatus>("get_tmux_support_status");
}

/** 创建或复用 tmux 会话并返回会话信息。 */
export async function createTerminalSession(projectId: string, projectPath: string): Promise<TerminalSessionInfo> {
  const payload = await invoke<TerminalSessionPayload>("create_terminal_session", {
    projectId,
    projectPath,
  });
  return normalizeSession(payload);
}

/** 切换当前 tmux 会话。 */
export async function switchTerminalSession(sessionId: string): Promise<void> {
  await invoke("switch_terminal_session", { sessionId });
}

/** 关闭终端标签页（不销毁 tmux 会话）。 */
export async function closeTerminalSession(sessionId: string): Promise<void> {
  await invoke("close_terminal_session", { sessionId });
}

/** 获取当前会话的窗口列表。 */
export async function listTmuxWindows(sessionId: string): Promise<TmuxWindowInfo[]> {
  return invoke<TmuxWindowInfo[]>("list_tmux_windows", { sessionId });
}

/** 获取指定窗口的 pane 布局。 */
export async function listTmuxPanes(windowId: string): Promise<TmuxPaneInfo[]> {
  return invoke<TmuxPaneInfo[]>("list_tmux_panes", { windowId });
}

/** 发送输入到指定 pane。 */
export async function sendTmuxInput(paneId: string, data: string): Promise<void> {
  await invoke("send_tmux_input", { paneId, data });
}

/** 创建分屏。 */
export async function splitTmuxPane(paneId: string, direction: "horizontal" | "vertical"): Promise<void> {
  await invoke("split_tmux_pane", { paneId, direction });
}

/** 切换 pane。 */
export async function selectTmuxPane(paneId: string): Promise<void> {
  await invoke("select_tmux_pane", { paneId });
}

/** 按方向切换 pane。 */
export async function selectTmuxPaneDirection(
  paneId: string,
  direction: "left" | "right" | "up" | "down",
): Promise<void> {
  await invoke("select_tmux_pane_direction", { paneId, direction });
}

/** 关闭 pane。 */
export async function killTmuxPane(paneId: string): Promise<void> {
  await invoke("kill_tmux_pane", { paneId });
}

/** 新建窗口。 */
export async function newTmuxWindow(sessionId: string, projectPath: string): Promise<void> {
  await invoke("new_tmux_window", { sessionId, projectPath });
}

/** 切换窗口。 */
export async function selectTmuxWindow(windowId: string): Promise<void> {
  await invoke("select_tmux_window", { windowId });
}

/** 切换窗口序号。 */
export async function selectTmuxWindowIndex(sessionId: string, windowIndex: number): Promise<void> {
  await invoke("select_tmux_window_index", { sessionId, windowIndex });
}

/** 切换到下一个窗口。 */
export async function nextTmuxWindow(): Promise<void> {
  await invoke("next_tmux_window");
}

/** 切换到上一个窗口。 */
export async function previousTmuxWindow(): Promise<void> {
  await invoke("previous_tmux_window");
}

/** 同步 tmux 控制客户端大小。 */
export async function resizeTmuxClient(cols: number, rows: number): Promise<void> {
  await invoke("resize_tmux_client", { cols, rows });
}

/** 拉取 pane 历史缓冲。 */
export async function captureTmuxPane(paneId: string): Promise<string> {
  return invoke<string>("capture_tmux_pane", { paneId });
}
