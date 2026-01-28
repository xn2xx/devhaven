import type { ReactNode } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";

import type { WorkspaceSession } from "../models/terminal";
import { IconArrowLeft, IconTerminal, IconX } from "./Icons";

export type TabBarProps = {
  sessions: WorkspaceSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onExitWorkspace: () => void;
  readOnly?: boolean;
  rightSlot?: ReactNode;
};

/** 工作空间顶部标签栏。 */
export default function TabBar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCloseSession,
  onExitWorkspace,
  readOnly,
  rightSlot,
}: TabBarProps) {
  const handleCloseSession = async (session: WorkspaceSession) => {
    const confirmed = await confirm(
      `确定要关闭「${session.projectName}」吗？这将同时关闭对应的 tmux 会话。`,
      { title: "确认关闭", kind: "warning" },
    );
    if (!confirmed) {
      return;
    }
    onCloseSession(session.id);
  };

  return (
    <div className="workspace-header">
      {readOnly ? null : (
        <button className="icon-button workspace-back" type="button" onClick={onExitWorkspace} aria-label="返回项目列表">
          <IconArrowLeft size={16} />
        </button>
      )}
      <div className="workspace-tabs">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          return (
            <div
              key={session.id}
              className={`workspace-tab${isActive ? " is-active" : ""}`}
              title={session.projectPath}
            >
              <button
                className="workspace-tab-trigger"
                type="button"
                onClick={() => onSelectSession(session.id)}
              >
                <IconTerminal size={14} />
                <span className="workspace-tab-title">{session.projectName}</span>
              </button>
              {readOnly ? null : (
                <button
                  className="workspace-tab-close"
                  type="button"
                  aria-label={`关闭 ${session.projectName}`}
                  onClick={() => void handleCloseSession(session)}
                >
                  <IconX size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {rightSlot ? <div className="workspace-actions">{rightSlot}</div> : null}
    </div>
  );
}
