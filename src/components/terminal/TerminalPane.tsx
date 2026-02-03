import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebglAddon } from "xterm-addon-webgl";
import { SerializeAddon } from "xterm-addon-serialize";
import "xterm/css/xterm.css";

import {
  createTerminalSession,
  killTerminal,
  listenTerminalExit,
  listenTerminalOutput,
  resizeTerminal,
  writeTerminal,
} from "../../services/terminal";

export type TerminalPaneProps = {
  sessionId: string;
  cwd: string;
  savedState?: string | null;
  windowLabel: string;
  useWebgl: boolean;
  isActive: boolean;
  onActivate: (sessionId: string) => void;
  onRegisterSnapshotProvider: (sessionId: string, provider: () => string | null) => () => void;
};

export default function TerminalPane({
  sessionId,
  cwd,
  savedState,
  windowLabel,
  useWebgl,
  isActive,
  onActivate,
  onRegisterSnapshotProvider,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const serializeAddonRef = useRef<SerializeAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    let disposed = false;
    const term = new Terminal({
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
      fontSize: 12,
      cursorBlink: true,
      scrollback: 1000,
      theme: {
        background: "#0b0b0b",
        foreground: "#e5e7eb",
      },
    });
    const fitAddon = new FitAddon();
    const serializeAddon = new SerializeAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(serializeAddon);
    if (useWebgl) {
      try {
        const webgl = new WebglAddon();
        term.loadAddon(webgl);
      } catch (error) {
        console.warn("WebGL 终端渲染初始化失败。", error);
      }
    }
    term.open(container);
    fitAddon.fit();
    if (savedState && !restoredRef.current) {
      restoredRef.current = true;
      term.write(savedState);
    }
    termRef.current = term;
    fitAddonRef.current = fitAddon;
    serializeAddonRef.current = serializeAddon;

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const ptyId = ptyIdRef.current;
      if (ptyId) {
        void resizeTerminal(ptyId, term.cols, term.rows);
      }
    });
    resizeObserver.observe(container);

    const disposable = term.onData((data) => {
      const ptyId = ptyIdRef.current;
      if (!ptyId) {
        return;
      }
      void writeTerminal(ptyId, data);
    });

    let unlistenOutput: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;

    const connect = async () => {
      const result = await createTerminalSession({
        projectPath: cwd,
        cols: term.cols,
        rows: term.rows,
        windowLabel,
        sessionId,
      });
      if (disposed) {
        await killTerminal(result.ptyId);
        return;
      }
      ptyIdRef.current = result.ptyId;
      void resizeTerminal(result.ptyId, term.cols, term.rows);
      unlistenOutput = await listenTerminalOutput((event) => {
        if (event.payload.sessionId !== sessionId) {
          return;
        }
        term.write(event.payload.data);
      });
      unlistenExit = await listenTerminalExit((event) => {
        if (event.payload.sessionId !== sessionId) {
          return;
        }
        term.write("\r\n[会话已结束]\r\n");
      });
    };

    void connect();

    const unregisterSnapshot = onRegisterSnapshotProvider(sessionId, () => {
      const addon = serializeAddonRef.current;
      if (!addon) {
        return null;
      }
      return addon.serialize({
        excludeAltBuffer: true,
        excludeModes: true,
        scrollback: 1000,
      });
    });

    return () => {
      disposed = true;
      unregisterSnapshot();
      disposable.dispose();
      resizeObserver.disconnect();
      unlistenOutput?.();
      unlistenExit?.();
      const ptyId = ptyIdRef.current;
      if (ptyId) {
        void killTerminal(ptyId);
      }
      term.dispose();
    };
  }, [cwd, savedState, sessionId, useWebgl, windowLabel, onRegisterSnapshotProvider]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    const fitAddon = fitAddonRef.current;
    if (fitAddon) {
      fitAddon.fit();
    }
    termRef.current?.focus();
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className={`terminal-pane h-full w-full ${
        isActive ? "outline outline-1 outline-[rgba(69,59,231,0.35)]" : ""
      }`}
      onMouseDown={() => onActivate(sessionId)}
    />
  );
}
