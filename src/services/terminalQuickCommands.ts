import { emitTo } from "@tauri-apps/api/event";

export const TERMINAL_QUICK_COMMAND_RUN_EVENT = "terminal-quick-command-run";
export const TERMINAL_QUICK_COMMAND_STOP_EVENT = "terminal-quick-command-stop";

export type TerminalQuickCommandRunPayload = {
  requestId: string;
  projectId: string;
  projectPath: string;
  scriptId: string;
};

export type TerminalQuickCommandStopPayload = TerminalQuickCommandRunPayload;

export type TerminalQuickCommandAction =
  | { type: "run"; payload: TerminalQuickCommandRunPayload }
  | { type: "stop"; payload: TerminalQuickCommandStopPayload };

type PendingQuickCommandAction = TerminalQuickCommandAction & {
  createdAt: number;
};

const FALLBACK_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const PENDING_TTL_MS = 15_000;
const PENDING_ACTIONS: PendingQuickCommandAction[] = [];

export function createQuickCommandRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  let value = "";
  for (let i = 0; i < 16; i += 1) {
    value += FALLBACK_ID_CHARS[Math.floor(Math.random() * FALLBACK_ID_CHARS.length)];
  }
  return value;
}

export function enqueueTerminalQuickCommandAction(action: TerminalQuickCommandAction) {
  PENDING_ACTIONS.push({ ...action, createdAt: Date.now() });
}

export function takeTerminalQuickCommandActionsForProject(projectPath: string): TerminalQuickCommandAction[] {
  if (PENDING_ACTIONS.length === 0) {
    return [];
  }
  const now = Date.now();
  const kept: PendingQuickCommandAction[] = [];
  const matched: PendingQuickCommandAction[] = [];

  for (const action of PENDING_ACTIONS) {
    if (now - action.createdAt > PENDING_TTL_MS) {
      continue;
    }
    if (action.payload.projectPath === projectPath) {
      matched.push(action);
      continue;
    }
    kept.push(action);
  }

  PENDING_ACTIONS.length = 0;
  PENDING_ACTIONS.push(...kept);

  return matched;
}

export async function emitTerminalQuickCommandRun(windowLabel: string, payload: TerminalQuickCommandRunPayload) {
  await emitTo(windowLabel, TERMINAL_QUICK_COMMAND_RUN_EVENT, payload);
}

export async function emitTerminalQuickCommandStop(windowLabel: string, payload: TerminalQuickCommandStopPayload) {
  await emitTo(windowLabel, TERMINAL_QUICK_COMMAND_STOP_EVENT, payload);
}

