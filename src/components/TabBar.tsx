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
    <div className="flex items-center gap-3 border-b border-divider bg-search-area-bg px-3 py-2.5">
      {readOnly ? null : (
        <button className="icon-btn text-titlebar-icon" type="button" onClick={onExitWorkspace} aria-label="返回项目列表">
          <IconArrowLeft size={16} />
        </button>
      )}
      <div className="flex flex-1 items-center gap-2 overflow-x-auto">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          return (
            <div
              key={session.id}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-1.5 py-1 text-secondary-text ${
                isActive
                  ? "border-accent bg-[rgba(69,59,231,0.2)] text-text"
                  : "border-border bg-card-bg"
              }`}
              title={session.projectPath}
            >
              <button
                className="inline-flex items-center gap-1.5 px-1 py-0.5 text-fs-caption"
                type="button"
                onClick={() => onSelectSession(session.id)}
              >
                <IconTerminal size={14} />
                <span className="max-w-[160px] truncate">{session.projectName}</span>
              </button>
              {readOnly ? null : (
                <button
                  className="inline-flex items-center justify-center p-0.5 opacity-60 hover:opacity-100"
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
      {rightSlot ? <div className="inline-flex items-center gap-2">{rightSlot}</div> : null}
    </div>
  );
}
