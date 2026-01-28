import type { ReactNode } from "react";
import type { CodexSessionView } from "../models/codex";

export type CodexSessionSectionProps = {
  sessions: CodexSessionView[];
  isLoading: boolean;
  error: string | null;
  onOpenSession: (session: CodexSessionView) => void;
  title?: string;
  emptyText?: string;
  showHeader?: boolean;
  headerRightSlot?: ReactNode;
};

/** 侧栏 Codex CLI 会话区块。 */
export default function CodexSessionSection({
  sessions,
  isLoading,
  error,
  onOpenSession,
  title = "CLI 会话",
  emptyText = "未发现 Codex 会话",
  showHeader = true,
  headerRightSlot,
}: CodexSessionSectionProps) {
  const headerStatus = isLoading ? "同步中..." : sessions.length > 0 ? `${sessions.length} 个` : "暂无";
  const shouldShowHeader = showHeader;
  const resolvedEmptyText = emptyText;

  return (
    <section className="sidebar-section cli-session-section">
      {shouldShowHeader ? (
        <div className="section-header">
          <span className="section-title">{title}</span>
          <div className="cli-session-header-right">
            <span className="cli-session-header-status">{headerStatus}</span>
            {headerRightSlot}
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="cli-session-empty">{`会话读取失败：${error}`}</div>
      ) : sessions.length === 0 ? (
        <div className="cli-session-empty">{resolvedEmptyText}</div>
      ) : (
        <div className="cli-session-list">
          {sessions.map((session) => {
            const preview = buildPreview(session.lastAgentMessage ?? session.lastUserMessage ?? "");
            const projectName = session.projectName ?? "未匹配项目";
            const disabled = !session.projectId;
            return (
              <button
                key={session.id}
                className={`cli-session-row${session.isRunning ? " is-running" : ""}${disabled ? " is-disabled" : ""}`}
                type="button"
                onClick={() => onOpenSession(session)}
                disabled={disabled}
                title={disabled ? "无法匹配项目" : session.cwd}
              >
                <div className="cli-session-content">
                  <div className="cli-session-title">
                    <span
                      className={`cli-session-dot${session.isRunning ? " is-running" : ""}`}
                      aria-hidden="true"
                    />
                    <span className="cli-session-name">{projectName}</span>
                    <span className={`cli-session-status${session.isRunning ? " is-running" : ""}`}>
                      {session.isRunning ? "运行中" : "空闲"}
                    </span>
                  </div>
                  <div className="cli-session-path" title={session.cwd}>
                    {session.cwd || "未知路径"}
                  </div>
                  <div className="cli-session-message">
                    {preview.length > 0 ? preview : "暂无消息"}
                  </div>
                </div>
                <div className="cli-session-meta">{formatTime(session.lastActivityAt)}</div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

const PREVIEW_MAX = 80;

function buildPreview(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= PREVIEW_MAX) {
    return normalized;
  }
  return `${normalized.slice(0, PREVIEW_MAX)}...`;
}

function formatTime(timestamp: number) {
  if (!timestamp) {
    return "--";
  }
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
