import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "./App.css";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import DetailPanel from "./components/DetailPanel";
import TagEditDialog from "./components/TagEditDialog";
import DashboardModal from "./components/DashboardModal";
import SettingsModal from "./components/SettingsModal";
import WorkspaceView from "./components/WorkspaceView";
import type { DateFilter, GitFilter } from "./models/filters";
import { DATE_FILTER_OPTIONS } from "./models/filters";
import type { HeatmapData } from "./models/heatmap";
import { HEATMAP_CONFIG } from "./models/heatmap";
import type { TmuxSupportStatus, WorkspaceSession } from "./models/terminal";
import type { ColorData, Project, TagData } from "./models/types";
import { swiftDateToJsDate } from "./models/types";
import { colorDataToHex } from "./utils/colors";
import { formatDateKey } from "./utils/gitDaily";
import { buildGitIdentitySignature } from "./utils/gitIdentity";
import { pickColorForTag } from "./utils/tagColors";
import { DevHavenProvider, useDevHavenContext } from "./state/DevHavenContext";
import { useHeatmapData } from "./state/useHeatmapData";
import { copyToClipboard, openInTerminal } from "./services/system";
import { closeTerminalSession, createTerminalSession, getTmuxSupportStatus } from "./services/terminal";

type AppMode = "gallery" | "workspace";

