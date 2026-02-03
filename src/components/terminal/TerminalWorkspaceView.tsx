import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { SplitDirection, TerminalWorkspace } from "../../models/terminal";
import { useDevHavenContext } from "../../state/DevHavenContext";
import { saveTerminalWorkspace, loadTerminalWorkspace } from "../../services/terminalWorkspace";
import { getTerminalWindowLabel } from "../../services/terminalWindow";
import {
  collectSessionIds,
  createDefaultWorkspace,
  createId,
  normalizeWorkspace,
  splitPane,
  updateSplitRatios,
} from "../../utils/terminalLayout";
import SplitLayout from "./SplitLayout";
import TerminalPane from "./TerminalPane";
import TerminalTabs from "./TerminalTabs";

export default function TerminalWorkspaceView() {
  const { appState, projects, projectMap, isLoading } = useDevHavenContext();
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const projectIdParam = searchParams.get("projectId");
  const projectPathParam = searchParams.get("projectPath");
  const projectNameParam = searchParams.get("projectName");

  const project = useMemo(() => {
    if (projectIdParam) {
      return projectMap.get(projectIdParam) ?? null;
    }
    if (projectPathParam) {
      return projects.find((item) => item.path === projectPathParam) ?? null;
    }
    if (projectNameParam) {
      return projects.find((item) => item.name === projectNameParam) ?? null;
    }
    return null;
  }, [projectIdParam, projectMap, projectNameParam, projectPathParam, projects]);

  const projectPath = project?.path ?? projectPathParam ?? "";
  const projectId = project?.id ?? projectIdParam ?? null;
  const windowLabel = getTerminalWindowLabel(projectId);

  const [workspace, setWorkspace] = useState<TerminalWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workspaceRef = useRef<TerminalWorkspace | null>(null);
  const snapshotProviders = useRef(new Map<string, () => string | null>());

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

  useEffect(() => {
    if (!project) {
      return;
    }
    getCurrentWindow()
      .setTitle(`${project.name} - 终端`)
      .catch(() => undefined);
  }, [project]);

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
      <div className="flex h-full items-center justify-center text-secondary-text">
        {isLoading ? "正在加载项目..." : "未找到项目"}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-secondary-text">
        {error}
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex h-full items-center justify-center text-secondary-text">
        正在加载终端工作空间...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0b0b0b] text-text">
      <header className="flex items-center gap-3 border-b border-divider bg-secondary-background px-3 py-2">
        <div className="max-w-[200px] truncate text-[13px] font-semibold text-text">
          {project?.name ?? projectPath}
        </div>
        <TerminalTabs
          tabs={workspace.tabs}
          activeTabId={workspace.activeTabId}
          onSelect={handleSelectTab}
          onNewTab={handleNewTab}
          onCloseTab={handleCloseTab}
        />
        <div className="ml-auto flex items-center gap-2">
          <button className="btn btn-outline" onClick={() => handleSplit("r")}>
            右分屏
          </button>
          <button className="btn btn-outline" onClick={() => handleSplit("b")}>
            下分屏
          </button>
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1">
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
                  useWebgl={appState.settings.terminalUseWebglRenderer}
                  isActive={tab.id === workspace.activeTabId && isActive}
                  onActivate={(nextSessionId) => handleActivateSession(tab.id, nextSessionId)}
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
