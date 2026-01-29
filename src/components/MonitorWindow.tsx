import type { MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { LogicalSize, PhysicalPosition, cursorPosition, getCurrentWindow } from "@tauri-apps/api/window";

import type { CodexSessionView } from "../models/codex";
import { MONITOR_COLLAPSED_SIZE, MONITOR_EXPANDED_SIZE } from "../constants/monitorWindow";
import CodexSessionSection from "./CodexSessionSection";

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
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(false);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const mascotButtonRef = useRef<HTMLButtonElement | null>(null);
  const mascotPointerRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const collapseTimerRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const pollingRef = useRef(false);
  const COLLAPSE_DELAY = 120;
  const HOVER_POLL_INTERVAL = 120;
  const canExpand = isLoading || sessions.length > 0;

  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

  useEffect(() => {
    if (canExpand || !isExpandedRef.current) {
      return;
    }
    cancelCollapse();
    collapseWindow();
  }, [canExpand]);

  const cancelCollapse = () => {
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  };

  const scheduleCollapse = (reset: boolean) => {
    if (collapseTimerRef.current !== null) {
      if (!reset) {
        return;
      }
      window.clearTimeout(collapseTimerRef.current);
    }
    collapseTimerRef.current = window.setTimeout(() => {
      collapseTimerRef.current = null;
      collapseWindow();
    }, COLLAPSE_DELAY);
  };

  useEffect(() => {
    const tauriWindow = getCurrentWindow();
    tauriWindow
      .setAlwaysOnTop(true)
      .catch((error) => {
        console.error("设置置顶失败。", error);
      });
    if (isMac) {
      tauriWindow
        .setVisibleOnAllWorkspaces(true)
        .catch((error) => {
          console.error("设置跨工作区显示失败。", error);
        });
    }
    tauriWindow
      .setResizable(false)
      .catch((error) => {
        console.error("设置悬浮窗大小锁定失败。", error);
      });
    tauriWindow
      .setSize(new LogicalSize(MONITOR_COLLAPSED_SIZE.width, MONITOR_COLLAPSED_SIZE.height))
      .catch((error) => {
        console.error("设置悬浮窗初始大小失败。", error);
      });
    let unlistenFocus: (() => void) | null = null;
    const registerFocusListener = async () => {
      try {
        unlistenFocus = await tauriWindow.onFocusChanged(({ payload: focused }) => {
          if (focused) {
            return;
          }
          cancelCollapse();
          collapseWindow();
        });
      } catch (error) {
        console.error("监听悬浮窗焦点失败。", error);
      }
    };
    void registerFocusListener();
    const startHoverPolling = () => {
      if (pollTimerRef.current !== null) {
        return;
      }
      pollTimerRef.current = window.setInterval(() => {
        void pollHoverState();
      }, HOVER_POLL_INTERVAL);
    };
    startHoverPolling();
    return () => {
      cancelCollapse();
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (unlistenFocus) {
        unlistenFocus();
      }
    };
  }, []);

  const expandWindow = () => {
    cancelCollapse();
    setIsExpanded((prev) => {
      if (prev) {
        return prev;
      }
      void resizeMonitorWindow(MONITOR_EXPANDED_SIZE);
      return true;
    });
  };

  const collapseWindow = () => {
    setIsExpanded((prev) => {
      if (!prev) {
        return prev;
      }
      void resizeMonitorWindow(MONITOR_COLLAPSED_SIZE);
      return false;
    });
  };

  const handleMouseEnter = () => {
    if (!canExpand) {
      return;
    }
    expandWindow();
  };

  const shouldKeepExpanded = (nextTarget: EventTarget | null) => {
    if (!nextTarget || typeof Node === "undefined" || !(nextTarget instanceof Node)) {
      return false;
    }
    if (bubbleRef.current?.contains(nextTarget)) {
      return true;
    }
    if (mascotButtonRef.current?.contains(nextTarget)) {
      return true;
    }
    return false;
  };

  const handleHoverLeave = (event: React.MouseEvent<HTMLElement>) => {
    if (shouldKeepExpanded(event.relatedTarget)) {
      return;
    }
    scheduleCollapse(true);
  };

  const handleHoverMove = (event: React.MouseEvent<HTMLElement>) => {
    if (!isExpanded) {
      return;
    }
    if (shouldKeepExpanded(event.target)) {
      cancelCollapse();
      return;
    }
    scheduleCollapse(false);
  };

  const isPointInRect = (rect: DOMRect, x: number, y: number) =>
    x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

  const pollHoverState = async () => {
    if (pollingRef.current) {
      return;
    }
    pollingRef.current = true;
    try {
      const [cursor, windowPosition, scaleFactor] = await Promise.all([
        cursorPosition(),
        getCurrentWindow().outerPosition(),
        getCurrentWindow().scaleFactor(),
      ]);
      const localX = (cursor.x - windowPosition.x) / scaleFactor;
      const localY = (cursor.y - windowPosition.y) / scaleFactor;
      const mascotRect = mascotButtonRef.current?.getBoundingClientRect();
      const bubbleRect = bubbleRef.current?.getBoundingClientRect();
      const overMascot = mascotRect ? isPointInRect(mascotRect, localX, localY) : false;
      const overBubble =
        isExpandedRef.current && bubbleRect ? isPointInRect(bubbleRect, localX, localY) : false;
      if (overMascot) {
        if (canExpand) {
          expandWindow();
        }
        return;
      }
      if (isExpandedRef.current && overBubble) {
        cancelCollapse();
        return;
      }
      if (isExpandedRef.current) {
        scheduleCollapse(false);
      }
    } catch (error) {
      console.error("检测悬浮窗鼠标位置失败。", error);
    } finally {
      pollingRef.current = false;
    }
  };

  const resizeMonitorWindow = async (nextSize: { width: number; height: number }) => {
    const window = getCurrentWindow();
    try {
      const [position, size, scaleFactor] = await Promise.all([
        window.outerPosition(),
        window.outerSize(),
        window.scaleFactor(),
      ]);
      const anchorX = position.x + size.width / 2;
      const anchorBottom = position.y + size.height;
      const nextLogicalSize = new LogicalSize(nextSize.width, nextSize.height);
      const nextPhysicalSize = nextLogicalSize.toPhysical(scaleFactor);
      const nextX = Math.round(anchorX - nextPhysicalSize.width / 2);
      const nextY = Math.round(anchorBottom - nextPhysicalSize.height);
      await window.setSize(nextLogicalSize);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await window.setPosition(new PhysicalPosition(nextX, nextY));
    } catch (error) {
      console.error("调整悬浮窗大小失败。", error);
    }
  };

  const handleMascotPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }
    hasDraggedRef.current = false;
    mascotPointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleMascotPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const state = mascotPointerRef.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    if (hasDraggedRef.current) {
      return;
    }
    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      hasDraggedRef.current = true;
      void getCurrentWindow().startDragging().catch((error) => {
        console.error("拖拽悬浮窗失败。", error);
      });
    }
  };

  const handleMascotPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (mascotPointerRef.current?.pointerId === event.pointerId) {
      mascotPointerRef.current = null;
    }
    hasDraggedRef.current = false;
  };

  const handleMascotPointerCancel = () => {
    mascotPointerRef.current = null;
    hasDraggedRef.current = false;
  };

  const handleHeaderMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    void getCurrentWindow().startDragging().catch((error) => {
      console.error("拖拽悬浮窗失败。", error);
    });
  };

  const badgeStatus = isLoading ? "同步" : `${sessions.length}`;

  return (
    <div
      className={`monitor-root${isExpanded ? " is-expanded" : ""}`}
      onMouseLeave={handleHoverLeave}
      onMouseMove={handleHoverMove}
    >
      <div
        ref={bubbleRef}
        className={`monitor-bubble${isExpanded ? " is-open" : ""}`}
        data-no-drag
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleHoverLeave}
      >
        <div className="monitor-bubble-body">
          <CodexSessionSection
            sessions={sessions}
            isLoading={isLoading}
            error={error}
            onOpenSession={onOpenSession}
            emptyText=""
            showHeader={false}
          />
        </div>
      </div>
      <button
        ref={mascotButtonRef}
        className="monitor-mascot-button"
        type="button"
        aria-expanded={isExpanded}
        aria-label="展开悬浮监控详情"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleHoverLeave}
        onPointerDown={handleMascotPointerDown}
        onPointerMove={handleMascotPointerMove}
        onPointerUp={handleMascotPointerUp}
        onPointerCancel={handleMascotPointerCancel}
      >
        <img src="/mascot/slime.svg" alt="史莱姆" draggable={false} />
        <span
          className={`monitor-status-badge${isLoading ? " is-loading" : sessions.length > 0 ? " is-active" : ""}`}
        >
          {badgeStatus}
        </span>
      </button>
      <div
        className="monitor-drag-handle"
        data-tauri-drag-region
        onMouseDown={handleHeaderMouseDown}
        aria-hidden="true"
      />
    </div>
  );
}
