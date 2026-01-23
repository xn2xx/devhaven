import { useCallback, useEffect, useMemo, useState } from "react";

import type { WorkspaceSession } from "../models/terminal";
import { copyToClipboard } from "../services/system";
import { useTmuxWorkspace } from "../hooks/useTmuxWorkspace";

export type TerminalPanelProps = {
  activeSession: WorkspaceSession | null;
};

const COPY_HINT_DURATION = 1600;

/** 工作空间终端展示区域。 */
export default function TerminalPanel({ activeSession }: TerminalPanelProps) {
  const {
    status,
    containerRef,
    panes,
    windows,
    activePaneId,
    activeWindowId,
    registerPane,
    focusPane,
    focusPaneDirection,
    splitActivePane,
    killActivePane,
    selectWindow,
    selectWindowIndex,
    nextWindow,
    previousWindow,
    newWindow,
  } = useTmuxWorkspace({
    activeSession,
    isVisible: Boolean(activeSession),
  });
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const attachCommand = useMemo(() => {
    if (!activeSession) {
      return null;
    }
    return `tmux attach -t ${activeSession.id}`;
  }, [activeSession]);

  const activeWindow = useMemo(
    () => windows.find((window) => window.id === activeWindowId) ?? windows.find((window) => window.isActive) ?? null,
    [activeWindowId, windows],
  );

  const handleCopyAttachCommand = useCallback(async () => {
    if (!attachCommand) {
      return;
    }
    try {
      await copyToClipboard(attachCommand);
      setCopyHint("已复制恢复命令");
      window.setTimeout(() => setCopyHint(null), COPY_HINT_DURATION);
    } catch (error) {
      console.error("复制恢复命令失败。", error);
      setCopyHint("复制失败");
      window.setTimeout(() => setCopyHint(null), COPY_HINT_DURATION);
    }
  }, [attachCommand]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !activeSession) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.key === "Process" || event.key === "Unidentified" || event.keyCode === 229) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && (event.key === "v" || event.key === "V")) {
        return;
      }
      if (!event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.code === "KeyD") {
        event.preventDefault();
        splitActivePane(event.shiftKey ? "vertical" : "horizontal");
        return;
      }
      if (event.code === "KeyW") {
        event.preventDefault();
        killActivePane();
        return;
      }
      if (event.code === "KeyT") {
        event.preventDefault();
        newWindow();
        return;
      }
      if (event.code === "BracketLeft") {
        event.preventDefault();
        previousWindow();
        return;
      }
      if (event.code === "BracketRight") {
        event.preventDefault();
        nextWindow();
        return;
      }
      if (event.code.startsWith("Digit")) {
        const digit = Number(event.code.slice(5));
        if (digit >= 1 && digit <= 9) {
          event.preventDefault();
          selectWindowIndex(digit);
          return;
        }
      }
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        focusPaneDirection("left");
        return;
      }
      if (event.code === "ArrowRight") {
        event.preventDefault();
        focusPaneDirection("right");
        return;
      }
      if (event.code === "ArrowUp") {
        event.preventDefault();
        focusPaneDirection("up");
        return;
      }
      if (event.code === "ArrowDown") {
        event.preventDefault();
        focusPaneDirection("down");
      }
    };

    container.addEventListener("keydown", handleKeyDown, true);
    return () => {
      container.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    activeSession,
    containerRef,
    focusPaneDirection,
    killActivePane,
    newWindow,
    nextWindow,
    previousWindow,
    selectWindowIndex,
    splitActivePane,
  ]);

  if (!activeSession) {
    return (
      <div className="workspace-terminal terminal-empty">
        <div>暂无可用终端</div>
        <div>双击项目卡片以创建会话</div>
      </div>
    );
  }

  const windowWidth = activeWindow?.width ?? 0;
  const windowHeight = activeWindow?.height ?? 0;

  return (
    <div className="workspace-terminal">
      <div className="workspace-windowbar">
        <div className="window-list">
          {windows.length === 0 ? (
            <div className="window-empty">暂无窗口</div>
          ) : (
            windows.map((window) => {
              const isActive = window.id === activeWindowId || window.isActive;
              return (
                <button
                  key={window.id}
                  type="button"
                  className={`window-tab${isActive ? " is-active" : ""}`}
                  onClick={() => selectWindow(window.id)}
                >
                  <span className="window-tab-index">{window.index}</span>
                  <span className="window-tab-name">{window.name || "window"}</span>
                </button>
              );
            })
          )}
        </div>
        <div className="window-actions">
          <button className="window-action-button" type="button" onClick={newWindow}>
            新建窗口
          </button>
          {attachCommand ? (
            <button className="window-action-button" type="button" onClick={handleCopyAttachCommand}>
              复制恢复命令
            </button>
          ) : null}
          {copyHint ? <span className="window-copy-hint">{copyHint}</span> : null}
        </div>
      </div>
      <div className="workspace-attach-command">
        {attachCommand ? <span>{attachCommand}</span> : null}
      </div>
      <div className="terminal-shell">
        <div ref={containerRef} className="terminal-surface">
          <div className="terminal-panes">
            {panes.map((pane) => {
              const left = windowWidth > 0 ? `${(pane.left / windowWidth) * 100}%` : "0%";
              const top = windowHeight > 0 ? `${(pane.top / windowHeight) * 100}%` : "0%";
              const width = windowWidth > 0 ? `${(pane.width / windowWidth) * 100}%` : "100%";
              const height = windowHeight > 0 ? `${(pane.height / windowHeight) * 100}%` : "100%";
              const isActive = pane.id === activePaneId;
              return (
                <div
                  key={pane.id}
                  className={`terminal-pane${isActive ? " is-active" : ""}`}
                  style={{ left, top, width, height }}
                  onMouseDown={() => focusPane(pane.id)}
                  tabIndex={0}
                >
                  <div ref={(element) => registerPane(pane.id, element)} className="terminal-pane-surface" />
                </div>
              );
            })}
          </div>
        </div>
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
