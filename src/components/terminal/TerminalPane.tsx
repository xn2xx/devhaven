import { useEffect, useRef } from "react";
import { Terminal, type ITheme } from "xterm";
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

type PtyRegistryEntry = {
  ptyId: string | null;
  cachedState: string | null;
  refs: number;
  killTimer: number | null;
  creating: Promise<string> | null;
};

const PTY_REGISTRY = new Map<string, PtyRegistryEntry>();
const PTY_KILL_GRACE_MS = 1000;

function buildPtyRegistryKey(windowLabel: string, sessionId: string) {
  return `${windowLabel}::${sessionId}`;
}

function getOrCreateRegistryEntry(key: string): PtyRegistryEntry {
  const existing = PTY_REGISTRY.get(key);
  if (existing) {
    return existing;
  }
  const next: PtyRegistryEntry = { ptyId: null, cachedState: null, refs: 0, killTimer: null, creating: null };
  PTY_REGISTRY.set(key, next);
  return next;
}

function retainPtySession(key: string) {
  const entry = getOrCreateRegistryEntry(key);
  entry.refs += 1;
  if (entry.killTimer !== null) {
    window.clearTimeout(entry.killTimer);
    entry.killTimer = null;
  }
}

function releasePtySession(key: string) {
  const entry = PTY_REGISTRY.get(key);
  if (!entry) {
    return;
  }
  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0) {
    return;
  }
  if (entry.killTimer !== null) {
    return;
  }
  if (!entry.ptyId && !entry.creating) {
    PTY_REGISTRY.delete(key);
    return;
  }

  entry.killTimer = window.setTimeout(() => {
    void (async () => {
      const current = PTY_REGISTRY.get(key);
      if (!current || current.refs > 0) {
        return;
      }
      current.killTimer = null;

      let ptyId = current.ptyId;
      if (!ptyId && current.creating) {
        try {
          ptyId = await current.creating;
        } catch {
          // ignore
        }
      }

      const latest = PTY_REGISTRY.get(key);
      if (!latest || latest.refs > 0) {
        return;
      }

      if (ptyId) {
        try {
          await killTerminal(ptyId);
        } catch {
          // ignore
        }
      }
      PTY_REGISTRY.delete(key);
    })();
  }, PTY_KILL_GRACE_MS);
}

async function ensurePtyId(
  key: string,
  request: { cwd: string; cols: number; rows: number; windowLabel: string; sessionId: string },
): Promise<string> {
  const entry = getOrCreateRegistryEntry(key);
  if (entry.ptyId) {
    return entry.ptyId;
  }
  if (entry.creating) {
    return entry.creating;
  }

  entry.creating = (async () => {
    const result = await createTerminalSession({
      projectPath: request.cwd,
      cols: request.cols,
      rows: request.rows,
      windowLabel: request.windowLabel,
      sessionId: request.sessionId,
    });
    entry.ptyId = result.ptyId;
    return result.ptyId;
  })();

  try {
    return await entry.creating;
  } finally {
    const latest = PTY_REGISTRY.get(key);
    if (latest) {
      latest.creating = null;
    }
  }
}

export type TerminalPaneProps = {
  sessionId: string;
  cwd: string;
  savedState?: string | null;
  windowLabel: string;
  useWebgl: boolean;
  theme: ITheme;
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
  theme,
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
  const themeRef = useRef<ITheme>(theme);
  themeRef.current = theme;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const registryKey = buildPtyRegistryKey(windowLabel, sessionId);
    retainPtySession(registryKey);
    const registryEntry = getOrCreateRegistryEntry(registryKey);

    let disposed = false;
    const term = new Terminal({
      // 需要用 parser hook 过滤光标形态控制序列（Ghostty: shell-integration-features = no-cursor）。
      allowProposedApi: true,
      fontFamily:
        "\"Hack\", \"Hack Nerd Font\", \"Noto Sans SC\", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
      fontSize: 12,
      cursorStyle: "block",
      cursorBlink: true,
      scrollback: 1000,
      theme: themeRef.current,
    });
    // 忽略 DECSCUSR（CSI Ps SP q），避免 shell/应用切换插入/正常模式时改成条形光标等。
    const cursorStyleHandler = term.parser.registerCsiHandler({ intermediates: " ", final: "q" }, () => true);
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
    const stateToRestore = registryEntry.cachedState ?? savedState;
    if (stateToRestore && !restoredRef.current) {
      restoredRef.current = true;
      registryEntry.cachedState = null;
      term.write(stateToRestore);
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
      let ptyId: string | null = null;
      try {
        ptyId = await ensurePtyId(registryKey, {
          cwd,
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
        return;
      }

      ptyIdRef.current = ptyId;
      void resizeTerminal(ptyId, term.cols, term.rows);

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
          return;
        }
        unlistenOutput = outputUnlisten;
      } catch (error) {
        console.error("订阅终端输出事件失败。", error);
        term.write("\r\n[订阅终端输出事件失败：请检查 Tauri capabilities 是否允许 terminal-* 窗口使用 core:event.listen]\r\n");
        // 无法监听输出时，这个会话基本不可用，避免在后台残留。
        const entry = PTY_REGISTRY.get(registryKey);
        const currentPty = entry?.ptyId ?? null;
        PTY_REGISTRY.delete(registryKey);
        if (currentPty) {
          void killTerminal(currentPty);
        }
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
      try {
        const entry = PTY_REGISTRY.get(registryKey);
        const addon = serializeAddonRef.current;
        if (entry && addon) {
          entry.cachedState = addon.serialize({
            excludeAltBuffer: false,
            excludeModes: true,
            scrollback: 1000,
          });
        }
      } catch (error) {
        console.warn("缓存终端状态失败。", error);
      }
      unregisterSnapshot();
      cursorStyleHandler.dispose();
      disposable.dispose();
      resizeObserver.disconnect();
      unlistenOutput?.();
      unlistenExit?.();
      releasePtySession(registryKey);
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
    const term = termRef.current;
    if (!term) {
      return;
    }
    try {
      term.options.theme = theme;
      term.refresh(0, Math.max(0, term.rows - 1));
    } catch (error) {
      console.warn("更新终端主题失败。", error);
    }
  }, [theme]);

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
      className={`terminal-pane flex h-full w-full min-h-0 min-w-0 p-[10px] ${
        isActive ? "outline outline-1 outline-[var(--terminal-accent-outline)]" : ""
      }`}
      onMouseDownCapture={() => onActivate(sessionId)}
    >
      <div ref={containerRef} className="min-h-0 min-w-0 flex-1" />
    </div>
  );
}
