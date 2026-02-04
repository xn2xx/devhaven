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
  onExit: (sessionId: string, code?: number | null) => void;
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
  onExit,
  onRegisterSnapshotProvider,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const serializeAddonRef = useRef<SerializeAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
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
    let webglAddon: WebglAddon | null = null;
    if (useWebgl) {
      try {
        webglAddon = new WebglAddon();
        term.loadAddon(webglAddon);
      } catch (error) {
        // WebGL 不可用时降级为默认渲染器即可，不应阻塞终端。
        console.warn("WebGL 终端渲染初始化失败，将回退到默认渲染。", error);
        try {
          webglAddon?.dispose();
        } catch {
          // ignore
        }
        webglAddon = null;
      }
    }
    const safeFit = () => {
      if (disposed) {
        return;
      }
      const core = (term as Terminal & { _core?: { _renderService?: { hasRenderer?: () => boolean } } })._core;
      const renderService = core?._renderService;
      if (renderService && typeof renderService.hasRenderer === "function" && !renderService.hasRenderer()) {
        return;
      }
      try {
        fitAddon.fit();
      } catch (error) {
        console.warn("终端尺寸自适配失败，稍后将重试。", error);
      }
    };

    term.open(container);
    requestAnimationFrame(() => {
      if (disposed) {
        return;
      }
      safeFit();
    });
    if (savedState && !restoredRef.current) {
      restoredRef.current = true;
      term.write(savedState);
    }
    termRef.current = term;
    fitAddonRef.current = fitAddon;
    serializeAddonRef.current = serializeAddon;
    webglAddonRef.current = webglAddon;

    const resizeObserver = new ResizeObserver(() => {
      safeFit();
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
      let result: { ptyId: string } | null = null;
      try {
        result = await createTerminalSession({
          projectPath: cwd,
          cols: term.cols,
          rows: term.rows,
          windowLabel,
          sessionId,
        });
      } catch (error) {
        console.error("创建终端会话失败。", error);
        term.write("\r\n[创建终端会话失败]\r\n");
        return;
      }

      if (disposed) {
        await killTerminal(result.ptyId);
        return;
      }

      ptyIdRef.current = result.ptyId;
      void resizeTerminal(result.ptyId, term.cols, term.rows);

      try {
        const outputUnlisten = await listenTerminalOutput((event) => {
          if (event.payload.sessionId !== sessionId) {
            return;
          }
          if (disposed) {
            return;
          }
          term.write(event.payload.data);
        });
        if (disposed) {
          outputUnlisten();
          void killTerminal(result.ptyId);
          return;
        }
        unlistenOutput = outputUnlisten;
      } catch (error) {
        console.error("订阅终端输出事件失败。", error);
        term.write("\r\n[订阅终端输出事件失败：请检查 Tauri capabilities 是否允许 terminal-* 窗口使用 core:event.listen]\r\n");
        void killTerminal(result.ptyId);
        return;
      }

      try {
        const exitUnlisten = await listenTerminalExit((event) => {
          if (event.payload.sessionId !== sessionId) {
            return;
          }
          if (disposed) {
            return;
          }
          onExit(sessionId, event.payload.code ?? null);
        });
        if (disposed) {
          exitUnlisten();
          unlistenOutput?.();
          void killTerminal(result.ptyId);
          return;
        }
        unlistenExit = exitUnlisten;
      } catch (error) {
        console.error("订阅终端退出事件失败。", error);
        term.write("\r\n[订阅终端退出事件失败：请检查 Tauri capabilities 是否允许 terminal-* 窗口使用 core:event.listen]\r\n");
      }
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
      // 注意：xterm@5 的 AddonManager 会在 core dispose 之后再 dispose addons，
      // WebglAddon 的 dispose 会调用 renderService.setRenderer，这时 renderService 已被 dispose
      // 会导致 `this._renderer.value.onRequestRedraw` 报错。
      //
      // 这里手动先 dispose WebglAddon，并把 `term.dispose()` 延迟到下一轮事件循环，
      // 避免 WebglAddon dispose 触发的渲染刷新/Viewport 定时器在 renderer 被销毁后执行，
      // 导致 `this._renderer.value.dimensions` 等空引用报错。
      try {
        webglAddonRef.current?.dispose();
      } catch (error) {
        console.warn("释放 WebGL 终端渲染器失败。", error);
      } finally {
        webglAddonRef.current = null;
      }
      setTimeout(() => {
        try {
          term.dispose();
        } catch (error) {
          console.warn("释放终端实例失败。", error);
        }
      }, 0);
    };
  }, [cwd, savedState, sessionId, useWebgl, windowLabel, onExit, onRegisterSnapshotProvider]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    const fitAddon = fitAddonRef.current;
    if (fitAddon && termRef.current) {
      const core = (termRef.current as Terminal & {
        _core?: { _renderService?: { hasRenderer?: () => boolean } };
      })._core;
      const renderService = core?._renderService;
      if (!renderService || (typeof renderService.hasRenderer === "function" && !renderService.hasRenderer())) {
        return;
      }
      try {
        fitAddon.fit();
      } catch (error) {
        console.warn("终端尺寸自适配失败，稍后将重试。", error);
      }
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
