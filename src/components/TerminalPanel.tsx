import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import type { WorkspaceSession } from "../models/terminal";
import { copyToClipboard } from "../services/system";
import { useTmuxWorkspace } from "../hooks/useTmuxWorkspace";

export type TerminalPanelProps = {
  sessions: WorkspaceSession[];
  activeSession: WorkspaceSession | null;
  terminalUseWebglRenderer: boolean;
};

const COPY_HINT_DURATION = 1600;

type DividerOrientation = "vertical" | "horizontal";

type Divider = {
  id: string;
  orientation: DividerOrientation;
  paneId: string;
  position: number;
  start: number;
  length: number;
};

type DividerDragState = {
  divider: Divider;
  startX: number;
  startY: number;
  cellWidth: number;
  cellHeight: number;
  lastDelta: number;
  previousUserSelect: string;
};

/** 工作空间终端展示区域。 */
export default function TerminalPanel({ sessions, activeSession, terminalUseWebglRenderer }: TerminalPanelProps) {
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
    resizePane,
    splitActivePane,
    killActivePane,
    selectWindowIndex,
    nextWindow,
    previousWindow,
  } = useTmuxWorkspace({
    activeSession,
    isVisible: Boolean(activeSession),
    useWebglRenderer: terminalUseWebglRenderer,
    sessionIds: sessions.map((session) => session.id),
  });
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [draggingDividerId, setDraggingDividerId] = useState<string | null>(null);
  const dividerDragRef = useRef<DividerDragState | null>(null);
  const dividerDragHandlersRef = useRef<{ move: (event: PointerEvent) => void; up: () => void } | null>(null);

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

  const windowWidth = activeWindow?.width ?? 0;
  const windowHeight = activeWindow?.height ?? 0;

  const dividers = useMemo(() => {
    if (!activeSession || windowWidth <= 0 || windowHeight <= 0) {
      return [];
    }
    const nextDividers: Divider[] = [];
    panes.forEach((pane) => {
      const paneRight = pane.left + pane.width;
      const paneBottom = pane.top + pane.height;
      panes.forEach((other) => {
        if (pane.id === other.id) {
          return;
        }
        const verticalGap = other.left - paneRight;
        if (verticalGap >= 0 && verticalGap <= 1) {
          const overlapTop = Math.max(pane.top, other.top);
          const overlapBottom = Math.min(paneBottom, other.top + other.height);
          if (overlapBottom > overlapTop) {
            const position = (paneRight + other.left) / 2;
            nextDividers.push({
              id: `v-${pane.id}-${other.id}-${overlapTop}`,
              orientation: "vertical",
              paneId: pane.id,
              position: (position / windowWidth) * 100,
              start: (overlapTop / windowHeight) * 100,
              length: ((overlapBottom - overlapTop) / windowHeight) * 100,
            });
          }
        }
        const horizontalGap = other.top - paneBottom;
        if (horizontalGap >= 0 && horizontalGap <= 1) {
          const overlapLeft = Math.max(pane.left, other.left);
          const overlapRight = Math.min(paneRight, other.left + other.width);
          if (overlapRight > overlapLeft) {
            const position = (paneBottom + other.top) / 2;
            nextDividers.push({
              id: `h-${pane.id}-${other.id}-${overlapLeft}`,
              orientation: "horizontal",
              paneId: pane.id,
              position: (position / windowHeight) * 100,
              start: (overlapLeft / windowWidth) * 100,
              length: ((overlapRight - overlapLeft) / windowWidth) * 100,
            });
          }
        }
      });
    });
    return nextDividers;
  }, [activeSession, panes, windowHeight, windowWidth]);

  const stopDividerDrag = useCallback(() => {
    if (dividerDragHandlersRef.current) {
      window.removeEventListener("pointermove", dividerDragHandlersRef.current.move);
      window.removeEventListener("pointerup", dividerDragHandlersRef.current.up);
      dividerDragHandlersRef.current = null;
    }
    if (dividerDragRef.current) {
      document.body.style.userSelect = dividerDragRef.current.previousUserSelect;
      dividerDragRef.current = null;
      setDraggingDividerId(null);
    }
  }, []);

  const handleDividerPointerDown = useCallback(
    (divider: Divider, event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      const container = containerRef.current;
      if (!container || windowWidth <= 0 || windowHeight <= 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const rect = container.getBoundingClientRect();
      const cellWidth = rect.width / windowWidth;
      const cellHeight = rect.height / windowHeight;
      if (!cellWidth || !cellHeight) {
        return;
      }
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = "none";
      dividerDragRef.current = {
        divider,
        startX: event.clientX,
        startY: event.clientY,
        cellWidth,
        cellHeight,
        lastDelta: 0,
        previousUserSelect,
      };
      setDraggingDividerId(divider.id);

      const move = (moveEvent: PointerEvent) => {
        const dragState = dividerDragRef.current;
        if (!dragState) {
          return;
        }
        const deltaPixels =
          dragState.divider.orientation === "vertical"
            ? moveEvent.clientX - dragState.startX
            : moveEvent.clientY - dragState.startY;
        const cellSize =
          dragState.divider.orientation === "vertical" ? dragState.cellWidth : dragState.cellHeight;
        const deltaCells = Math.round(deltaPixels / cellSize);
        const deltaDiff = deltaCells - dragState.lastDelta;
        if (deltaDiff === 0) {
          return;
        }
        dragState.lastDelta = deltaCells;
        const direction =
          dragState.divider.orientation === "vertical"
            ? deltaDiff > 0
              ? "right"
              : "left"
            : deltaDiff > 0
              ? "down"
              : "up";
        resizePane(dragState.divider.paneId, direction, Math.abs(deltaDiff));
      };

      const up = () => {
        stopDividerDrag();
      };

      dividerDragHandlersRef.current = { move, up };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [containerRef, resizePane, stopDividerDrag, windowHeight, windowWidth],
  );

  useEffect(() => stopDividerDrag, [stopDividerDrag]);

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

  return (
    <div className="workspace-terminal">
      <div className="workspace-windowbar">
        <div className="window-actions">
          {attachCommand ? (
            <>
              <button className="window-action-button" type="button" onClick={handleCopyAttachCommand}>
                复制恢复命令
              </button>
              <span className="window-attach-command">{attachCommand}</span>
            </>
          ) : null}
          {copyHint ? <span className="window-copy-hint">{copyHint}</span> : null}
        </div>
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
            {dividers.map((divider) => {
              const position = `${divider.position}%`;
              const start = `${divider.start}%`;
              const length = `${divider.length}%`;
              const style =
                divider.orientation === "vertical"
                  ? { left: position, top: start, height: length }
                  : { top: position, left: start, width: length };
              return (
                <div
                  key={divider.id}
                  className={`terminal-divider is-${divider.orientation}${
                    draggingDividerId === divider.id ? " is-dragging" : ""
                  }`}
                  style={style}
                  role="separator"
                  aria-orientation={divider.orientation === "vertical" ? "vertical" : "horizontal"}
                  onPointerDown={(event) => handleDividerPointerDown(divider, event)}
                />
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
