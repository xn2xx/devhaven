import type { WorkspaceSession } from "../models/terminal";
import { useTerminalSession } from "../hooks/useTerminalSession";

export type TerminalPanelProps = {
  activeSession: WorkspaceSession | null;
};

/** 工作空间终端展示区域。 */
export default function TerminalPanel({ activeSession }: TerminalPanelProps) {
  const { status, containerRef } = useTerminalSession({
    activeSessionId: activeSession?.id ?? null,
    isVisible: Boolean(activeSession),
  });

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
      <div className="terminal-shell">
        <div ref={containerRef} className="terminal-surface" />
        {status !== "ready" && (
          <div className="terminal-overlay">
            <div className="terminal-status">
              {(status === "idle" || status === "preparing") && "正在准备终端..."}
              {status === "connecting" && "正在连接终端..."}
              {status === "error" && "终端启动失败"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
