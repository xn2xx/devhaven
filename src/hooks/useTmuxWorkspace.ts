import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";

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
  resizeTmuxClient,
  newTmuxWindow,
  killTmuxPane,
} from "../services/terminal";
import { solarizedDark } from "../styles/terminal-themes";
import "@xterm/xterm/css/xterm.css";

const MAX_BUFFER_CHARS = 200_000;

const globalOutputBuffers = new Map<string, string>();

export type TerminalStatus = "idle" | "preparing" | "connecting" | "ready" | "error";

type UseTmuxWorkspaceOptions = {
  activeSession: WorkspaceSession | null;
  isVisible: boolean;
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

export const useTmuxWorkspace = ({
  activeSession,
  isVisible,
}: UseTmuxWorkspaceOptions): TmuxWorkspaceState => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalsRef = useRef(new Map<string, Terminal>());
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
            const snapshot = await captureTmuxPane(pane.id);
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
      const next = appendBuffer(globalOutputBuffers.get(paneId), data);
      globalOutputBuffers.set(paneId, next);
      const terminal = terminalsRef.current.get(paneId);
      if (terminal) {
        terminal.write(data);
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

  const getCellSize = useCallback(() => {
    for (const terminal of terminalsRef.current.values()) {
      const renderService = (terminal as { _core?: { _renderService?: { dimensions?: { actualCellWidth: number; actualCellHeight: number } } } })
        ._core?._renderService;
      const dimensions = renderService?.dimensions;
      if (dimensions?.actualCellWidth && dimensions?.actualCellHeight) {
        return { width: dimensions.actualCellWidth, height: dimensions.actualCellHeight };
      }
    }
    return null;
  }, []);

  const updateClientSize = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const cell = getCellSize();
    if (!cell) {
      return;
    }
    const cols = Math.max(1, Math.floor(container.clientWidth / cell.width));
    const rows = Math.max(1, Math.floor(container.clientHeight / cell.height));
    void resizeTmuxClient(cols, rows).catch((error) => {
      console.error("Failed to resize tmux client.", error);
    });
  }, [getCellSize]);

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
    return () => {
      resizeObserver.disconnect();
    };
  }, [isVisible, updateClientSize]);

  const createTerminalForPane = useCallback(
    (pane: TmuxPaneInfo, element: HTMLDivElement) => {
      if (terminalsRef.current.has(pane.id)) {
        const terminal = terminalsRef.current.get(pane.id);
        if (terminal && pane.width > 0 && pane.height > 0) {
          terminal.resize(pane.width, pane.height);
        }
        return;
      }
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 12,
        fontFamily: "'Hack Nerd Font', monospace",
        allowTransparency: false,
        allowProposedApi: true,
        theme: solarizedDark,
        scrollback: 5000,
      });
      const unicode11Addon = new Unicode11Addon();
      terminal.loadAddon(unicode11Addon);
      terminal.loadAddon(new WebLinksAddon());
      terminal.unicode.activeVersion = "11";
      terminal.open(element);
      terminal.onData((data) => {
        void sendTmuxInput(pane.id, data).catch((error) => {
          console.error("Failed to send tmux input.", error);
        });
      });
      if (pane.width > 0 && pane.height > 0) {
        terminal.resize(pane.width, pane.height);
      }
      terminalsRef.current.set(pane.id, terminal);
      const buffered = globalOutputBuffers.get(pane.id);
      if (buffered) {
        terminal.write(buffered);
      }
      updateClientSize();
    },
    [updateClientSize],
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
  }, [createTerminalForPane, isVisible, panes]);

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
    splitActivePane,
    killActivePane,
    selectWindow,
    selectWindowIndex,
    nextWindow,
    previousWindow,
    newWindow,
  };
};
