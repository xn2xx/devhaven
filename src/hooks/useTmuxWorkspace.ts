import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { FitAddon } from "@xterm/addon-fit";
import type { WebglAddon } from "@xterm/addon-webgl";
import type { Terminal } from "@xterm/xterm";

import { listen } from "@tauri-apps/api/event";

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

const MAX_BUFFER_CHARS = 20_000_000;
const MAX_REFRESH_RETRIES = 8;
const REFRESH_RETRY_DELAY = 200;
const SNAPSHOT_MIN_LINES = 120;
const SNAPSHOT_MAX_LINES = 2000;
const SNAPSHOT_LINES_MULTIPLIER = 2;
const SNAPSHOT_OUTPUT_GRACE_MS = 120;
const SNAPSHOT_TIMEOUT_MS = 350;

const pendingOutputBuffers = new Map<string, Map<string, string>>();
const pendingCursorPositions = new Map<string, Map<string, TmuxPaneCursor>>();
const pendingOutputLineBreaks = new Map<string, Map<string, boolean>>();

type XtermCoreModules = {
  Terminal: typeof import("@xterm/xterm").Terminal;
  WebLinksAddon: typeof import("@xterm/addon-web-links").WebLinksAddon;
  Unicode11Addon: typeof import("@xterm/addon-unicode11").Unicode11Addon;
  FitAddon: typeof import("@xterm/addon-fit").FitAddon;
};

type WebglModule = {
  WebglAddon: typeof import("@xterm/addon-webgl").WebglAddon;
};

let xtermCorePromise: Promise<XtermCoreModules> | null = null;
let webglPromise: Promise<WebglModule> | null = null;

function loadXtermCoreModules(): Promise<XtermCoreModules> {
  if (!xtermCorePromise) {
    xtermCorePromise = Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-web-links"),
      import("@xterm/addon-unicode11"),
      import("@xterm/addon-fit"),
    ]).then(([xterm, webLinks, unicode11, fit]) => ({
      Terminal: xterm.Terminal,
      WebLinksAddon: webLinks.WebLinksAddon,
      Unicode11Addon: unicode11.Unicode11Addon,
      FitAddon: fit.FitAddon,
    }));
  }
  return xtermCorePromise;
}

function loadWebglModule(): Promise<WebglModule> {
  if (!webglPromise) {
    webglPromise = import("@xterm/addon-webgl").then((webgl) => ({
      WebglAddon: webgl.WebglAddon,
    }));
  }
  return webglPromise;
}

export type TerminalStatus = "idle" | "preparing" | "connecting" | "ready" | "error";

