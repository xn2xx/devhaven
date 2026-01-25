import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";

import type {
  TmuxOutputPayload,
  TmuxPaneCursor,
  TmuxPaneInfo,
  TmuxStatePayload,
  TmuxWindowInfo,
  WorkspaceSession,
} from "../models/terminal";
import {
  captureTmuxPane,
  getTmuxPaneCursor,
  listTmuxPanes,
  listTmuxWindows,
  sendTmuxInput,
  selectTmuxPane,
  selectTmuxWindow,
  selectTmuxWindowIndex,
  splitTmuxPane,
  selectTmuxPaneDirection,
  switchTerminalSession,
  TMUX_OUTPUT_EVENT,
  TMUX_STATE_EVENT,
  nextTmuxWindow,
  previousTmuxWindow,
  newTmuxWindow,
  killTmuxPane,
  resizeTmuxPane,
  resizeTmuxClient,
} from "../services/terminal";
import { solarizedDark } from "../styles/terminal-themes";
import "@xterm/xterm/css/xterm.css";

const MAX_BUFFER_CHARS = 200_000;
const MAX_REFRESH_RETRIES = 8;
const REFRESH_RETRY_DELAY = 200;

const pendingOutputBuffers = new Map<string, string>();
const pendingCursorPositions = new Map<string, TmuxPaneCursor>();

export type TerminalStatus = "idle" | "preparing" | "connecting" | "ready" | "error";

type UseTmuxWorkspaceOptions = {
  activeSession: WorkspaceSession | null;
  isVisible: boolean;
  useWebglRenderer: boolean;
};

export type TmuxWorkspaceState = {
  status: TerminalStatus;
  containerRef: RefObject<HTMLDivElement | null>;
  panes: TmuxPaneInfo[];
  windows: TmuxWindowInfo[];
  activePaneId: string | null;
  activeWindowId: string | null;
  registerPane: (paneId: string, element: HTMLDivElement | null) => void;
  focusPane: (paneId: string) => void;
  focusPaneDirection: (direction: "left" | "right" | "up" | "down") => void;
  resizePane: (paneId: string, direction: "left" | "right" | "up" | "down", count: number) => void;
  splitActivePane: (direction: "horizontal" | "vertical") => void;
  killActivePane: () => void;
  selectWindow: (windowId: string) => void;
  selectWindowIndex: (index: number) => void;
  nextWindow: () => void;
  previousWindow: () => void;
  newWindow: () => void;
};

function appendBuffer(existing: string | undefined, data: string): string {
  const next = (existing ?? "") + data;
  if (next.length <= MAX_BUFFER_CHARS) {
    return next;
  }
  return next.slice(next.length - MAX_BUFFER_CHARS);
}

function applyCursorToTerminal(terminal: Terminal, cursor: TmuxPaneCursor | undefined): void {
  if (!cursor) {
    return;
  }
  const row = Math.max(1, Math.min(terminal.rows || cursor.row + 1, cursor.row + 1));
  const col = Math.max(1, Math.min(terminal.cols || cursor.col + 1, cursor.col + 1));
  terminal.write(`\x1b[${row};${col}H`);
}

function normalizeSnapshot(snapshot: string): string {
  return snapshot.replace(/\r?\n/g, "\r\n");
}

