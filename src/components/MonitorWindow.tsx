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
      className={`group relative flex h-full items-end justify-center bg-transparent px-4 pb-7 ${
        isExpanded ? "pt-6" : "pt-4"
      }`}
      onMouseLeave={handleHoverLeave}
      onMouseMove={handleHoverMove}
    >
      <div
        ref={bubbleRef}
        className={`absolute bottom-[142px] flex w-[320px] max-h-[360px] flex-col rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(23,23,23,0.94),rgba(17,17,17,0.94))] shadow-[0_22px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-[16px] transition-[opacity,transform] duration-200 ${
          isExpanded
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-y-2.5 scale-[0.98] pointer-events-none"
        } after:(content-[\"\"] absolute bottom-[-10px] left-1/2 h-[18px] w-[18px] -translate-x-1/2 rotate-45 bg-[rgba(20,20,20,0.95)] border-r border-b border-[rgba(255,255,255,0.08)] shadow-[4px_4px_8px_rgba(0,0,0,0.2)])`}
        data-no-drag
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleHoverLeave}
      >
        <div className="flex min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-1.5">
          <CodexSessionSection
            sessions={sessions}
            isLoading={isLoading}
            error={error}
            onOpenSession={onOpenSession}
            emptyText=""
            showHeader={false}
            variant="monitor"
          />
        </div>
      </div>
      <button
        ref={mascotButtonRef}
        className="group relative inline-flex h-[144px] w-[144px] cursor-pointer items-center justify-center rounded-full border-none bg-transparent touch-none"
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
        <img
          className="h-[120px] w-[120px] drop-shadow-[0_16px_22px_rgba(59,130,246,0.28)] transition-transform duration-200 group-hover:translate-y-[-4px] group-hover:scale-[1.02] group-active:translate-y-0 group-active:scale-[0.98]"
          src="/mascot/slime.svg"
          alt="史莱姆"
          draggable={false}
        />
        <span
          className={`absolute right-3 top-2.5 inline-flex h-5 min-w-[26px] items-center justify-center rounded-full border px-1.5 text-[11px] font-semibold text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)] ${
            isLoading
              ? "bg-[linear-gradient(135deg,#f59e0b,#f97316)] border-[rgba(249,115,22,0.6)]"
              : sessions.length > 0
                ? "bg-[linear-gradient(135deg,#3b82f6,#6366f1)] border-[rgba(59,130,246,0.6)]"
                : "bg-[rgba(255,255,255,0.12)] border-[rgba(255,255,255,0.18)]"
          }`}
        >
          {badgeStatus}
        </span>
      </button>
      <div
        className="absolute bottom-1.5 h-2 w-20 rounded-full bg-[rgba(255,255,255,0.2)] opacity-10 transition-opacity duration-200 group-hover:opacity-45"
        data-tauri-drag-region
        onMouseDown={handleHeaderMouseDown}
        aria-hidden="true"
      />
    </div>
  );
}
