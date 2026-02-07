import { invoke } from "@tauri-apps/api/core";
import type { TerminalWorkspace, TerminalWorkspaceSummary } from "../models/terminal";

export async function loadTerminalWorkspace(projectPath: string): Promise<TerminalWorkspace | null> {
  return invoke<TerminalWorkspace | null>("load_terminal_workspace", { projectPath });
}

export async function saveTerminalWorkspace(projectPath: string, workspace: TerminalWorkspace): Promise<void> {
  await invoke("save_terminal_workspace", { projectPath, workspace });
}

export async function deleteTerminalWorkspace(projectPath: string): Promise<void> {
  await invoke("delete_terminal_workspace", { projectPath });
}

export async function listTerminalWorkspaceSummaries(): Promise<TerminalWorkspaceSummary[]> {
  return invoke<TerminalWorkspaceSummary[]>("list_terminal_workspace_summaries");
}