type UseTmuxWorkspaceOptions = {
  activeSession: WorkspaceSession | null;
  isVisible: boolean;
  useWebglRenderer: boolean;
  sessionIds: string[];
  readOnly?: boolean;
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

function normalizeLineBreaks(value: string): string {
  return value.replace(/\r?\n/g, "\r\n");
}

type LineBreakNormalizationResult = {
  value: string;
  pendingCR: boolean;
};

function normalizeLineBreaksStreaming(value: string, pendingCR: boolean): LineBreakNormalizationResult {
  if (!value) {
    return { value, pendingCR };
  }
  const parts: string[] = [];
  let index = 0;
  if (pendingCR) {
    if (value[0] === "\n") {
      parts.push("\n");
      index = 1;
    }
    pendingCR = false;
  }
  for (; index < value.length; index += 1) {
    const ch = value[index];
    if (ch === "\n") {
      if (index > 0 && value[index - 1] === "\r") {
        parts.push("\n");
      } else {
        parts.push("\r\n");
      }
      continue;
    }
    parts.push(ch);
  }
  const normalized = parts.length > 0 ? parts.join("") : "";
  return { value: normalized, pendingCR: normalized.endsWith("\r") };
}

function stripLegacyTitleSequences(value: string): string {
  return value.replace(/\x1bk[\s\S]*?\x1b\\/g, "");
}

function sanitizeTmuxOutput(value: string, pendingCR: boolean): LineBreakNormalizationResult {
  return normalizeLineBreaksStreaming(stripLegacyTitleSequences(value), pendingCR);
}

const CURSOR_REPORT_PATTERN = /\x1b\[\d+;\d+R/g;
const DEVICE_ATTR_REPORT_PATTERN = /\x1b\[[?>][0-9;]*c/g;
const OSC_COLOR_REPORT_PATTERN = /\x1b\](?:10|11|12);rgb:[0-9a-fA-F/]+(?:\x1b\\|\x07)/g;
const OSC_PALETTE_REPORT_PATTERN = /\x1b\]4;\d+;rgb:[0-9a-fA-F/]+(?:\x1b\\|\x07)/g;

function sanitizeTmuxInput(value: string): string {
  if (!value) {
    return value;
  }
  return value
    .replace(CURSOR_REPORT_PATTERN, "")
    .replace(DEVICE_ATTR_REPORT_PATTERN, "")
    .replace(OSC_COLOR_REPORT_PATTERN, "")
    .replace(OSC_PALETTE_REPORT_PATTERN, "");
}

function normalizeSnapshot(snapshot: string): string {
  const normalized = normalizeLineBreaks(snapshot);
  if (normalized.endsWith("\r\n")) {
    return normalized.slice(0, -2);
  }
  return normalized;
}

function getSessionMap<T>(store: Map<string, Map<string, T>>, sessionId: string): Map<string, T> {
  let sessionMap = store.get(sessionId);
  if (!sessionMap) {
    sessionMap = new Map<string, T>();
    store.set(sessionId, sessionMap);
  }
  return sessionMap;
}

function getSessionSet(store: Map<string, Set<string>>, sessionId: string): Set<string> {
  let sessionSet = store.get(sessionId);
  if (!sessionSet) {
    sessionSet = new Set<string>();
    store.set(sessionId, sessionSet);
  }
  return sessionSet;
}

function getSnapshotLines(pane: TmuxPaneInfo): number {
  const base = Math.max(SNAPSHOT_MIN_LINES, Math.round(pane.height * SNAPSHOT_LINES_MULTIPLIER));
  return Math.min(SNAPSHOT_MAX_LINES, base);
}

async function capturePaneSnapshot(paneId: string, lines: number): Promise<string | null> {
  let timeoutId: number | null = null;
  const snapshotPromise = captureTmuxPane(paneId, lines).catch((error) => {
    console.warn("capture-pane failed", error);
    return "";
  });
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT_MS);
  });
  const result = await Promise.race([snapshotPromise, timeoutPromise]);
  if (timeoutId !== null) {
    window.clearTimeout(timeoutId);
  }
  return result;
}