export function useTmuxWorkspace({
  activeSession,
  isVisible,
  useWebglRenderer,
}: UseTmuxWorkspaceOptions): TmuxWorkspaceState {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalsRef = useRef(new Map<string, Terminal>());
  const fitAddonsRef = useRef(new Map<string, FitAddon>());
  const webglAddonsRef = useRef(new Map<string, WebglAddon>());
  const paneElementsRef = useRef(new Map<string, HTMLDivElement>());
  const paneHasOutputRef = useRef(new Set<string>());
  const paneSnapshotAppliedRef = useRef(new Set<string>());
  const activeSessionRef = useRef<WorkspaceSession | null>(null);
  const activePaneRef = useRef<string | null>(null);
  const refreshStateRef = useRef<() => void>(() => {});
  const refreshTimerRef = useRef<number | null>(null);
  const refreshingRef = useRef(false);
  const lastClientSizeRef = useRef<{ cols: number; rows: number } | null>(null);
  const pendingClientSizeRef = useRef<{ cols: number; rows: number } | null>(null);
  const resizeTimerRef = useRef<number | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const lastContainerSizeRef = useRef<{ width: number; height: number } | null>(null);

  const [status, setStatus] = useState<TerminalStatus>("idle");
  const [panes, setPanes] = useState<TmuxPaneInfo[]>([]);
  const [windows, setWindows] = useState<TmuxWindowInfo[]>([]);
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const statusRef = useRef<TerminalStatus>("idle");
  const refreshRetryRef = useRef(0);
  const refreshRetryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const clearRefreshRetry = useCallback(() => {
    refreshRetryRef.current = 0;
    if (refreshRetryTimerRef.current !== null) {
      window.clearTimeout(refreshRetryTimerRef.current);
      refreshRetryTimerRef.current = null;
    }
  }, []);

  const scheduleRefreshRetry = useCallback(() => {
    if (refreshRetryTimerRef.current !== null) {
      return;
    }
    if (refreshRetryRef.current >= MAX_REFRESH_RETRIES) {
      if (statusRef.current !== "error") {
        setStatus("error");
      }
      return;
    }
    refreshRetryTimerRef.current = window.setTimeout(() => {
      refreshRetryTimerRef.current = null;
      refreshStateRef.current();
    }, REFRESH_RETRY_DELAY);
  }, []);

  const refreshState = useCallback(async () => {
    const session = activeSessionRef.current;
    if (!session || refreshingRef.current) {
      return;
    }
    refreshingRef.current = true;
    try {
      const nextWindows = await listTmuxWindows(session.id);
      setWindows(nextWindows);
      const activeWindow = nextWindows.find((item) => item.isActive) ?? nextWindows[0] ?? null;
      const windowId = activeWindow?.id ?? null;
      setActiveWindowId(windowId);

      if (!windowId) {
        setPanes([]);
        setActivePaneId(null);
        activePaneRef.current = null;
        refreshRetryRef.current += 1;
        if (statusRef.current !== "error") {
          setStatus("connecting");
        }
        scheduleRefreshRetry();
        return;
      }

      const nextPanes = await listTmuxPanes(windowId);
      setPanes(nextPanes);
      const activePane = nextPanes.find((item) => item.isActive) ?? nextPanes[0] ?? null;
      const paneId = activePane?.id ?? null;
      setActivePaneId(paneId);
      activePaneRef.current = paneId;
      if (nextPanes.length === 0) {
        refreshRetryRef.current += 1;
        if (statusRef.current !== "error") {
          setStatus("connecting");
        }
        scheduleRefreshRetry();
        return;
      }

      await Promise.all(
        nextPanes.map(async (pane) => {
          const buffered = pendingOutputBuffers.get(pane.id);
          const hasOutput = paneHasOutputRef.current.has(pane.id);
          const snapshotApplied = paneSnapshotAppliedRef.current.has(pane.id);
          if (
            terminalsRef.current.has(pane.id) ||
            hasOutput ||
            snapshotApplied ||
            (buffered !== undefined && buffered.length > 0)
          ) {
            return;
          }
          try {
            const snapshot = await captureTmuxPane(pane.id);
            const normalizedSnapshot = normalizeSnapshot(snapshot);
            if (normalizedSnapshot.length === 0) {
              return;
            }
            if (paneHasOutputRef.current.has(pane.id) || paneSnapshotAppliedRef.current.has(pane.id)) {
              return;
            }
            try {
              const cursor = await getTmuxPaneCursor(pane.id);
              const terminal = terminalsRef.current.get(pane.id);
              if (terminal) {
                if (!paneHasOutputRef.current.has(pane.id) && !paneSnapshotAppliedRef.current.has(pane.id)) {
                  terminal.write(normalizedSnapshot);
                  applyCursorToTerminal(terminal, cursor);
                  paneSnapshotAppliedRef.current.add(pane.id);
                }
                pendingOutputBuffers.delete(pane.id);
                pendingCursorPositions.delete(pane.id);
                return;
              }
              pendingOutputBuffers.set(pane.id, appendBuffer(undefined, normalizedSnapshot));
              pendingCursorPositions.set(pane.id, cursor);
              paneSnapshotAppliedRef.current.add(pane.id);
            } catch (error) {
              console.warn("get cursor position failed", error);
              const terminal = terminalsRef.current.get(pane.id);
              if (terminal) {
                if (!paneHasOutputRef.current.has(pane.id) && !paneSnapshotAppliedRef.current.has(pane.id)) {
                  terminal.write(normalizedSnapshot);
                  paneSnapshotAppliedRef.current.add(pane.id);
                }
                pendingOutputBuffers.delete(pane.id);
                pendingCursorPositions.delete(pane.id);
                return;
              }
              pendingOutputBuffers.set(pane.id, appendBuffer(undefined, normalizedSnapshot));
              paneSnapshotAppliedRef.current.add(pane.id);
            }
          } catch (error) {
            console.warn("capture-pane failed", error);
          }
        }),
      );
      clearRefreshRetry();
      if (statusRef.current !== "ready") {
        setStatus("ready");
      }
    } catch (error) {
      console.error("Failed to refresh tmux state.", error);
      refreshRetryRef.current += 1;
      if (refreshRetryRef.current >= MAX_REFRESH_RETRIES) {
        setStatus("error");
        return;
      }
      if (statusRef.current !== "error") {
        setStatus("connecting");
      }
      scheduleRefreshRetry();
    } finally {
      refreshingRef.current = false;
    }
  }, [clearRefreshRetry, scheduleRefreshRetry]);

  useEffect(() => {
    refreshStateRef.current = () => {
      void refreshState();
    };
  }, [refreshState]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      return;
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshState();
    }, 80);
  }, [refreshState]);

  useEffect(() => {
    let unlistenOutput: (() => void) | null = null;
    let unlistenState: (() => void) | null = null;
    let canceled = false;

    void listen<TmuxOutputPayload>(TMUX_OUTPUT_EVENT, (event) => {
      const payload = event.payload;
      const paneId = payload.paneId;
      const data = payload.data ?? "";
      if (!paneId || !data) {
        return;
      }
      const terminal = terminalsRef.current.get(paneId);
      if (terminal) {
        terminal.write(data);
        paneHasOutputRef.current.add(paneId);
        return;
      }
      const next = appendBuffer(pendingOutputBuffers.get(paneId), data);
      pendingOutputBuffers.set(paneId, next);
      pendingCursorPositions.delete(paneId);
      paneHasOutputRef.current.add(paneId);
    })
      .then((unlisten) => {
        if (canceled) {
          unlisten();
          return;
        }
        unlistenOutput = unlisten;
      })
      .catch((error) => {
        console.error("Failed to listen tmux output.", error);
      });

    void listen<TmuxStatePayload>(TMUX_STATE_EVENT, () => {
      scheduleRefresh();
    })
      .then((unlisten) => {
        if (canceled) {
          unlisten();
          return;
        }
        unlistenState = unlisten;
      })
      .catch((error) => {
        console.error("Failed to listen tmux state.", error);
      });

    return () => {
      canceled = true;
      unlistenOutput?.();
      unlistenState?.();
    };
  }, [scheduleRefresh]);

  useEffect(() => {
    if (!isVisible) {
      clearRefreshRetry();
      setStatus("idle");
      setPanes([]);
      setWindows([]);
      setActivePaneId(null);
      setActiveWindowId(null);
      return;
    }

    if (!activeSession) {
      setStatus("idle");
      return;
    }

    clearRefreshRetry();
    setStatus("connecting");
    void (async () => {
      try {
        await switchTerminalSession(activeSession.id);
        await refreshState();
      } catch (error) {
        console.error("Failed to switch tmux session.", error);
        setStatus("error");
      }
    })();
  }, [activeSession, clearRefreshRetry, isVisible, refreshState]);

  const updateClientSize = useCallback(() => {
    if (resizeFrameRef.current !== null) {
      return;
    }
    resizeFrameRef.current = window.requestAnimationFrame(() => {
      resizeFrameRef.current = null;
      // 对所有终端调用 fit，确保每个 pane 都正确适应其容器
      // 在 tmux control mode 中需要明确同步客户端尺寸，否则 tmux 会停留在默认 80x24
      for (const paneId of terminalsRef.current.keys()) {
        const fitAddon = fitAddonsRef.current.get(paneId);
        if (fitAddon) {
          try {
            fitAddon.fit();
          } catch (error) {
            console.warn("Failed to fit terminal", error);
          }
        }
      }
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const lastContainer = lastContainerSizeRef.current;
      if (lastContainer?.width === containerWidth && lastContainer?.height === containerHeight) {
        return;
      }
      lastContainerSizeRef.current = { width: containerWidth, height: containerHeight };
      const firstEntry = terminalsRef.current.entries().next();
      if (firstEntry.done) {
        return;
      }
      const [paneId, terminal] = firstEntry.value;
      const paneElement = paneElementsRef.current.get(paneId);
      if (!paneElement || terminal.cols <= 0 || terminal.rows <= 0) {
        return;
      }
      const cellWidth = paneElement.clientWidth / terminal.cols;
      const cellHeight = paneElement.clientHeight / terminal.rows;
      if (!Number.isFinite(cellWidth) || !Number.isFinite(cellHeight) || cellWidth <= 0 || cellHeight <= 0) {
        return;
      }
      const cols = Math.max(2, Math.floor(containerWidth / cellWidth));
      const rows = Math.max(2, Math.floor(containerHeight / cellHeight));
      pendingClientSizeRef.current = { cols, rows };
      const last = lastClientSizeRef.current;
      if (last?.cols === cols && last?.rows === rows) {
        return;
      }
      if (resizeTimerRef.current !== null) {
        return;
      }
      resizeTimerRef.current = window.setTimeout(() => {
        resizeTimerRef.current = null;
        const pending = pendingClientSizeRef.current;
        if (!pending) {
          return;
        }
        const latest = lastClientSizeRef.current;
        if (latest?.cols === pending.cols && latest?.rows === pending.rows) {
          return;
        }
        lastClientSizeRef.current = pending;
        void resizeTmuxClient(pending.cols, pending.rows).catch((error) => {
          console.error("Failed to resize tmux client.", error);
        });
      }, 80);
    });
  }, [resizeTmuxClient]);

  useEffect(() => {
    return () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const resizeObserver = new ResizeObserver(() => {
      updateClientSize();
    });
    resizeObserver.observe(container);

    // 同时监听每个窗格容器的大小变化
    paneElementsRef.current.forEach((element) => {
      resizeObserver.observe(element);
    });

    return () => {
      resizeObserver.disconnect();
    };
  }, [isVisible, updateClientSize, panes]);

  const attachWebglRenderer = useCallback((paneId: string, terminal: Terminal) => {
    if (webglAddonsRef.current.has(paneId)) {
      return;
    }
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
        webglAddonsRef.current.delete(paneId);
      });
      terminal.loadAddon(webglAddon);
      webglAddonsRef.current.set(paneId, webglAddon);
    } catch (error) {
      console.warn("WebGL 渲染器加载失败，使用默认渲染器", error);
    }
  }, []);

  const detachWebglRenderer = useCallback((paneId: string) => {
    const webglAddon = webglAddonsRef.current.get(paneId);
    if (!webglAddon) {
      return;
    }
    webglAddon.dispose();
    webglAddonsRef.current.delete(paneId);
  }, []);

  const createTerminalForPane = useCallback(
    (pane: TmuxPaneInfo, element: HTMLDivElement) => {
      if (terminalsRef.current.has(pane.id)) {
        const fitAddon = fitAddonsRef.current.get(pane.id);
        if (fitAddon) {
          // 使用 FitAddon 重新适应容器大小
          setTimeout(() => {
            fitAddon.fit();
          }, 0);
        }
        return;
      }
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 12,
        fontFamily: "'Hack Nerd Font', 'Apple Color Emoji', monospace",
        allowProposedApi: true,
        theme: solarizedDark,
        scrollback: 5000,
      });

      // 加载 Unicode11 支持（必须在 open 之前）
      const unicode11Addon = new Unicode11Addon();
      terminal.loadAddon(unicode11Addon);
      terminal.unicode.activeVersion = "11";

      // 加载其他插件
      terminal.loadAddon(new WebLinksAddon());

      // 创建并加载 FitAddon
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      terminal.open(element);

      if (useWebglRenderer) {
        attachWebglRenderer(pane.id, terminal);
      }

      // 使用 FitAddon 自动适应容器大小
      setTimeout(() => {
        fitAddon.fit();
      }, 0);

      terminal.onData((data) => {
        void sendTmuxInput(pane.id, data).catch((error) => {
          console.error("Failed to send tmux input.", error);
        });
      });

      terminalsRef.current.set(pane.id, terminal);
      fitAddonsRef.current.set(pane.id, fitAddon);

      const buffered = pendingOutputBuffers.get(pane.id);
      if (buffered !== undefined) {
        if (buffered.length > 0) {
          terminal.write(buffered);
          paneHasOutputRef.current.add(pane.id);
          paneSnapshotAppliedRef.current.add(pane.id);
        }
        pendingOutputBuffers.delete(pane.id);
      }
      const cursor = pendingCursorPositions.get(pane.id);
      applyCursorToTerminal(terminal, cursor);
      pendingCursorPositions.delete(pane.id);
      updateClientSize();
    },
    [attachWebglRenderer, updateClientSize, useWebglRenderer],
  );

  const registerPane = useCallback(
    (paneId: string, element: HTMLDivElement | null) => {
      if (!element) {
        paneElementsRef.current.delete(paneId);
        return;
      }
      paneElementsRef.current.set(paneId, element);
      const pane = panes.find((item) => item.id === paneId);
      if (pane) {
        createTerminalForPane(pane, element);
      }
    },
    [createTerminalForPane, panes],
  );

  useEffect(() => {
    const paneIds = new Set(panes.map((pane) => pane.id));
    terminalsRef.current.forEach((terminal, paneId) => {
      if (!paneIds.has(paneId)) {
        terminal.dispose();
        terminalsRef.current.delete(paneId);
        fitAddonsRef.current.delete(paneId);
        detachWebglRenderer(paneId);
        paneElementsRef.current.delete(paneId);
        pendingOutputBuffers.delete(paneId);
        pendingCursorPositions.delete(paneId);
        paneHasOutputRef.current.delete(paneId);
        paneSnapshotAppliedRef.current.delete(paneId);
      }
    });

    panes.forEach((pane) => {
      const element = paneElementsRef.current.get(pane.id);
      if (!element) {
        return;
      }
      createTerminalForPane(pane, element);
    });

    // 窗格布局变化后，强制刷新所有终端尺寸
    setTimeout(() => {
      updateClientSize();
    }, 100);
  }, [createTerminalForPane, detachWebglRenderer, isVisible, panes, updateClientSize]);

  useEffect(() => {
    terminalsRef.current.forEach((terminal, paneId) => {
      if (useWebglRenderer) {
        attachWebglRenderer(paneId, terminal);
      } else {
        detachWebglRenderer(paneId);
      }
    });
  }, [attachWebglRenderer, detachWebglRenderer, useWebglRenderer]);

  useEffect(() => {
    if (!activePaneId) {
      return;
    }
    activePaneRef.current = activePaneId;
    const terminal = terminalsRef.current.get(activePaneId);
    terminal?.focus();
  }, [activePaneId]);


  const focusPane = useCallback((paneId: string) => {
    setActivePaneId(paneId);
    void selectTmuxPane(paneId).catch((error) => {
      console.error("Failed to select tmux pane.", error);
    });
  }, []);

  const focusPaneDirection = useCallback((direction: "left" | "right" | "up" | "down") => {
    const paneId = activePaneRef.current;
    if (!paneId) {
      return;
    }
    void selectTmuxPaneDirection(paneId, direction).catch((error) => {
      console.error("Failed to select tmux pane direction.", error);
    });
  }, []);

  const resizePane = useCallback(
    (paneId: string, direction: "left" | "right" | "up" | "down", count: number) => {
      if (!paneId || count <= 0) {
        return;
      }
      void resizeTmuxPane(paneId, direction, count)
        .then(() => {
          scheduleRefresh();
        })
        .catch((error) => {
          console.error("Failed to resize tmux pane.", error);
        });
    },
    [scheduleRefresh],
  );

  const splitActivePane = useCallback((direction: "horizontal" | "vertical") => {
    const paneId = activePaneRef.current;
    if (!paneId) {
      return;
    }
    void splitTmuxPane(paneId, direction).catch((error) => {
      console.error("Failed to split tmux pane.", error);
    });
  }, []);

  const killActivePane = useCallback(() => {
    const paneId = activePaneRef.current;
    if (!paneId) {
      return;
    }
    void killTmuxPane(paneId).catch((error) => {
      console.error("Failed to kill tmux pane.", error);
    });
  }, []);

  const selectWindow = useCallback((windowId: string) => {
    void selectTmuxWindow(windowId).catch((error) => {
      console.error("Failed to select tmux window.", error);
    });
  }, []);

  const selectWindowIndex = useCallback(
    (index: number) => {
      const session = activeSessionRef.current;
      if (!session) {
        return;
      }
      void selectTmuxWindowIndex(session.id, index).catch((error) => {
        console.error("Failed to select tmux window index.", error);
      });
    },
    [],
  );

  const nextWindow = useCallback(() => {
    void nextTmuxWindow().catch((error) => {
      console.error("Failed to select next tmux window.", error);
    });
  }, []);

  const previousWindow = useCallback(() => {
    void previousTmuxWindow().catch((error) => {
      console.error("Failed to select previous tmux window.", error);
    });
  }, []);

  const newWindow = useCallback(() => {
    const session = activeSessionRef.current;
    if (!session) {
      return;
    }
    void newTmuxWindow(session.id, session.projectPath).catch((error) => {
      console.error("Failed to create tmux window.", error);
    });
  }, []);


  return {
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
    selectWindow,
    selectWindowIndex,
    nextWindow,
    previousWindow,
    newWindow,
  };
}
