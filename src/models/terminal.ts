export type TerminalSessionInfo = {
  id: string;
  projectId: string;
  projectPath: string;
  createdAt: number;
};

export type WorkspaceSession = TerminalSessionInfo & {
  projectName: string;
};
