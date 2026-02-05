import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ITheme } from "xterm";

import type { SplitDirection, TerminalWorkspace } from "../../models/terminal";
import type { ProjectScript } from "../../models/types";
import { useDevHavenContext } from "../../state/DevHavenContext";
import { saveTerminalWorkspace, loadTerminalWorkspace } from "../../services/terminalWorkspace";
import {
  collectSessionIds,
  createDefaultWorkspace,
  createId,
  findPanePath,
  normalizeWorkspace,
  removePane,
  splitPane,
  updateSplitRatios,
} from "../../utils/terminalLayout";
import { IconSidebarRight, IconX } from "../Icons";
import SplitLayout from "./SplitLayout";
import TerminalPane from "./TerminalPane";
import TerminalTabs from "./TerminalTabs";

export type TerminalWorkspaceViewProps = {
  projectId: string | null;
  projectPath: string;
  projectName?: string | null;
  isActive: boolean;
  windowLabel: string;
  xtermTheme: ITheme;
  codexRunningCount?: number;
  scripts?: ProjectScript[];
};

export default function TerminalWorkspaceView({
  projectId,
  projectPath,
  projectName,
  isActive,
  windowLabel,
  xtermTheme,
  codexRunningCount = 0,
  scripts = [],
}: TerminalWorkspaceViewProps) {
  const { appState } = useDevHavenContext();

  const [workspace, setWorkspace] = useState<TerminalWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workspaceRef = useRef<TerminalWorkspace | null>(null);
  const snapshotProviders = useRef(new Map<string, () => string | null>());

  const stageRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelDraft, setPanelDraft] = useState<{ x: number; y: number } | null>(null);
  const panelDraftRef = useRef<{ x: number; y: number } | null>(null);
  const dragStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    if (!projectPath) {
      return;
    }
    let cancelled = false;
    setError(null);
    loadTerminalWorkspace(projectPath)
      .then((data) => {
        if (cancelled) {
          return;
        }
        const next = data
          ? normalizeWorkspace(data, projectPath, projectId)
          : createDefaultWorkspace(projectPath, projectId);
        setWorkspace(next);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
        setWorkspace(createDefaultWorkspace(projectPath, projectId));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, projectPath]);

  const registerSnapshotProvider = useCallback(
    (sessionId: string, provider: () => string | null) => {
      snapshotProviders.current.set(sessionId, provider);
      return () => snapshotProviders.current.delete(sessionId);
    },
    [],
  );

  const saveWorkspace = useCallback(async () => {
    const current = workspaceRef.current;
    if (!current) {
      return;
    }
    const sessions = { ...current.sessions };
    Object.entries(sessions).forEach(([sessionId, snapshot]) => {
      const provider = snapshotProviders.current.get(sessionId);
      if (provider) {
        sessions[sessionId] = { ...snapshot, savedState: provider() ?? null };
      }
    });
    const payload = {
      ...current,
      sessions,
      updatedAt: Date.now(),
    };
    try {
      await saveTerminalWorkspace(current.projectPath, payload);
    } catch (err) {
      console.error("保存终端工作空间失败。", err);
    }
  }, []);

  useEffect(() => {
    if (!workspace) {
      return;
    }
    const timer = window.setTimeout(() => {
      void saveWorkspace();
    }, 800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [workspace, saveWorkspace]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      void saveWorkspace();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [saveWorkspace]);

  const updateWorkspace = useCallback(
    (updater: (current: TerminalWorkspace) => TerminalWorkspace) => {
      setWorkspace((prev) => (prev ? updater(prev) : prev));
    },
    [],
  );

  useEffect(() => {
    if (!workspace) {
      return;
    }
    const panel = workspace.ui?.quickCommandsPanel;
    if (!panel || !panel.open) {
      return;
    }
    if (panel.x !== null && panel.y !== null) {
      return;
    }
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const margin = 12;
    const defaultWidth = 260;
    const rect = stage.getBoundingClientRect();
    const resolvedX =
      panel.x !== null ? panel.x : Math.max(margin, Math.round(rect.width - defaultWidth - margin));
    const resolvedY = panel.y !== null ? panel.y : margin;
    updateWorkspace((current) => ({
      ...current,
      ui: {
        ...current.ui,
        quickCommandsPanel: {
          ...(current.ui?.quickCommandsPanel ?? { open: true, x: null, y: null }),
          x: resolvedX,
          y: resolvedY,
        },
      },
    }));
  }, [updateWorkspace, workspace]);

  const handleSelectTab = useCallback(
    (tabId: string) => {
      updateWorkspace((current) => ({ ...current, activeTabId: tabId }));
    },
    [updateWorkspace],
  );

  const handleNewTab = useCallback(() => {
    updateWorkspace((current) => {
      const sessionId = createId();
      const tabId = createId();
      const title = `终端 ${current.tabs.length + 1}`;
      return {
        ...current,
        activeTabId: tabId,
        tabs: [
          ...current.tabs,
          {
            id: tabId,
            title,
            root: { type: "pane", sessionId },
            activeSessionId: sessionId,
          },
        ],
        sessions: {
          ...current.sessions,
          [sessionId]: { id: sessionId, cwd: current.projectPath, savedState: null },
        },
      };
    });
  }, [updateWorkspace]);

  const handleCloseTab = useCallback(
    (tabId: string) => {
      updateWorkspace((current) => {
        const remainingTabs = current.tabs.filter((tab) => tab.id !== tabId);
        const closedTab = current.tabs.find((tab) => tab.id === tabId);
        const removedSessions = closedTab ? collectSessionIds(closedTab.root) : [];
        if (remainingTabs.length === 0) {
          return createDefaultWorkspace(current.projectPath, current.projectId);
        }
        const nextSessions = { ...current.sessions };
        removedSessions.forEach((sessionId) => {
          delete nextSessions[sessionId];
        });
        const nextActiveTabId =
          current.activeTabId === tabId ? remainingTabs[0].id : current.activeTabId;
        return {
          ...current,
          tabs: remainingTabs,
          activeTabId: nextActiveTabId,
          sessions: nextSessions,
        };
      });
    },
    [updateWorkspace],
  );

  const handleSelectTabRelative = useCallback(
    (delta: number) => {
      updateWorkspace((current) => {
        if (current.tabs.length <= 1) {
          return current;
        }
        const currentIndex = current.tabs.findIndex((tab) => tab.id === current.activeTabId);
        if (currentIndex < 0) {
          return current;
        }
        const nextIndex = (currentIndex + delta + current.tabs.length) % current.tabs.length;
        return { ...current, activeTabId: current.tabs[nextIndex].id };
      });
    },
    [updateWorkspace],
  );

  const handleSelectTabIndex = useCallback(
    (index: number) => {
      updateWorkspace((current) => {
        if (index < 0 || index >= current.tabs.length) {
          return current;
        }
        return { ...current, activeTabId: current.tabs[index].id };
      });
    },
    [updateWorkspace],
  );

  const handleSplit = useCallback(
    (direction: SplitDirection) => {
      updateWorkspace((current) => {
        const activeTab = current.tabs.find((tab) => tab.id === current.activeTabId);
        if (!activeTab) {
          return current;
        }
        const newSessionId = createId();
        const nextRoot = splitPane(activeTab.root, activeTab.activeSessionId, direction, newSessionId);
        const nextTab = {
          ...activeTab,
          root: nextRoot,
          activeSessionId: newSessionId,
        };
        return {
          ...current,
          tabs: current.tabs.map((tab) => (tab.id === activeTab.id ? nextTab : tab)),
          sessions: {
            ...current.sessions,
            [newSessionId]: { id: newSessionId, cwd: current.projectPath, savedState: null },
          },
        };
      });
    },
    [updateWorkspace],
  );

  const handleSessionExit = useCallback(
    (sessionId: string) => {
      updateWorkspace((current) => {
        const targetIndex = current.tabs.findIndex((tab) => findPanePath(tab.root, sessionId) !== null);
        if (targetIndex < 0) {
          return current;
        }

        const targetTab = current.tabs[targetIndex];
        const nextRoot = removePane(targetTab.root, sessionId);
        const beforeSessionIds = collectSessionIds(targetTab.root);
        const afterSessionIds = nextRoot ? collectSessionIds(nextRoot) : [];
        const afterSet = new Set(afterSessionIds);
        const removedSessions = beforeSessionIds.filter((id) => !afterSet.has(id));

        const nextSessions = { ...current.sessions };
        removedSessions.forEach((id) => {
          delete nextSessions[id];
        });

        if (!nextRoot) {
          const remainingTabs = current.tabs.filter((tab) => tab.id !== targetTab.id);
          if (remainingTabs.length === 0) {
            return createDefaultWorkspace(current.projectPath, current.projectId);
          }
          const nextActiveTabId =
            current.activeTabId === targetTab.id ? remainingTabs[0].id : current.activeTabId;
          return {
            ...current,
            tabs: remainingTabs,
            activeTabId: nextActiveTabId,
            sessions: nextSessions,
          };
        }

        const nextActiveSessionId = afterSet.has(targetTab.activeSessionId)
          ? targetTab.activeSessionId
          : afterSessionIds[0];
        const nextTab = { ...targetTab, root: nextRoot, activeSessionId: nextActiveSessionId };
        return {
          ...current,
          tabs: current.tabs.map((tab) => (tab.id === targetTab.id ? nextTab : tab)),
          sessions: nextSessions,
        };
      });
    },
    [updateWorkspace],
  );

  const setQuickCommandsPanelOpen = useCallback(
    (open: boolean) => {
      updateWorkspace((current) => ({
        ...current,
        ui: {
          ...current.ui,
          quickCommandsPanel: {
            ...(current.ui?.quickCommandsPanel ?? { open: true, x: null, y: null }),
            open,
          },
        },
      }));
    },
    [updateWorkspace],
  );

  const commitQuickCommandsPanelPosition = useCallback(
    (x: number, y: number) => {
      updateWorkspace((current) => ({
        ...current,
        ui: {
          ...current.ui,
          quickCommandsPanel: {
            ...(current.ui?.quickCommandsPanel ?? { open: true, x: null, y: null }),
            x,
            y,
          },
        },
      }));
    },
    [updateWorkspace],
  );

  const beginDragQuickCommandsPanel = useCallback(
    (event: ReactPointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const current = workspaceRef.current;
      const panel = current?.ui?.quickCommandsPanel ?? { open: true, x: null, y: null };
      const base = panelDraftRef.current ?? { x: panel.x ?? 12, y: panel.y ?? 12 };
      dragStateRef.current = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        baseX: base.x,
        baseY: base.y,
      };

      const handleMove = (moveEvent: PointerEvent) => {
        const state = dragStateRef.current;
        if (!state) {
          return;
        }
        const stage = stageRef.current;
        if (!stage) {
          return;
        }
        const stageRect = stage.getBoundingClientRect();
        const panelRect = panelRef.current?.getBoundingClientRect() ?? null;
        const panelWidth = panelRect ? panelRect.width : 260;
        const panelHeight = panelRect ? panelRect.height : 240;
        const margin = 8;
        const maxX = Math.max(margin, Math.round(stageRect.width - panelWidth - margin));
        const maxY = Math.max(margin, Math.round(stageRect.height - panelHeight - margin));

        const dx = moveEvent.clientX - state.startClientX;
        const dy = moveEvent.clientY - state.startClientY;
        const nextX = Math.min(maxX, Math.max(margin, Math.round(state.baseX + dx)));
        const nextY = Math.min(maxY, Math.max(margin, Math.round(state.baseY + dy)));
        panelDraftRef.current = { x: nextX, y: nextY };
        setPanelDraft({ x: nextX, y: nextY });
      };

      const handleUp = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        const latest = panelDraftRef.current;
        panelDraftRef.current = null;
        dragStateRef.current = null;
        if (latest) {
          commitQuickCommandsPanelPosition(latest.x, latest.y);
        }
        setPanelDraft(null);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [commitQuickCommandsPanelPosition],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }
      if (!event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const key = event.key.toLowerCase();

      // 仅按下 Cmd（Meta）本身也可能触发 WebView/页面滚动（尤其在终端处于非底部时），直接吞掉。
      if (key === "meta") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // iTerm2 风格：⌘D 向右分屏，⌘⇧D 向下分屏。
      if (key === "d") {
        event.preventDefault();
        event.stopPropagation();
        handleSplit(event.shiftKey ? "b" : "r");
        return;
      }

      // ⌘T：新建标签页
      if (key === "t" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        handleNewTab();
        return;
      }

      // ⌘W：关闭当前 Pane；若该 Tab 只剩最后一个 Pane，则关闭 Tab
      if (key === "w" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        const current = workspaceRef.current;
        if (!current) {
          return;
        }
        const activeTab = current.tabs.find((tab) => tab.id === current.activeTabId);
        if (!activeTab) {
          return;
        }
        handleSessionExit(activeTab.activeSessionId);
        return;
      }

      // ⌘↑/⌘←：上一 Tab；⌘↓/⌘→：下一 Tab
      if (
        !event.shiftKey &&
        (event.code === "ArrowLeft" ||
          event.code === "ArrowRight" ||
          event.code === "ArrowUp" ||
          event.code === "ArrowDown")
      ) {
        event.preventDefault();
        event.stopPropagation();
        handleSelectTabRelative(event.code === "ArrowLeft" || event.code === "ArrowUp" ? -1 : 1);
        return;
      }

      // ⌘⇧[ / ⌘⇧]：上一/下一 Tab（浏览器/iTerm2 常用）
      if (event.shiftKey && (event.code === "BracketLeft" || event.code === "BracketRight")) {
        event.preventDefault();
        event.stopPropagation();
        handleSelectTabRelative(event.code === "BracketLeft" ? -1 : 1);
        return;
      }

      // ⌘1..⌘8：切换到对应 Tab；⌘9：切到最后一个 Tab（浏览器常用）
      if (!event.shiftKey) {
        const digit = Number.parseInt(key, 10);
        if (Number.isFinite(digit) && digit >= 1 && digit <= 9) {
          event.preventDefault();
          event.stopPropagation();
          const current = workspaceRef.current;
          if (!current) {
            return;
          }
          const index = digit === 9 ? current.tabs.length - 1 : digit - 1;
          handleSelectTabIndex(index);
        }
      }
    };

    // Capture phase：确保终端（xterm）聚焦时也能触发快捷键。
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [handleNewTab, handleSelectTabIndex, handleSelectTabRelative, handleSessionExit, handleSplit, isActive]);

  const handleResize = useCallback(
    (path: number[], ratios: number[]) => {
      updateWorkspace((current) => {
        const activeTab = current.tabs.find((tab) => tab.id === current.activeTabId);
        if (!activeTab) {
          return current;
        }
        const nextRoot = updateSplitRatios(activeTab.root, path, ratios);
        const nextTab = { ...activeTab, root: nextRoot };
        return {
          ...current,
          tabs: current.tabs.map((tab) => (tab.id === activeTab.id ? nextTab : tab)),
        };
      });
    },
    [updateWorkspace],
  );

  const handleActivateSession = useCallback(
    (tabId: string, sessionId: string) => {
      updateWorkspace((current) => {
        const nextTabs = current.tabs.map((tab) =>
          tab.id === tabId ? { ...tab, activeSessionId: sessionId } : tab,
        );
        return { ...current, tabs: nextTabs };
      });
    },
    [updateWorkspace],
  );

  if (!projectPath) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--terminal-muted-fg)]">
        未找到项目
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--terminal-muted-fg)]">
        {error}
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--terminal-muted-fg)]">
        正在加载终端工作空间...
      </div>
    );
  }

  const panelState = workspace.ui?.quickCommandsPanel ?? { open: true, x: null, y: null };
  const panelOpen = Boolean(panelState.open);
  const panelPosition = panelDraft ?? { x: panelState.x ?? 12, y: panelState.y ?? 12 };

  return (
    <div className="flex h-full flex-col bg-[var(--terminal-bg)] text-[var(--terminal-fg)]">
      <header className="flex items-center gap-3 border-b border-[var(--terminal-divider)] bg-[var(--terminal-panel-bg)] px-3 py-2">
        <div className="max-w-[200px] truncate text-[13px] font-semibold text-[var(--terminal-fg)]">
          {projectName ?? projectPath}
        </div>
        {codexRunningCount > 0 ? (
          <div
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--terminal-divider)] bg-[var(--terminal-hover-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--terminal-muted-fg)]"
            title={`Codex 运行中（${codexRunningCount} 个会话）`}
          >
            <span className="h-2 w-2 rounded-full bg-[var(--terminal-accent)]" aria-hidden="true" />
            <span className="whitespace-nowrap">Codex 运行中</span>
          </div>
        ) : null}
        <button
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--terminal-divider)] text-[var(--terminal-muted-fg)] transition-colors duration-150 hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)] ${
            panelOpen ? "bg-[var(--terminal-hover-bg)]" : ""
          }`}
          type="button"
          title={panelOpen ? "隐藏快捷命令" : "显示快捷命令"}
          onClick={() => setQuickCommandsPanelOpen(!panelOpen)}
        >
          <IconSidebarRight size={16} />
        </button>
        <TerminalTabs
          tabs={workspace.tabs}
          activeTabId={workspace.activeTabId}
          onSelect={handleSelectTab}
          onNewTab={handleNewTab}
          onCloseTab={handleCloseTab}
        />
      </header>
      <div ref={stageRef} className="relative flex min-h-0 flex-1">
        {panelOpen ? (
          <div
            ref={panelRef}
            className="absolute z-20 w-[260px] select-none rounded-lg border border-[var(--terminal-divider)] bg-[var(--terminal-panel-bg)] shadow-lg"
            style={{ transform: `translate3d(${panelPosition.x}px, ${panelPosition.y}px, 0)` }}
          >
            <div
              className="flex items-center justify-between gap-2 border-b border-[var(--terminal-divider)] px-3 py-2 text-[12px] font-semibold text-[var(--terminal-muted-fg)] cursor-move"
              onPointerDown={beginDragQuickCommandsPanel}
            >
              <span className="truncate">快捷命令</span>
              <button
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-[var(--terminal-muted-fg)] hover:border-[var(--terminal-divider)] hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)]"
                type="button"
                title="关闭"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setQuickCommandsPanelOpen(false);
                }}
              >
                <IconX size={12} />
              </button>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2">
              {scripts.length === 0 ? (
                <div className="px-2 py-2 text-[12px] text-[var(--terminal-muted-fg)]">
                  暂无快捷命令，请在项目详情面板中配置
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {scripts.map((script) => {
                    return (
                      <div
                        key={script.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-[var(--terminal-divider)] bg-[var(--terminal-bg)] px-2.5 py-2"
                        title={script.start}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-semibold text-[var(--terminal-fg)]">
                            {script.name}
                          </div>
                          <div className="truncate text-[11px] text-[var(--terminal-muted-fg)]">
                            {script.start}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
        {workspace.tabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 flex min-h-0 flex-1 ${
              tab.id === workspace.activeTabId ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <SplitLayout
              root={tab.root}
              activeSessionId={tab.activeSessionId}
              onActivate={(sessionId) => handleActivateSession(tab.id, sessionId)}
              onResize={handleResize}
              renderPane={(sessionId, isActive) => (
                <TerminalPane
                  sessionId={sessionId}
                  cwd={workspace.sessions[sessionId]?.cwd ?? workspace.projectPath}
                  savedState={workspace.sessions[sessionId]?.savedState ?? null}
                  windowLabel={windowLabel}
                  // 仅对当前激活 Tab 启用 WebGL 渲染，避免创建过多 WebGL contexts（浏览器有上限）。
                  useWebgl={appState.settings.terminalUseWebglRenderer && tab.id === workspace.activeTabId}
                  theme={xtermTheme}
                  isActive={tab.id === workspace.activeTabId && isActive}
                  onActivate={(nextSessionId) => handleActivateSession(tab.id, nextSessionId)}
                  onExit={handleSessionExit}
                  onRegisterSnapshotProvider={registerSnapshotProvider}
                />
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
