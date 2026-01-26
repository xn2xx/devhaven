export type TerminalSessionInfo = {
  id: string;
  projectId: string;
  projectPath: string;
  createdAt: number;
};

export type TmuxWindowInfo = {
  id: string;
  index: number;
  name: string;
  isActive: boolean;
  width: number;
  height: number;
};

export type TmuxPaneInfo = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  isActive: boolean;
};

export type TmuxPaneCursor = {
  col: number;
  row: number;
};

export type TmuxSupportStatus = {
  supported: boolean;
  reason?: string | null;
};

export type TmuxStatePayload = {
  kind: string;
  sessionName?: string | null;
  windowId?: string | null;
};

export type TmuxOutputPayload = {
  sessionId: string;
  paneId: string;
  data: string;
};

export type WorkspaceSession = TerminalSessionInfo & {
  projectName: string;
};
