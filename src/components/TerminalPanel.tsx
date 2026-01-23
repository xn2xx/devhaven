import type { WorkspaceSession } from "../models/terminal";
import XtermTerminal from "./XtermTerminal";

export type TerminalPanelProps = {
  activeSession: WorkspaceSession | null;
};

/** 工作空间终端展示区域。 */
export default function TerminalPanel({ activeSession }: TerminalPanelProps) {
  if (!activeSession) {
    return (
      <div className="workspace-terminal terminal-empty">
        <div>暂无可用终端</div>
        <div>双击项目卡片以创建会话</div>
      </div>
    );
  }

  return (
    <div className="workspace-terminal">
      <XtermTerminal sessionId={activeSession.id} />
    </div>
  );
}
