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
  sessionId?: string | null;
  sessionName?: string | null;
  windowId?: string | null;
  windowName?: string | null;
  windowIndex?: string | null;
  paneId?: string | null;
  client?: string | null;
  message?: string | null;
  bufferName?: string | null;
  subscriptionName?: string | null;
  subscriptionValue?: string | null;
  subscriptionSessionId?: string | null;
  subscriptionWindowId?: string | null;
  subscriptionWindowIndex?: string | null;
  subscriptionPaneId?: string | null;
  layout?: string | null;
  visibleLayout?: string | null;
  windowFlags?: string | null;
  reason?: string | null;
};

export type TmuxSubscriptionSpec = {
  name: string;
  what?: string | null;
  format?: string | null;
};

export type TmuxOutputPayload = {
  sessionId: string;
  paneId: string;
  data: string;
};

export type WorkspaceSession = TerminalSessionInfo & {
  projectName: string;
};