/** 应用主布局，负责筛选、状态联动与面板展示。 */
function AppLayout() {
  const {
    appState,
    projects,
    projectMap,
    isLoading,
    error,
    refresh,
    addDirectory,
    removeDirectory,
    addProjects,
    addTag,
    renameTag,
    removeTag,
    toggleTagHidden,
    setTagColor,
    addTagToProject,
    removeTagFromProject,
    refreshProject,
    updateGitDaily,
    updateSettings,
  } = useDevHavenContext();

  const [searchText, setSearchText] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [gitFilter, setGitFilter] = useState<GitFilter>("all");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedDirectory, setSelectedDirectory] = useState<string | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);
  const [heatmapFilteredProjectIds, setHeatmapFilteredProjectIds] = useState<Set<string>>(new Set());
  const [heatmapSelectedDateKey, setHeatmapSelectedDateKey] = useState<string | null>(null);
  const [tagDialogState, setTagDialogState] = useState<{ mode: "new" | "edit"; tag?: TagData } | null>(
    null,
  );
  const [showDashboard, setShowDashboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>("gallery");
  const [workspaceSessions, setWorkspaceSessions] = useState<WorkspaceSession[]>([]);
  const [activeWorkspaceSessionId, setActiveWorkspaceSessionId] = useState<string | null>(null);
  const [tmuxSupport, setTmuxSupport] = useState<TmuxSupportStatus>({ supported: true });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const gitDailyRefreshRef = useRef<string | null>(null);
  const gitDailyUpdatingRef = useRef(false);
  const gitIdentitySignatureRef = useRef<string | null>(null);
  const heatmapStore = useHeatmapData(projects, appState.settings.gitIdentities);
  const sidebarHeatmapData = useMemo(
    () => heatmapStore.getHeatmapData(HEATMAP_CONFIG.sidebar.days),
    [heatmapStore],
  );

  const terminalSettings = appState.settings.terminalOpenTool;

  const hiddenTags = useMemo(
    () => new Set(appState.tags.filter((tag) => tag.hidden).map((tag) => tag.name)),
    [appState.tags],
  );

  const filteredProjects = useMemo(() => {
    let result = [...projects];

    if (selectedDirectory) {
      result = result.filter((project) => project.path.startsWith(selectedDirectory));
    }

    result = result.filter((project) => {
      const projectHiddenTags = project.tags.filter((tag) => hiddenTags.has(tag));
      if (projectHiddenTags.length === 0) {
        return true;
      }
      if (selectedTags.size > 0 && !selectedTags.has("全部")) {
        return Array.from(selectedTags).some((tag) => projectHiddenTags.includes(tag));
      }
      return false;
    });

    if (heatmapFilteredProjectIds.size > 0) {
      result = result.filter((project) => heatmapFilteredProjectIds.has(project.id));
    } else if (selectedTags.size > 0) {
      if (!selectedTags.has("全部")) {
        const selectedTagList = Array.from(selectedTags);
        result = result.filter((project) => selectedTagList.every((tag) => project.tags.includes(tag)));
      }
    }

    const trimmedSearch = searchText.trim().toLowerCase();
    if (trimmedSearch) {
      result = result.filter(
        (project) =>
          project.name.toLowerCase().includes(trimmedSearch) || project.path.toLowerCase().includes(trimmedSearch),
      );
    }

    const dateOption = DATE_FILTER_OPTIONS.find((option) => option.value === dateFilter);
    if (dateOption?.days) {
      const cutoff = Date.now() - dateOption.days * 24 * 60 * 60 * 1000;
      result = result.filter((project) => swiftDateToJsDate(project.mtime).getTime() >= cutoff);
    }

    if (gitFilter === "gitOnly") {
      result = result.filter((project) => (project.git_commits ?? 0) > 0);
    } else if (gitFilter === "nonGitOnly") {
      result = result.filter((project) => (project.git_commits ?? 0) === 0);
    }

    result.sort((left, right) => {
      return right.mtime - left.mtime;
    });

    return result;
  }, [projects, selectedDirectory, selectedTags, heatmapFilteredProjectIds, searchText, dateFilter, gitFilter, hiddenTags]);

  const selectedProject = selectedProjectId ? projectMap.get(selectedProjectId) ?? null : null;

  const handleSelectTag = useCallback((tag: string) => {
    if (tag === "全部") {
      setSelectedTags(new Set());
      return;
    }
    setSelectedTags(new Set([tag]));
  }, []);

  const handleSelectProject = useCallback((project: { id: string }, event: React.MouseEvent<HTMLDivElement>) => {
    const isMulti = event.shiftKey || event.metaKey || event.ctrlKey;
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (isMulti) {
        if (next.has(project.id)) {
          next.delete(project.id);
        } else {
          next.add(project.id);
        }
      } else {
        next.clear();
        next.add(project.id);
      }
      return next;
    });
    setSelectedProjectId(project.id);
  }, []);

  const handleSelectHeatmapDate = useCallback((entry: HeatmapData | null) => {
    if (!entry) {
      setHeatmapFilteredProjectIds(new Set());
      setHeatmapSelectedDateKey(null);
      return;
    }
    setHeatmapFilteredProjectIds(new Set(entry.projectIds));
    setHeatmapSelectedDateKey(formatDateKey(entry.date));
  }, []);

  const handleToggleDetail = useCallback(() => {
    setShowDetailPanel((prev) => {
      const next = !prev;
      if (next && !selectedProjectId && selectedProjects.size > 0) {
        setSelectedProjectId(Array.from(selectedProjects)[0]);
      }
      return next;
    });
  }, [selectedProjectId, selectedProjects]);

  const handleAssignTagToProjects = useCallback(
    async (tag: string, projectIds: string[]) => {
      await Promise.all(projectIds.map((projectId) => addTagToProject(projectId, tag)));
      setSelectedTags(new Set());
    },
    [addTagToProject],
  );

  const handleOpenTagEditor = useCallback((tag?: TagData) => {
    setTagDialogState({ mode: tag ? "edit" : "new", tag });
  }, []);

  const showToast = useCallback((message: string, variant: "success" | "error" = "success") => {
    setToast({ message, variant });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 1600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void (async () => {
      try {
        const status = await getTmuxSupportStatus();
        if (!canceled) {
          setTmuxSupport(status);
        }
      } catch (error) {
        console.error("获取 tmux 支持状态失败。", error);
        if (!canceled) {
          setTmuxSupport({ supported: false, reason: "无法检测 tmux 状态" });
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    const missingDaily = projects.filter((project) => project.git_commits > 0 && !project.git_daily);
    if (missingDaily.length === 0) {
      gitDailyRefreshRef.current = null;
      return;
    }
    const signature = missingDaily
      .map((project) => project.path)
      .sort()
      .join("|");
    if (gitDailyUpdatingRef.current || gitDailyRefreshRef.current === signature) {
      return;
    }
    gitDailyRefreshRef.current = signature;
    gitDailyUpdatingRef.current = true;
    void (async () => {
      try {
        await updateGitDaily(missingDaily.map((project) => project.path));
      } finally {
        gitDailyUpdatingRef.current = false;
      }
    })();
  }, [isLoading, projects, updateGitDaily]);

  const gitIdentitySignature = useMemo(
    () => buildGitIdentitySignature(appState.settings.gitIdentities),
    [appState.settings.gitIdentities],
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (gitIdentitySignatureRef.current === null) {
      gitIdentitySignatureRef.current = gitIdentitySignature;
      return;
    }
    if (gitIdentitySignatureRef.current === gitIdentitySignature) {
      return;
    }
    gitIdentitySignatureRef.current = gitIdentitySignature;
    const gitPaths = projects.filter((project) => project.git_commits > 0).map((project) => project.path);
    if (gitPaths.length === 0) {
      return;
    }
    void updateGitDaily(gitPaths);
  }, [gitIdentitySignature, isLoading, projects, updateGitDaily]);

  useEffect(() => {
    if (workspaceSessions.length === 0) {
      setActiveWorkspaceSessionId(null);
      if (appMode === "workspace") {
        setAppMode("gallery");
      }
      return;
    }

    if (activeWorkspaceSessionId && workspaceSessions.some((session) => session.id === activeWorkspaceSessionId)) {
      return;
    }
    setActiveWorkspaceSessionId(workspaceSessions[0].id);
  }, [activeWorkspaceSessionId, appMode, workspaceSessions]);

  const handleTagSubmit = useCallback(
    async (name: string, colorHex: string) => {
      if (!tagDialogState) {
        return;
      }
      if (tagDialogState.mode === "new") {
        await addTag(name, colorHex);
      } else if (tagDialogState.tag) {
        if (tagDialogState.tag.name !== name) {
          await renameTag(tagDialogState.tag.name, name);
        }
        await setTagColor(name, colorHex);
      }
      setTagDialogState(null);
    },
    [addTag, renameTag, setTagColor, tagDialogState],
  );

  /** 获取标签对应的显示颜色。 */
  const getTagColor = useCallback(
    (tagName: string) => {
      const tag = appState.tags.find((item) => item.name === tagName);
      if (tag) {
        return colorDataToHex(tag.color, pickColorForTag(tagName));
      }
      return pickColorForTag(tagName);
    },
    [appState.tags],
  );

  /** 将颜色结构转换为 Hex 字符串，供颜色选择器使用。 */
  const getTagHex = (color?: ColorData) => {
    if (!color) {
      return "#4d4d4d";
    }
    const toHex = (value: number) => Math.round(value * 255).toString(16).padStart(2, "0");
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  };

  const handleCopyPath = useCallback(
    async (path: string) => {
      try {
        await copyToClipboard(path);
        showToast("路径已复制");
      } catch (error) {
        console.error("复制路径失败。", error);
        showToast("复制失败，请重试", "error");
      }
    },
    [showToast],
  );

  const handleOpenInTerminal = useCallback(
    async (path: string) => {
      const commandPath = terminalSettings.commandPath.trim();
      const argumentsList = terminalSettings.arguments.map((arg) => arg.trim()).filter(Boolean);
      try {
        await openInTerminal({
          path,
          command_path: commandPath.length > 0 ? commandPath : null,
          arguments: commandPath.length > 0 && argumentsList.length > 0 ? argumentsList : null,
        });
      } catch (error) {
        console.error("终端打开失败。", error);
        showToast("终端打开失败，请检查终端配置", "error");
      }
    },
    [terminalSettings.arguments, terminalSettings.commandPath, showToast],
  );

  const handleEnterWorkspace = useCallback(
    async (project: Project) => {
      if (!tmuxSupport.supported) {
        showToast(tmuxSupport.reason ?? "tmux 工作空间不可用", "error");
        return;
      }
      const existing = workspaceSessions.find((session) => session.projectId === project.id);
      if (existing) {
        setActiveWorkspaceSessionId(existing.id);
        setAppMode("workspace");
        return;
      }

      try {
        const sessionInfo = await createTerminalSession(project.id, project.path);
        const nextSession: WorkspaceSession = { ...sessionInfo, projectName: project.name };
        setWorkspaceSessions((prev) => {
          if (prev.some((session) => session.id === sessionInfo.id || session.projectId === project.id)) {
            return prev;
          }
          return [...prev, nextSession];
        });
        setActiveWorkspaceSessionId(sessionInfo.id);
        setAppMode("workspace");
      } catch (error) {
        console.error("终端会话创建失败。", error);
        showToast("终端启动失败，请检查默认 shell 与权限", "error");
      }
    },
    [showToast, tmuxSupport.reason, tmuxSupport.supported, workspaceSessions],
  );

  const handleCloseWorkspaceSession = useCallback(
    async (sessionId: string) => {
      try {
        await closeTerminalSession(sessionId);
      } catch (error) {
        console.error("终端会话关闭失败。", error);
        showToast("终端关闭失败，请稍后重试", "error");
      }
      setWorkspaceSessions((prev) => prev.filter((session) => session.id !== sessionId));
    },
    [showToast],
  );

  const handleSelectWorkspaceSession = useCallback((sessionId: string) => {
    setActiveWorkspaceSessionId(sessionId);
  }, []);

  const handleExitWorkspace = useCallback(() => {
    setAppMode("gallery");
  }, []);

  const handleSaveSettings = useCallback(
    async (settings: typeof appState.settings) => {
      try {
        await updateSettings(settings);
      } catch (error) {
        console.error("保存设置失败。", error);
        showToast("保存失败，请稍后重试", "error");
      }
    },
    [showToast, updateSettings],
  );

  return (
    <div className={`app-root${appMode === "workspace" ? " is-workspace" : ""}`}>
      {appMode === "workspace" ? (
        <WorkspaceView
          sessions={workspaceSessions}
          activeSessionId={activeWorkspaceSessionId}
          onSelectSession={handleSelectWorkspaceSession}
          onCloseSession={handleCloseWorkspaceSession}
          onExitWorkspace={handleExitWorkspace}
        />
      ) : (
        <div className={`app-split${showDetailPanel ? " has-detail" : ""}`}>
          <Sidebar
            appState={appState}
            projects={projects}
            heatmapData={sidebarHeatmapData}
            heatmapSelectedDateKey={heatmapSelectedDateKey}
            selectedTags={selectedTags}
            selectedDirectory={selectedDirectory}
            heatmapFilteredProjectIds={heatmapFilteredProjectIds}
            onSelectTag={handleSelectTag}
            onClearHeatmapFilter={() => {
              setHeatmapFilteredProjectIds(new Set());
              setHeatmapSelectedDateKey(null);
            }}
            onSelectHeatmapDate={handleSelectHeatmapDate}
            onSelectDirectory={setSelectedDirectory}
            onOpenTagEditor={handleOpenTagEditor}
            onToggleTagHidden={toggleTagHidden}
            onRemoveTag={removeTag}
            onAssignTagToProjects={handleAssignTagToProjects}
            onAddDirectory={addDirectory}
            onRemoveDirectory={removeDirectory}
            onRefresh={refresh}
            onAddProjects={addProjects}
            isHeatmapLoading={heatmapStore.isLoading}
          />
          <MainContent
            projects={projects}
            filteredProjects={filteredProjects}
            isLoading={isLoading}
            error={error}
            searchText={searchText}
            onSearchTextChange={setSearchText}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            gitFilter={gitFilter}
            onGitFilterChange={setGitFilter}
            showDetailPanel={showDetailPanel}
            onToggleDetailPanel={handleToggleDetail}
            onOpenDashboard={() => setShowDashboard(true)}
            onOpenSettings={() => setShowSettings(true)}
            selectedProjects={selectedProjects}
            onSelectProject={handleSelectProject}
            onEnterWorkspace={handleEnterWorkspace}
            onTagSelected={handleSelectTag}
            onRemoveTagFromProject={removeTagFromProject}
            onRefreshProject={refreshProject}
            onCopyPath={handleCopyPath}
            onOpenInTerminal={handleOpenInTerminal}
            getTagColor={getTagColor}
            searchInputRef={searchInputRef}
          />
          {showDetailPanel ? (
            <DetailPanel
              project={selectedProject}
              tags={appState.tags}
              onClose={() => setShowDetailPanel(false)}
              onAddTagToProject={addTagToProject}
              onRemoveTagFromProject={removeTagFromProject}
              getTagColor={getTagColor}
            />
          ) : null}
        </div>
      )}

      <TagEditDialog
        title={tagDialogState?.mode === "edit" ? "编辑标签" : "新建标签"}
        isOpen={Boolean(tagDialogState)}
        existingTags={appState.tags}
        initialName={tagDialogState?.tag?.name ?? ""}
        initialColor={tagDialogState?.tag ? getTagHex(tagDialogState.tag.color) : undefined}
        onClose={() => setTagDialogState(null)}
        onSubmit={(name, color) => void handleTagSubmit(name, color)}
      />

      {showDashboard ? (
        <DashboardModal
          projects={projects}
          tags={appState.tags}
          heatmapStore={heatmapStore}
          onClose={() => setShowDashboard(false)}
          onUpdateGitDaily={updateGitDaily}
        />
      ) : null}
      {showSettings ? (
        <SettingsModal
          settings={appState.settings}
          projects={projects}
          onClose={() => setShowSettings(false)}
          onSaveSettings={handleSaveSettings}
        />
      ) : null}
      {toast ? (
        <div className={`toast${toast.variant === "error" ? " is-error" : ""}`}>{toast.message}</div>
      ) : null}
    </div>
  );
}

/** 应用根组件，负责注入全局状态提供者。 */
function App() {
  return (
    <DevHavenProvider>
      <AppLayout />
    </DevHavenProvider>
  );
}

export default App;
