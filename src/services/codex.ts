import { invoke } from "@tauri-apps/api/core";

import type { CodexSessionSummary } from "../models/codex";

export const CODEX_SESSIONS_EVENT = "codex-sessions-update";

/** 拉取 Codex CLI 会话摘要列表。 */
export async function listCodexSessions(): Promise<CodexSessionSummary[]> {
  return invoke<CodexSessionSummary[]>("list_codex_sessions");
}
