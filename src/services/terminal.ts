import { invoke } from "@tauri-apps/api/core";

import type { TerminalSessionInfo } from "../models/terminal";

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

export const getTerminalOutputEventName = (sessionId: string) => `terminal-output-${sessionId}`;

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

/** 将输入写入指定终端。 */
export async function writeToTerminal(sessionId: string, data: string): Promise<void> {
  await invoke("write_to_terminal", { sessionId, data });
}
