import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { listen } from "@tauri-apps/api/event";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { Unicode11Addon } from "xterm-addon-unicode11";
import { WebglAddon } from "xterm-addon-webgl";

import { resizeTerminalSession, switchTerminalSession, TERMINAL_OUTPUT_EVENT, writeToTerminal } from "../services/terminal";
import { solarizedDark } from "../styles/terminal-themes";
import "xterm/css/xterm.css";

const MAX_BUFFER_CHARS = 200_000;

// 全局缓冲区，独立于组件生命周期，防止组件重新挂载时数据丢失
const globalOutputBuffers = new Map<string, string>();

export type TerminalStatus = "idle" | "preparing" | "connecting" | "ready" | "error";

type UseTerminalSessionOptions = {
  activeSessionId: string | null;
  isVisible: boolean;
};

export type TerminalSessionState = {
  status: TerminalStatus;
  containerRef: RefObject<HTMLDivElement | null>;
};

const appendBuffer = (existing: string | undefined, data: string) => {
  const next = (existing ?? "") + data;
  if (next.length <= MAX_BUFFER_CHARS) {
    return next;
  }
  return next.slice(next.length - MAX_BUFFER_CHARS);
};

export const useTerminalSession = ({
  activeSessionId,
  isVisible,
}: UseTerminalSessionOptions): TerminalSessionState => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const activeSessionRef = useRef<string | null>(null);
  const renderedSessionRef = useRef<string | null>(null);
  const readySessionRef = useRef<string | null>(null);
  const [status, setStatus] = useState<TerminalStatus>("idle");
  const [terminalReady, setTerminalReady] = useState(false);

  useEffect(() => {
    activeSessionRef.current = activeSessionId;
    if (!activeSessionId) {
      readySessionRef.current = null;
    }
  }, [activeSessionId]);

  const refreshTerminal = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }
    const lastRow = Math.max(0, terminal.rows - 1);
    terminal.refresh(0, lastRow);
    terminal.focus();
  }, []);

  const syncActiveBuffer = useCallback(
    (sessionId: string) => {
      const terminal = terminalRef.current;
      if (!terminal) {
        console.warn("[syncActiveBuffer] terminal not ready");
        return;
      }
      terminal.reset();
      const buffered = globalOutputBuffers.get(sessionId);
      console.log("[syncActiveBuffer]", {
        sessionId,
        bufferSize: buffered?.length ?? 0,
        bufferPreview: buffered?.slice(0, 100),
        allBuffers: Array.from(globalOutputBuffers.keys())
      });
      if (buffered) {
        terminal.write(buffered);
      }
      refreshTerminal();
    },
    [refreshTerminal],
  );

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let canceled = false;
    void listen<unknown>(TERMINAL_OUTPUT_EVENT, (event) => {
      const payload = (() => {
        if (typeof event.payload === "string") {
          try {
            return JSON.parse(event.payload) as { sessionId?: string; session_id?: string; data?: string };
          } catch {
            return { data: event.payload };
          }
        }
        return event.payload as { sessionId?: string; session_id?: string; data?: string };
      })();
      const sessionId = payload.sessionId ?? payload.session_id ?? activeSessionRef.current;
      const data = payload.data ?? "";
      console.log("[terminal-output]", { sessionId, data, activeSession: activeSessionRef.current });
      if (!sessionId || !data) {
        console.warn("[terminal-output] skipped - missing sessionId or data", { sessionId, dataLength: data?.length });
        return;
      }
      const before = globalOutputBuffers.get(sessionId);
      const next = appendBuffer(before, data);
      globalOutputBuffers.set(sessionId, next);
      console.log("[terminal-output] stored", {
        sessionId,
        beforeSize: before?.length ?? 0,
        afterSize: next.length,
        allKeys: Array.from(globalOutputBuffers.keys())
      });
      if (activeSessionRef.current === sessionId) {
        terminalRef.current?.write(data);
      }
    })
      .then((unlistenFn) => {
        if (canceled) {
          unlistenFn();
          return;
        }
        unlisten = unlistenFn;
      })
      .catch((error) => {
        console.error("Failed to listen for terminal output.", error);
      });

    return () => {
      canceled = true;
      if (unlisten) {
        try {
          unlisten();
        } catch {
          // Ignore duplicate unlisten calls.
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible) {
      setStatus("idle");
      renderedSessionRef.current = null;
      readySessionRef.current = null;
      setTerminalReady(false);
      return;
    }

    const container = containerRef.current;
    if (!container || terminalRef.current) {
      return;
    }

    let disposed = false;
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: "'Hack Nerd Font', monospace",
      allowTransparency: false,
      allowProposedApi: true,
      theme: solarizedDark,
      scrollback: 5000,
    });
    const fitAddon = new FitAddon();
    const unicode11Addon = new Unicode11Addon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(unicode11Addon);
    terminal.loadAddon(new WebLinksAddon());

    // 激活 Unicode 11 支持
    terminal.unicode.activeVersion = "11";

    terminal.open(container);

    // 添加键盘事件监听器，确保所有组合键都能传递到终端
    // 这对于 tmux 等工具的快捷键至关重要
    const sendToTmux = (data: string, errorMessage: string) => {
      if (!readySessionRef.current) {
        return;
      }
      void writeToTerminal(data).catch((error) => {
        console.error(errorMessage, error);
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.code === "KeyD") {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) {
            if (event.shiftKey) {
              sendToTmux("\x01\"", "Failed to send tmux vertical split command.");
            } else {
              sendToTmux("\x01%", "Failed to send tmux split command.");
            }
          }
          return;
        }
        if (event.code === "KeyW") {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) {
            sendToTmux("\x01x", "Failed to send tmux kill pane command.");
          }
          return;
        }
      }
      // 检查是否是需要传递给终端的组合键
      const isModifierKey = event.ctrlKey || event.metaKey || event.altKey;
      const isTabKey = event.key === 'Tab';

      if (isModifierKey || isTabKey) {
        // 只保留 Command+Q (macOS) 或 Ctrl+Q (其他平台) 作为退出快捷键
        const isQuitShortcut =
          (event.metaKey || event.ctrlKey) &&
          (event.key === 'q' || event.key === 'Q');

        // 如果不是退出快捷键，阻止默认行为，让终端处理
        if (!isQuitShortcut) {
          event.preventDefault();
        }
      }
    };

    // 在终端容器上添加键盘事件监听
    container.addEventListener('keydown', handleKeyDown, true);

    // WebGL 渲染器必须在 terminal.open() 之后加载
    // 使用 setTimeout 确保 DOM 已经完全渲染
    const webglTimeoutId = window.setTimeout(() => {
      if (!disposed && terminal.element) {
        try {
          const webglAddon = new WebglAddon();
          webglAddonRef.current = webglAddon;
          webglAddon.onContextLoss(() => {
            console.warn("WebGL context lost, disposing addon");
            webglAddon.dispose();
            if (webglAddonRef.current === webglAddon) {
              webglAddonRef.current = null;
            }
          });
          terminal.loadAddon(webglAddon);
          console.log("WebGL renderer loaded successfully");
        } catch (e) {
          webglAddonRef.current = null;
          console.warn("WebGL addon could not be loaded, using canvas renderer", e);
        }
      }
    }, 0);

    const safeFit = () => {
      if (disposed || !terminal.element || !container.isConnected) {
        return false;
      }
      fitAddon.fit();
      return true;
    };

    const disposeRender = terminal.onRender(() => {
      if (safeFit()) {
        disposeRender.dispose();
      }
    });

    const rafId = requestAnimationFrame(() => {
      safeFit();
    });

    const resizeObserver = new ResizeObserver(() => {
      safeFit();
    });
    resizeObserver.observe(container);

    const disposeResize = terminal.onResize((size) => {
      if (!readySessionRef.current) {
        return;
      }
      void resizeTerminalSession(size.cols, size.rows).catch((error) => {
        console.error("Failed to resize terminal session.", error);
      });
    });

    const disposeData = terminal.onData((data) => {
      if (!readySessionRef.current) {
        return;
      }
      void writeToTerminal(data).catch((error) => {
        console.error("Failed to write to terminal.", error);
      });
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    setTerminalReady(true);

    return () => {
      disposed = true;
      window.clearTimeout(webglTimeoutId);
      cancelAnimationFrame(rafId);
      container.removeEventListener('keydown', handleKeyDown, true);
      disposeRender.dispose();
      resizeObserver.disconnect();
      disposeResize.dispose();
      disposeData.dispose();
      if (webglAddonRef.current) {
        webglAddonRef.current.dispose();
        webglAddonRef.current = null;
      }
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      setTerminalReady(false);
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) {
      setStatus("idle");
      return;
    }
    if (!activeSessionId) {
      setStatus("idle");
      readySessionRef.current = null;
      return;
    }
    if (!terminalReady || !terminalRef.current || !fitAddonRef.current) {
      setStatus("preparing");
      return;
    }

    const sessionId = activeSessionId;
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    let canceled = false;

    readySessionRef.current = null;
    setStatus("connecting");
    fitAddon.fit();

    const openSession = async () => {
      await switchTerminalSession(sessionId);
      if (canceled || activeSessionRef.current !== sessionId) {
        return;
      }
      readySessionRef.current = sessionId;
      setStatus("ready");
      // 总是同步缓冲区，因为切换会话时终端会被 reset
      syncActiveBuffer(sessionId);
      renderedSessionRef.current = sessionId;
      if (terminal.cols > 0 && terminal.rows > 0) {
        try {
          await resizeTerminalSession(terminal.cols, terminal.rows);
        } catch (error) {
          console.error("Failed to resize terminal session.", error);
        }
      }
    };

    openSession().catch((error) => {
      if (canceled) {
        return;
      }
      readySessionRef.current = null;
      setStatus("error");
      console.error("Failed to switch terminal session.", error);
    });

    return () => {
      canceled = true;
    };
  }, [activeSessionId, isVisible, refreshTerminal, syncActiveBuffer, terminalReady]);

  return {
    status,
    containerRef,
  };
};
