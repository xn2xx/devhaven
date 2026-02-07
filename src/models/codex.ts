export type CodexMonitorState =
  | "offline"
  | "idle"
  | "working"
  | "completed"
  | "error"
  | "needs-attention";

export type CodexMonitorSession = {
  id: string;
  cwd: string;
  cliVersion: string | null;
  model: string | null;
  effort: string | null;
  startedAt: number;
  lastActivityAt: number;
  state: CodexMonitorState;
  isRunning: boolean;
  sessionTitle: string | null;
  details: string | null;
};

export type CodexAgentEventType =
  | "agent-start"
  | "agent-stop"
  | "agent-active"
  | "agent-idle"
  | "task-complete"
  | "task-error"
  | "needs-attention";

export type CodexAgentEvent = {
  type: CodexAgentEventType;
  agent: string;
  timestamp: number;
  details?: string | null;
  sessionId?: string | null;
  sessionTitle?: string | null;
  workingDirectory?: string | null;
};

export type CodexMonitorSnapshot = {
  sessions: CodexMonitorSession[];
  isCodexRunning: boolean;
  updatedAt: number;
};

export type CodexSessionView = CodexMonitorSession & {
  projectId: string | null;
  projectName: string | null;
  projectPath: string | null;
};
