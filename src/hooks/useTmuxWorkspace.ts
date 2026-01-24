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
  TmuxPaneInfo,
  TmuxStatePayload,
  TmuxWindowInfo,
  WorkspaceSession,
} from "../models/terminal";
import {
  captureTmuxPane,
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
} from "../services/terminal";
import { solarizedDarkTransparent } from "../styles/terminal-themes";
import "@xterm/xterm/css/xterm.css";

const MAX_BUFFER_CHARS = 200_000;

const globalOutputBuffers = new Map<string, string>();

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

const appendBuffer = (existing: string | undefined, data: string) => {
  const next = (existing ?? "") + data;
  if (next.length <= MAX_BUFFER_CHARS) {
    return next;
  }
  return next.slice(next.length - MAX_BUFFER_CHARS);
};

const THEME_BACKGROUND_SGR = "48;2;0;43;54";
const ANSI_SGR_PATTERN = /\x1b\[([0-9;]*)m/g;

const normalizeAnsiBackground = (data: string) =>
  data.replace(ANSI_SGR_PATTERN, (match, params) => {
    const normalizedParams = typeof params === "string" ? params : "";
    if (!normalizedParams) {
      return match;
    }
    const parts = normalizedParams.split(";").map((value: string) => Number(value));
    if (parts.some((value: number) => Number.isNaN(value))) {
      return match;
    }
    let changed = false;
    const nextParts: number[] = [];
    for (let index = 0; index < parts.length; index += 1) {
      const code = parts[index];
      if (code === 40 || code === 100) {
        changed = true;
        continue;
      }
      if (code === 48) {
        const mode = parts[index + 1];
        if (mode === 5 && parts[index + 2] === 0) {
          changed = true;
          index += 2;
          continue;
        }
        if (
          mode === 2 &&
          parts[index + 2] === 0 &&
          parts[index + 3] === 0 &&
          parts[index + 4] === 0
        ) {
          changed = true;
          index += 4;
          continue;
        }
      }
      nextParts.push(code);
    }
    if (!changed) {
      return match;
    }
    const prefix = nextParts.length > 0 ? `${nextParts.join(";")};` : "";
    return `\x1b[${prefix}${THEME_BACKGROUND_SGR}m`;
  });

export const useTmuxWorkspace = ({
  activeSession,
  isVisible,
  useWebglRenderer,
}: UseTmuxWorkspaceOptions): TmuxWorkspaceState => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalsRef = useRef(new Map<string, Terminal>());
  const fitAddonsRef = useRef(new Map<string, FitAddon>());
  const webglAddonsRef = useRef(new Map<string, WebglAddon>());
  const paneElementsRef = useRef(new Map<string, HTMLDivElement>());
  const activeSessionRef = useRef<WorkspaceSession | null>(null);
  const activePaneRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const refreshingRef = useRef(false);

  const [status, setStatus] = useState<TerminalStatus>("idle");
  const [panes, setPanes] = useState<TmuxPaneInfo[]>([]);
  const [windows, setWindows] = useState<TmuxWindowInfo[]>([]);
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

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
        return;
      }

      const nextPanes = await listTmuxPanes(windowId);
      setPanes(nextPanes);
      const activePane = nextPanes.find((item) => item.isActive) ?? nextPanes[0] ?? null;
      const paneId = activePane?.id ?? null;
      setActivePaneId(paneId);
      activePaneRef.current = paneId;

      await Promise.all(
        nextPanes.map(async (pane) => {
          if (globalOutputBuffers.has(pane.id)) {
            return;
          }
          try {
            const snapshot = normalizeAnsiBackground(await captureTmuxPane(pane.id));
            globalOutputBuffers.set(pane.id, snapshot);
          } catch (error) {
            console.warn("capture-pane failed", error);
          }
        }),
      );
    } catch (error) {
      console.error("Failed to refresh tmux state.", error);
      setStatus("error");
    } finally {
      refreshingRef.current = false;
    }
  }, []);

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
      const normalized = normalizeAnsiBackground(data);
      const next = appendBuffer(globalOutputBuffers.get(paneId), normalized);
      globalOutputBuffers.set(paneId, next);
      const terminal = terminalsRef.current.get(paneId);
      if (terminal) {
        terminal.write(normalized);
      }
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

    setStatus("connecting");
    void (async () => {
      try {
        await switchTerminalSession(activeSession.id);
        await refreshState();
        setStatus("ready");
      } catch (error) {
        console.error("Failed to switch tmux session.", error);
        setStatus("error");
      }
    })();
  }, [activeSession, isVisible, refreshState]);

  const updateClientSize = useCallback(() => {
    // 对所有终端调用 fit，确保每个 pane 都正确适应其容器
    // 在 tmux control mode 中，tmux 会自动管理每个窗格的大小
    // 我们不需要手动调用 resizeTmuxClient，因为那会导致所有窗格使用相同的尺寸
    for (const [paneId] of terminalsRef.current.entries()) {
      const fitAddon = fitAddonsRef.current.get(paneId);
      if (fitAddon) {
        try {
          fitAddon.fit();
        } catch (error) {
          console.warn("Failed to fit terminal", error);
        }
      }
    }
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
        allowTransparency: true,
        allowProposedApi: true,
        theme: solarizedDarkTransparent,
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

      const buffered = globalOutputBuffers.get(pane.id);
      if (buffered) {
        terminal.write(normalizeAnsiBackground(buffered));
      }
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
};
