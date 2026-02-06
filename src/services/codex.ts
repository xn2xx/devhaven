import { invoke } from "@tauri-apps/api/core";

import type { CodexMonitorSnapshot } from "../models/codex";

export const CODEX_MONITOR_SNAPSHOT_EVENT = "codex-monitor-snapshot";
export const CODEX_MONITOR_AGENT_EVENT = "codex-monitor-agent-event";

/** 拉取 Codex 监控快照。 */
export async function getCodexMonitorSnapshot(): Promise<CodexMonitorSnapshot> {
  return invoke<CodexMonitorSnapshot>("get_codex_monitor_snapshot");
}
