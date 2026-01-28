import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { CodexSessionView } from "../models/codex";
import CodexSessionSection from "./CodexSessionSection";
import { IconX } from "./Icons";

type MonitorWindowProps = {
  sessions: CodexSessionView[];
  isLoading: boolean;
  error: string | null;
  onOpenSession: (session: CodexSessionView) => void;
};

/** 只读悬浮监控窗视图。 */
export default function MonitorWindow({
  sessions,
  isLoading,
  error,
  onOpenSession,
}: MonitorWindowProps) {
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);

  useEffect(() => {
    const window = getCurrentWindow();
    window
      .isAlwaysOnTop()
      .then((value) => setAlwaysOnTop(value))
      .catch((error) => {
        console.error("获取置顶状态失败。", error);
      });
  }, []);

  const handleToggleAlwaysOnTop = async (nextValue: boolean) => {
    setAlwaysOnTop(nextValue);
    const window = getCurrentWindow();
    try {
      await window.setAlwaysOnTop(nextValue);
    } catch (error) {
      console.error("设置置顶失败。", error);
    }
    if (isMac) {
      try {
        await window.setVisibleOnAllWorkspaces(nextValue);
      } catch (error) {
        console.error("设置跨工作区显示失败。", error);
      }
    }
  };

  const handleCloseWindow = async () => {
    try {
      await getCurrentWindow().close();
    } catch (error) {
      console.error("关闭悬浮窗失败。", error);
    }
  };

  const handleHeaderMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-no-drag]")) {
      return;
    }
    void getCurrentWindow().startDragging().catch((error) => {
      console.error("拖拽悬浮窗失败。", error);
    });
  };

  const headerStatus = isLoading ? "同步中..." : sessions.length > 0 ? `${sessions.length} 个` : "暂无";

  return (
    <div className="monitor-root">
      <div className="section-header monitor-header" data-tauri-drag-region onMouseDown={handleHeaderMouseDown}>
        <div className="monitor-header-title" data-tauri-drag-region>
          <span className="section-title">CLI 监控</span>
          <span className="cli-session-header-status">{headerStatus}</span>
        </div>
        <div className="monitor-actions" data-no-drag>
          <label className="monitor-toggle" data-no-drag>
            <input
              type="checkbox"
              checked={alwaysOnTop}
              onChange={(event) => handleToggleAlwaysOnTop(event.target.checked)}
            />
            <span>置顶</span>
          </label>
          <button
            className="icon-button"
            type="button"
            onClick={() => void handleCloseWindow()}
            aria-label="关闭悬浮窗"
            data-no-drag
          >
            <IconX size={14} />
          </button>
        </div>
      </div>
      <div className="monitor-body">
        <CodexSessionSection
          sessions={sessions}
          isLoading={isLoading}
          error={error}
          onOpenSession={onOpenSession}
          emptyText="暂无运行中的 Codex 会话"
          showHeader={false}
        />
      </div>
    </div>
  );
}
