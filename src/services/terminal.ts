import { invoke } from "@tauri-apps/api/core";

import type { TerminalSessionInfo } from "../models/terminal";

type TerminalSessionPayload = {
  id: string;
  project_id: string;
  project_path: string;
  created_at: number;
};

export type TerminalOutputPayload = {
  sessionId: string;
  data: string;
};

const normalizeSession = (payload: TerminalSessionPayload): TerminalSessionInfo => ({
  id: payload.id,
  projectId: payload.project_id,
  projectPath: payload.project_path,
  createdAt: payload.created_at,
});

export const TERMINAL_OUTPUT_EVENT = "terminal-output";

/** 创建终端会话并返回会话信息。 */
export async function createTerminalSession(projectId: string, projectPath: string): Promise<TerminalSessionInfo> {
  const payload = await invoke<TerminalSessionPayload>("create_terminal_session", {
    projectId,
    projectPath,
  });
  return normalizeSession(payload);
}

/** 获取当前活跃的终端会话列表。 */
export async function listTerminalSessions(): Promise<TerminalSessionInfo[]> {
  const payload = await invoke<TerminalSessionPayload[]>("list_terminal_sessions");
  return payload.map(normalizeSession);
}

/** 关闭终端会话。 */
export async function closeTerminalSession(sessionId: string): Promise<void> {
  await invoke("close_terminal_session", { sessionId });
}

/** 切换当前终端会话。 */
export async function switchTerminalSession(sessionId: string): Promise<void> {
  await invoke("switch_terminal_session", { sessionId });
}

/** 将输入写入终端。 */
export async function writeToTerminal(data: string): Promise<void> {
  await invoke("write_to_terminal", { data });
}

/** 调整终端会话大小。 */
export async function resizeTerminalSession(cols: number, rows: number): Promise<void> {
  await invoke("resize_terminal_session", { cols, rows });
}