export function useTmuxWorkspace({
  activeSession,
  isVisible,
  useWebglRenderer,
  sessionIds,
  readOnly = false,
}: UseTmuxWorkspaceOptions): TmuxWorkspaceState {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalsRef = useRef(new Map<string, Terminal>());
  const fitAddonsRef = useRef(new Map<string, FitAddon>());
  const webglAddonsRef = useRef(new Map<string, WebglAddon>());
  const paneElementsRef = useRef(new Map<string, HTMLDivElement>());
  const paneSnapshotAppliedRef = useRef(new Map<string, Set<string>>());
  const paneSnapshotPendingRef = useRef(new Map<string, Set<string>>());
  const paneSnapshotStartedRef = useRef(new Map<string, Map<string, number>>());
  const paneSnapshotLiveOutputRef = useRef(new Map<string, Set<string>>());
  const activeSessionRef = useRef<WorkspaceSession | null>(null);
  const activePaneRef = useRef<string | null>(null);
  const lastSessionIdRef = useRef<string | null>(null);
  const forceSnapshotSessionRef = useRef<string | null>(null);
  const refreshStateRef = useRef<() => void>(() => {});
  const refreshTimerRef = useRef<number | null>(null);
  const refreshingRef = useRef(false);
  const lastClientSizeRef = useRef<{ cols: number; rows: number } | null>(null);
  const pendingClientSizeRef = useRef<{ cols: number; rows: number } | null>(null);
  const resizeTimerRef = useRef<number | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const lastContainerSizeRef = useRef<{ width: number; height: number } | null>(null);
  const readOnlyRef = useRef(readOnly);
  const useWebglRendererRef = useRef(useWebglRenderer);
  const pendingTerminalCreatesRef = useRef(new Map<string, number>());
  const terminalCreateSeqRef = useRef(0);

  const [status, setStatus] = useState<TerminalStatus>("idle");
  const [panes, setPanes] = useState<TmuxPaneInfo[]>([]);
  const [windows, setWindows] = useState<TmuxWindowInfo[]>([]);
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const statusRef = useRef<TerminalStatus>("idle");
  const refreshRetryRef = useRef(0);
  const refreshRetryTimerRef = useRef<number | null>(null);

  const clearSessionCaches = useCallback((sessionId: string) => {
    pendingOutputBuffers.delete(sessionId);
    pendingCursorPositions.delete(sessionId);
    pendingOutputLineBreaks.delete(sessionId);
    paneSnapshotAppliedRef.current.delete(sessionId);
    paneSnapshotPendingRef.current.delete(sessionId);
    paneSnapshotStartedRef.current.delete(sessionId);
    paneSnapshotLiveOutputRef.current.delete(sessionId);
  }, []);

  const clearAllSessionCaches = useCallback(() => {
    pendingOutputBuffers.clear();
    pendingCursorPositions.clear();
    pendingOutputLineBreaks.clear();
    paneSnapshotAppliedRef.current.clear();
    paneSnapshotPendingRef.current.clear();
    paneSnapshotStartedRef.current.clear();
    paneSnapshotLiveOutputRef.current.clear();
  }, []);

  const destroyAllTerminals = useCallback(() => {
    terminalsRef.current.forEach((terminal, paneId) => {
      terminal.dispose();
      const webglAddon = webglAddonsRef.current.get(paneId);
      if (webglAddon) {
        webglAddon.dispose();
      }
    });
    webglAddonsRef.current.clear();
    terminalsRef.current.clear();
    fitAddonsRef.current.clear();
    pendingTerminalCreatesRef.current.clear();
  }, []);


  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  useEffect(() => {
    useWebglRendererRef.current = useWebglRenderer;
  }, [useWebglRenderer]);

  useEffect(() => {
    if (sessionIds.length === 0) {
      clearAllSessionCaches();
      return;
    }
    const activeSessions = new Set(sessionIds);
    for (const sessionId of pendingOutputBuffers.keys()) {
      if (!activeSessions.has(sessionId)) {
        clearSessionCaches(sessionId);
      }
    }
    for (const sessionId of pendingCursorPositions.keys()) {
      if (!activeSessions.has(sessionId)) {
        clearSessionCaches(sessionId);
      }
    }
    for (const sessionId of paneSnapshotAppliedRef.current.keys()) {
      if (!activeSessions.has(sessionId)) {
        clearSessionCaches(sessionId);
      }
    }
  }, [clearAllSessionCaches, clearSessionCaches, sessionIds]);

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
    const sessionId = session.id;
    const isActiveSession = () => activeSessionRef.current?.id === sessionId;
    const forceSnapshot = forceSnapshotSessionRef.current === sessionId;
    refreshingRef.current = true;
    try {
      const nextWindows = await listTmuxWindows(sessionId);
      if (!isActiveSession()) {
        return;
      }
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
      if (!isActiveSession()) {
        return;
      }
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
          const sessionBuffers = getSessionMap(pendingOutputBuffers, sessionId);
          const sessionCursors = getSessionMap(pendingCursorPositions, sessionId);
          const sessionLineBreaks = getSessionMap(pendingOutputLineBreaks, sessionId);
          const sessionSnapshots = getSessionSet(paneSnapshotAppliedRef.current, sessionId);
          const buffered = sessionBuffers.get(pane.id);
          const hasBufferedOutput = buffered !== undefined && buffered.length > 0;
          const snapshotApplied = sessionSnapshots.has(pane.id);
          const hasTerminal = terminalsRef.current.has(pane.id);
          const shouldForceSnapshot = forceSnapshot && !hasBufferedOutput;
          const shouldReplaceSnapshot = shouldForceSnapshot || !hasTerminal;
          if (!shouldForceSnapshot) {
            if (hasBufferedOutput) {
              return;
            }
            if (hasTerminal && snapshotApplied) {
              return;
            }
          }
          const sessionSnapshotPending = getSessionSet(paneSnapshotPendingRef.current, sessionId);
          const previousBuffer = buffered ?? "";
          let clearedBuffer = false;
          if (shouldReplaceSnapshot) {
            sessionBuffers.set(pane.id, "");
            clearedBuffer = true;
            sessionLineBreaks.set(pane.id, false);
          }
          let pendingRestoreBuffer = clearedBuffer;
          const sessionSnapshotStarted = getSessionMap(paneSnapshotStartedRef.current, sessionId);
          const sessionSnapshotLiveOutput = getSessionSet(paneSnapshotLiveOutputRef.current, sessionId);
          sessionSnapshotStarted.set(pane.id, Date.now());
          sessionSnapshotLiveOutput.delete(pane.id);
          sessionSnapshotPending.add(pane.id);
          try {
            if (!isActiveSession()) {
              return;
            }
            const snapshot = await capturePaneSnapshot(pane.id, getSnapshotLines(pane));
            if (!isActiveSession()) {
              return;
            }
            const pendingDuringSnapshot = clearedBuffer ? (sessionBuffers.get(pane.id) ?? "") : "";
            const liveOutputDuringSnapshot = sessionSnapshotLiveOutput.has(pane.id);
            if (snapshot === null) {
              if (shouldReplaceSnapshot) {
                const terminal = terminalsRef.current.get(pane.id);
                if (terminal && !liveOutputDuringSnapshot) {
                  terminal.reset();
                  if (pendingDuringSnapshot) {
                    terminal.write(pendingDuringSnapshot);
                  }
                }
                sessionBuffers.set(pane.id, pendingDuringSnapshot);
                sessionCursors.delete(pane.id);
                sessionSnapshots.add(pane.id);
                pendingRestoreBuffer = false;
              }
              return;
            }
            const normalizedSnapshot = normalizeSnapshot(snapshot);
            if (liveOutputDuringSnapshot) {
              if (clearedBuffer) {
                sessionBuffers.set(pane.id, pendingDuringSnapshot);
              }
              sessionSnapshots.add(pane.id);
              pendingRestoreBuffer = false;
              return;
            }
            if (normalizedSnapshot.length === 0) {
              if (shouldReplaceSnapshot) {
                const terminal = terminalsRef.current.get(pane.id);
                if (terminal) {
                  terminal.reset();
                  if (pendingDuringSnapshot) {
                    terminal.write(pendingDuringSnapshot);
                  }
                }
                sessionBuffers.set(pane.id, pendingDuringSnapshot);
                pendingRestoreBuffer = false;
                sessionCursors.delete(pane.id);
                sessionSnapshots.add(pane.id);
              }
              return;
            }
            if (!shouldForceSnapshot && hasTerminal && sessionSnapshots.has(pane.id)) {
              return;
            }
            try {
              const cursor = await getTmuxPaneCursor(pane.id);
              const terminal = terminalsRef.current.get(pane.id);
              const shouldReplaceSnapshot = shouldForceSnapshot || !terminal;
              if (terminal) {
                if (shouldReplaceSnapshot) {
                  terminal.reset();
                }
                if (shouldForceSnapshot || !sessionSnapshots.has(pane.id)) {
                  terminal.write(normalizedSnapshot);
                  applyCursorToTerminal(terminal, cursor);
                  sessionSnapshots.add(pane.id);
                }
                if (clearedBuffer) {
                  if (pendingDuringSnapshot) {
                    terminal.write(pendingDuringSnapshot);
                  }
                  sessionBuffers.set(pane.id, appendBuffer(normalizedSnapshot, pendingDuringSnapshot));
                } else if (shouldReplaceSnapshot) {
                  sessionBuffers.set(pane.id, normalizedSnapshot);
                } else {
                  sessionBuffers.set(pane.id, appendBuffer(sessionBuffers.get(pane.id), normalizedSnapshot));
                }
                pendingRestoreBuffer = false;
                sessionCursors.set(pane.id, cursor);
                return;
              }
              if (clearedBuffer) {
                sessionBuffers.set(pane.id, appendBuffer(normalizedSnapshot, pendingDuringSnapshot));
              } else if (shouldReplaceSnapshot) {
                sessionBuffers.set(pane.id, normalizedSnapshot);
              } else {
                sessionBuffers.set(pane.id, appendBuffer(sessionBuffers.get(pane.id), normalizedSnapshot));
              }
              pendingRestoreBuffer = false;
              sessionCursors.set(pane.id, cursor);
              sessionSnapshots.add(pane.id);
            } catch (error) {
              console.warn("get cursor position failed", error);
              const cachedCursor = sessionCursors.get(pane.id);
              const terminal = terminalsRef.current.get(pane.id);
              const shouldReplaceSnapshot = shouldForceSnapshot || !terminal;
              if (terminal) {
                if (shouldReplaceSnapshot) {
                  terminal.reset();
                }
                if (shouldForceSnapshot || !sessionSnapshots.has(pane.id)) {
                  terminal.write(normalizedSnapshot);
                  if (cachedCursor) {
                    applyCursorToTerminal(terminal, cachedCursor);
                  }
                  sessionSnapshots.add(pane.id);
                }
                if (clearedBuffer) {
                  if (pendingDuringSnapshot) {
                    terminal.write(pendingDuringSnapshot);
                  }
                  sessionBuffers.set(pane.id, appendBuffer(normalizedSnapshot, pendingDuringSnapshot));
                } else if (shouldReplaceSnapshot) {
                  sessionBuffers.set(pane.id, normalizedSnapshot);
                } else {
                  sessionBuffers.set(pane.id, appendBuffer(sessionBuffers.get(pane.id), normalizedSnapshot));
                }
                pendingRestoreBuffer = false;
                return;
              }
              if (clearedBuffer) {
                sessionBuffers.set(pane.id, appendBuffer(normalizedSnapshot, pendingDuringSnapshot));
              } else if (shouldReplaceSnapshot) {
                sessionBuffers.set(pane.id, normalizedSnapshot);
              } else {
                sessionBuffers.set(pane.id, appendBuffer(sessionBuffers.get(pane.id), normalizedSnapshot));
              }
              pendingRestoreBuffer = false;
              sessionSnapshots.add(pane.id);
            }
          } catch (error) {
            console.warn("Failed to refresh pane snapshot.", error);
          } finally {
            if (pendingRestoreBuffer) {
              sessionBuffers.set(pane.id, previousBuffer);
            }
            sessionSnapshotPending.delete(pane.id);
            sessionSnapshotStarted.delete(pane.id);
            sessionSnapshotLiveOutput.delete(pane.id);
          }
        }),
      );
      if (forceSnapshot) {
        forceSnapshotSessionRef.current = null;
      }
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
      const sessionId = payload.sessionId;
      const paneId = payload.paneId;
      const data = payload.data ?? "";
      if (!sessionId || !paneId || !data) {
        return;
      }
      const sessionBuffers = getSessionMap(pendingOutputBuffers, sessionId);
      const sessionCursors = getSessionMap(pendingCursorPositions, sessionId);
      const sessionLineBreaks = getSessionMap(pendingOutputLineBreaks, sessionId);
      const sessionSnapshotsPending = getSessionSet(paneSnapshotPendingRef.current, sessionId);
      const sessionSnapshotStarted = getSessionMap(paneSnapshotStartedRef.current, sessionId);
      const sessionSnapshotLiveOutput = getSessionSet(paneSnapshotLiveOutputRef.current, sessionId);
      const pendingCR = sessionLineBreaks.get(paneId) ?? false;
      const normalized = sanitizeTmuxOutput(data, pendingCR);
      sessionLineBreaks.set(paneId, normalized.pendingCR);
      const next = appendBuffer(sessionBuffers.get(paneId), normalized.value);
      sessionBuffers.set(paneId, next);
      sessionCursors.delete(paneId);
      if (sessionSnapshotsPending.has(paneId)) {
        const startedAt = sessionSnapshotStarted.get(paneId);
        if (!startedAt || Date.now() - startedAt < SNAPSHOT_OUTPUT_GRACE_MS) {
          return;
        }
        sessionSnapshotLiveOutput.add(paneId);
      }
      if (activeSessionRef.current?.id !== sessionId) {
        return;
      }
      if (statusRef.current !== "ready") {
        setStatus("ready");
      }
      const terminal = terminalsRef.current.get(paneId);
      terminal?.write(normalized.value);
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
      lastSessionIdRef.current = null;
      lastClientSizeRef.current = null;
      pendingClientSizeRef.current = null;
      lastContainerSizeRef.current = null;
      clearRefreshRetry();
      setStatus("idle");
      setPanes([]);
      setWindows([]);
      setActivePaneId(null);
      setActiveWindowId(null);
      return;
    }

    const sessionId = activeSession?.id ?? null;
    if (lastSessionIdRef.current !== sessionId) {
      const previousSessionId = lastSessionIdRef.current;
      lastSessionIdRef.current = sessionId;
      lastClientSizeRef.current = null;
      pendingClientSizeRef.current = null;
      lastContainerSizeRef.current = null;
      forceSnapshotSessionRef.current = sessionId;
      destroyAllTerminals();
      if (previousSessionId && previousSessionId !== sessionId) {
        clearSessionCaches(previousSessionId);
      }
      if (sessionId) {
        clearSessionCaches(sessionId);
      }
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
  }, [activeSession, clearRefreshRetry, clearSessionCaches, destroyAllTerminals, isVisible, refreshState]);

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
        const sessionId = activeSessionRef.current?.id;
        if (!sessionId) {
          return;
        }
        const latest = lastClientSizeRef.current;
        if (latest?.cols === pending.cols && latest?.rows === pending.rows) {
          return;
        }
        lastClientSizeRef.current = pending;
        void resizeTmuxClient(sessionId, pending.cols, pending.rows).catch((error) => {
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
    void (async () => {
      try {
        const { WebglAddon } = await loadWebglModule();
        if (
          !useWebglRendererRef.current ||
          webglAddonsRef.current.has(paneId) ||
          terminalsRef.current.get(paneId) !== terminal
        ) {
          return;
        }
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
    })();
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
        pendingTerminalCreatesRef.current.delete(pane.id);
        const fitAddon = fitAddonsRef.current.get(pane.id);
        if (fitAddon) {
          // 使用 FitAddon 重新适应容器大小
          setTimeout(() => {
            fitAddon.fit();
          }, 0);
        }
        return;
      }
      const existingRequest = pendingTerminalCreatesRef.current.get(pane.id);
      if (existingRequest && paneElementsRef.current.get(pane.id) === element) {
        return;
      }
      terminalCreateSeqRef.current += 1;
      const requestId = terminalCreateSeqRef.current;
      pendingTerminalCreatesRef.current.set(pane.id, requestId);

      void (async () => {
        try {
          const { Terminal, WebLinksAddon, Unicode11Addon, FitAddon } = await loadXtermCoreModules();
          if (pendingTerminalCreatesRef.current.get(pane.id) !== requestId) {
            return;
          }
          if (terminalsRef.current.has(pane.id)) {
            pendingTerminalCreatesRef.current.delete(pane.id);
            return;
          }
          if (paneElementsRef.current.get(pane.id) !== element) {
            pendingTerminalCreatesRef.current.delete(pane.id);
            return;
          }

          const terminal = new Terminal({
            cursorBlink: true,
            cursorStyle: "block",
            fontSize: 12,
            fontFamily: "'Hack', 'Noto Sans SC', monospace",
            fontWeight: "600",
            convertEol: false,
            allowProposedApi: true,
            theme: solarizedDark,
            scrollback: 100000,
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

          if (useWebglRendererRef.current) {
            attachWebglRenderer(pane.id, terminal);
          }

          // 使用 FitAddon 自动适应容器大小
          setTimeout(() => {
            fitAddon.fit();
          }, 0);

          terminal.onData((data) => {
            if (readOnlyRef.current) {
              return;
            }
            const sanitizedInput = sanitizeTmuxInput(data);
            if (!sanitizedInput) {
              return;
            }
            void sendTmuxInput(pane.id, sanitizedInput).catch((error) => {
              console.error("Failed to send tmux input.", error);
            });
          });

          terminalsRef.current.set(pane.id, terminal);
          fitAddonsRef.current.set(pane.id, fitAddon);
          pendingTerminalCreatesRef.current.delete(pane.id);

          const sessionId = activeSessionRef.current?.id;
          if (sessionId) {
            const sessionBuffers = getSessionMap(pendingOutputBuffers, sessionId);
            const sessionCursors = getSessionMap(pendingCursorPositions, sessionId);
            const sessionSnapshots = getSessionSet(paneSnapshotAppliedRef.current, sessionId);
            const buffered = sessionBuffers.get(pane.id);
            if (buffered && buffered.length > 0) {
              terminal.write(buffered);
              sessionSnapshots.add(pane.id);
            }
            const cursor = sessionCursors.get(pane.id);
            applyCursorToTerminal(terminal, cursor);
          }
          updateClientSize();
        } catch (error) {
          if (pendingTerminalCreatesRef.current.get(pane.id) === requestId) {
            pendingTerminalCreatesRef.current.delete(pane.id);
          }
          console.error("Failed to load xterm modules.", error);
        }
      })();
    },
    [attachWebglRenderer, updateClientSize],
  );

  const registerPane = useCallback(
    (paneId: string, element: HTMLDivElement | null) => {
      if (!element) {
        paneElementsRef.current.delete(paneId);
        pendingTerminalCreatesRef.current.delete(paneId);
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
        pendingTerminalCreatesRef.current.delete(paneId);
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
    if (readOnlyRef.current) {
      return;
    }
    void selectTmuxPane(paneId).catch((error) => {
      console.error("Failed to select tmux pane.", error);
    });
  }, []);

  const focusPaneDirection = useCallback((direction: "left" | "right" | "up" | "down") => {
    if (readOnlyRef.current) {
      return;
    }
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
      if (readOnlyRef.current) {
        return;
      }
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
    if (readOnlyRef.current) {
      return;
    }
    const paneId = activePaneRef.current;
    if (!paneId) {
      return;
    }
    void splitTmuxPane(paneId, direction).catch((error) => {
      console.error("Failed to split tmux pane.", error);
    });
  }, []);

  const killActivePane = useCallback(() => {
    if (readOnlyRef.current) {
      return;
    }
    const paneId = activePaneRef.current;
    if (!paneId) {
      return;
    }
    void killTmuxPane(paneId).catch((error) => {
      console.error("Failed to kill tmux pane.", error);
    });
  }, []);

  const selectWindow = useCallback((windowId: string) => {
    if (readOnlyRef.current) {
      return;
    }
    void selectTmuxWindow(windowId).catch((error) => {
      console.error("Failed to select tmux window.", error);
    });
  }, []);

  const selectWindowIndex = useCallback(
    (index: number) => {
      if (readOnlyRef.current) {
        return;
      }
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
    if (readOnlyRef.current) {
      return;
    }
    void nextTmuxWindow().catch((error) => {
      console.error("Failed to select next tmux window.", error);
    });
  }, []);

  const previousWindow = useCallback(() => {
    if (readOnlyRef.current) {
      return;
    }
    void previousTmuxWindow().catch((error) => {
      console.error("Failed to select previous tmux window.", error);
    });
  }, []);

  const newWindow = useCallback(() => {
    if (readOnlyRef.current) {
      return;
    }
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
