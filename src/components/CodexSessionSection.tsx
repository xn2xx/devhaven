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
  variant?: "sidebar" | "monitor";
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
  variant = "sidebar",
}: CodexSessionSectionProps) {
  const headerStatus = isLoading ? "同步中..." : sessions.length > 0 ? `${sessions.length} 个` : "暂无";
  const shouldShowHeader = showHeader;
  const resolvedEmptyText = emptyText;
  const isMonitor = variant === "monitor";
  const listClassName = isMonitor
    ? "flex flex-col gap-2.5"
    : "flex flex-col gap-1.5 px-2 pb-2";
  const emptyClassName = isMonitor
    ? "text-fs-caption text-sidebar-secondary"
    : "px-4 pb-2 text-fs-caption text-sidebar-secondary";
  const rowClassName = isMonitor
    ? "flex w-full items-start gap-2 rounded-xl border border-[rgba(148,163,184,0.16)] bg-[rgba(15,23,42,0.6)] px-2.5 py-2 text-left text-sidebar-title transition-colors duration-150 hover:border-[rgba(99,102,241,0.35)] hover:bg-[rgba(30,41,59,0.8)] disabled:cursor-not-allowed disabled:opacity-50"
    : "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sidebar-title transition-colors duration-150 hover:bg-sidebar-hover disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section className={isMonitor ? "" : "pb-3"}>
      {shouldShowHeader ? (
        <div className="section-header">
          <span className="section-title">{title}</span>
          <div className="inline-flex items-center gap-2">
            <span className="text-[11px] text-sidebar-secondary">{headerStatus}</span>
            {headerRightSlot}
          </div>
        </div>
      ) : null}
      {error ? (
        <div className={emptyClassName}>{`会话读取失败：${error}`}</div>
      ) : sessions.length === 0 ? (
        resolvedEmptyText ? (
          <div className={emptyClassName}>{resolvedEmptyText}</div>
        ) : null
      ) : (
        <div className={listClassName}>
          {sessions.map((session) => {
            const preview = buildPreview(session.lastAgentMessage ?? session.lastUserMessage ?? "");
            const projectName = session.projectName ?? "未匹配项目";
            const disabled = !session.projectId;
            return (
              <button
                key={session.id}
                className={rowClassName}
                type="button"
                onClick={() => onOpenSession(session)}
                disabled={disabled}
                title={disabled ? "无法匹配项目" : session.cwd}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex min-w-0 items-center gap-1.5 text-fs-caption">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        session.isRunning ? "bg-success" : "bg-sidebar-secondary"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate font-semibold">{projectName}</span>
                    <span
                      className={`text-[11px] ${
                        session.isRunning ? "text-success" : "text-sidebar-secondary"
                      }`}
                    >
                      {session.isRunning ? "运行中" : "空闲"}
                    </span>
                  </div>
                  <div className="truncate text-[11px] text-sidebar-secondary" title={session.cwd}>
                    {session.cwd || "未知路径"}
                  </div>
                  <div className="truncate text-[11px] text-secondary-text">
                    {preview.length > 0 ? preview : "暂无消息"}
                  </div>
                </div>
                <div className="mt-0.5 whitespace-nowrap text-[11px] text-sidebar-secondary">
                  {formatTime(session.lastActivityAt)}
                </div>
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
