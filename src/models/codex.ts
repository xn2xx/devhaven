export type CodexMessageCounts = {
  user: number;
  agent: number;
};

export type CodexSessionSummary = {
  id: string;
  cwd: string;
  cliVersion: string | null;
  startedAt: number;
  lastActivityAt: number;
  isRunning: boolean;
  lastUserMessage: string | null;
  lastAgentMessage: string | null;
  messageCounts: CodexMessageCounts;
};

export type CodexSessionView = CodexSessionSummary & {
  projectId: string | null;
  projectName: string | null;
  projectPath: string | null;
};
