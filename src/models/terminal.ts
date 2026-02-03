export type SplitOrientation = "h" | "v";
export type SplitDirection = "r" | "b" | "l" | "t";

export type SplitNode =
  | {
      type: "pane";
      sessionId: string;
    }
  | {
      type: "split";
      orientation: SplitOrientation;
      ratios: number[];
      children: SplitNode[];
    };

export type TerminalTab = {
  id: string;
  title: string;
  root: SplitNode;
  activeSessionId: string;
};

export type TerminalSessionSnapshot = {
  id: string;
  cwd: string;
  savedState?: string | null;
};

export type TerminalWorkspace = {
  version: number;
  projectId: string | null;
  projectPath: string;
  tabs: TerminalTab[];
  activeTabId: string;
  sessions: Record<string, TerminalSessionSnapshot>;
  updatedAt: number;
};
