export type CodexSessionSummary = {
  id: string;
  cwd: string;
  cliVersion: string | null;
  startedAt: number;
  lastActivityAt: number;
  isRunning: boolean;
};

export type CodexSessionView = CodexSessionSummary & {
  projectId: string | null;
  projectName: string | null;
  projectPath: string | null;
};
