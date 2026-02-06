import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { confirm } from "@tauri-apps/plugin-dialog";

import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import DetailPanel from "./components/DetailPanel";
import TagEditDialog from "./components/TagEditDialog";
import DashboardModal from "./components/DashboardModal";
import SettingsModal from "./components/SettingsModal";
import RecycleBinModal from "./components/RecycleBinModal";
import MonitorWindow from "./components/MonitorWindow";
import WorktreeCreateDialog, {
  type WorktreeCreateSubmitPayload,
} from "./components/terminal/WorktreeCreateDialog";
import { useCodexSessions } from "./hooks/useCodexSessions";
import type { DateFilter, GitFilter } from "./models/filters";
import { DATE_FILTER_OPTIONS } from "./models/filters";
import type { HeatmapData } from "./models/heatmap";
import { HEATMAP_CONFIG } from "./models/heatmap";
import type { CodexSessionSummary, CodexSessionView } from "./models/codex";
import type { ColorData, Project, ProjectWorktree, TagData } from "./models/types";
import { jsDateToSwiftDate, swiftDateToJsDate } from "./models/types";
import { colorDataToHex } from "./utils/colors";
import { formatDateKey } from "./utils/gitDaily";
import { buildGitIdentitySignature } from "./utils/gitIdentity";
import { pickColorForTag } from "./utils/tagColors";
import { buildCodexProjectStatusById } from "./utils/codexProjectStatus";
import { DevHavenProvider, useDevHavenContext } from "./state/DevHavenContext";
import { useHeatmapData } from "./state/useHeatmapData";
import { copyToClipboard, sendSystemNotification } from "./services/system";
import { closeMonitorWindow, openMonitorWindow } from "./services/monitorWindow";
import { deleteTerminalWorkspace } from "./services/terminalWorkspace";
import { gitWorktreeAdd, gitWorktreeList, gitWorktreeRemove } from "./services/gitWorktree";
import type { GitWorktreeListItem } from "./services/gitWorktree";
import { gitIsRepo } from "./services/gitManagement";
import {
  createQuickCommandRequestId,
  enqueueTerminalQuickCommandAction,
  emitTerminalQuickCommandRun,
  emitTerminalQuickCommandStop,
} from "./services/terminalQuickCommands";

const MONITOR_OPEN_SESSION_EVENT = "monitor-open-session";
const MAIN_WINDOW_LABEL = "main";
const TerminalWorkspaceWindow = lazy(() => import("./components/terminal/TerminalWorkspaceWindow"));

type MonitorOpenSessionPayload = {
  sessionId: string;
  projectId: string | null;
  projectPath: string | null;
  projectName: string | null;
  cwd: string;
};

function createWorktreeProjectId(path: string): string {
  return `worktree:${path}`;
}

function isWorktreeProject(project: Project): boolean {
  return project.id.startsWith("worktree:");
}

function resolveNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const last = normalized.split("/").filter(Boolean).pop();
  return last || normalized || path;
}

function normalizePathForCompare(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+$/, "");
}

function buildWorktreeVirtualProject(sourceProject: Project, worktree: ProjectWorktree): Project {
  const now = jsDateToSwiftDate(new Date());
  return {
    id: createWorktreeProjectId(worktree.path),
    name: worktree.name || resolveNameFromPath(worktree.path),
    path: worktree.path,
    tags: [...(sourceProject.tags ?? [])],
    scripts: [...(sourceProject.scripts ?? [])],
    worktrees: [],
    mtime: sourceProject.mtime,
    size: sourceProject.size,
    checksum: `worktree:${worktree.path}`,
    git_commits: sourceProject.git_commits,
    git_last_commit: sourceProject.git_last_commit,
    git_daily: sourceProject.git_daily ?? null,
    created: worktree.created || now,
    checked: now,
  };
}

function matchProjectByCwd(cwd: string, projects: Project[]): Project | null {
  if (!cwd) {
    return null;
  }
  let bestMatch: Project | null = null;
  let bestLength = -1;
  for (const project of projects) {
    if (cwd.startsWith(project.path) && project.path.length > bestLength) {
      bestMatch = project;
      bestLength = project.path.length;
    }
  }
  return bestMatch;
}

function resolveAppView(): "main" | "monitor" {
  if (typeof window === "undefined") {
    return "main";
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "monitor") {
    return "monitor";
  }
  return "main";
}

function buildCodexSessionViews(sessions: CodexSessionSummary[], projects: Project[]): CodexSessionView[] {
  return sessions.map((session) => {
    const project = matchProjectByCwd(session.cwd, projects);
    return {
      ...session,
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
      projectPath: project?.path ?? null,
    };
  });
}

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
    addProjectScript,
    updateProjectScript,
    removeProjectScript,
    addProjectWorktree,
    removeProjectWorktree,
    syncProjectWorktrees,
    refreshProject,
    updateGitDaily,
    updateSettings,
    moveProjectToRecycleBin,
    restoreProjectFromRecycleBin,
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
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [showTerminalWorkspace, setShowTerminalWorkspace] = useState(false);
  const [terminalOpenProjects, setTerminalOpenProjects] = useState<Project[]>([]);
  const [terminalActiveProjectId, setTerminalActiveProjectId] = useState<string | null>(null);
  const [terminalGitWorktreesByProjectId, setTerminalGitWorktreesByProjectId] = useState<
    Record<string, GitWorktreeListItem[]>
  >({});
  const [worktreeDialogProjectId, setWorktreeDialogProjectId] = useState<string | null>(null);
  const appView = useMemo(() => resolveAppView(), []);
  const isMonitorView = appView === "monitor";

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.body.classList.toggle("is-monitor-view", isMonitorView);
    document.documentElement.classList.toggle("is-monitor-view", isMonitorView);
    return () => {
      document.body.classList.remove("is-monitor-view");
      document.documentElement.classList.remove("is-monitor-view");
    };
  }, [isMonitorView]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastTerminalVisibleRef = useRef(showTerminalWorkspace);
  const terminalOpenProjectsRef = useRef<Project[]>(terminalOpenProjects);
  const terminalActiveProjectIdRef = useRef<string | null>(terminalActiveProjectId);
  const terminalGitWorktreesByProjectIdRef = useRef<Record<string, GitWorktreeListItem[]>>(terminalGitWorktreesByProjectId);
  const worktreeAutoSyncedProjectIdsRef = useRef<Set<string>>(new Set());
  const worktreeSyncingProjectIdsRef = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<number | null>(null);
  const gitDailyRefreshRef = useRef<string | null>(null);
  const gitDailyUpdatingRef = useRef(false);
  const gitIdentitySignatureRef = useRef<string | null>(null);
  const codexProjectSnapshotRef = useRef<Set<string>>(new Set());
  const codexSessionSnapshotReadyRef = useRef(false);
  const recycleBinPaths = appState.recycleBin ?? [];
  const recycleBinSet = useMemo(() => new Set(recycleBinPaths), [recycleBinPaths]);
  const recycleBinCount = recycleBinPaths.length;
  const visibleProjects = useMemo(
    () => projects.filter((project) => !recycleBinSet.has(project.path)),
    [projects, recycleBinSet],
  );
  const recycleBinItems = useMemo(() => {
    const projectsByPath = new Map(projects.map((project) => [project.path, project]));
    return recycleBinPaths.map((path) => {
      const project = projectsByPath.get(path);
      return {
        path,
        name: project?.name ?? path.split("/").pop() ?? path,
        missing: !project,
      };
    });
  }, [projects, recycleBinPaths]);
  const heatmapStore = useHeatmapData(visibleProjects, appState.settings.gitIdentities);
  const sidebarHeatmapData = useMemo(
    () => heatmapStore.getHeatmapData(HEATMAP_CONFIG.sidebar.days),
    [heatmapStore],
  );
  const codexSessionStore = useCodexSessions();
  const codexSessionViews = useMemo(
    () => buildCodexSessionViews(codexSessionStore.sessions, projects),
    [codexSessionStore.sessions, projects],
  );
  const codexProjectStatusById = useMemo(
    () => buildCodexProjectStatusById(codexSessionViews),
    [codexSessionViews],
  );
  const runningCodexSessionViews = useMemo(
    () => codexSessionViews.filter((session) => session.isRunning),
    [codexSessionViews],
  );
  const worktreeDialogSourceProject = useMemo(() => {
    if (!worktreeDialogProjectId) {
      return null;
    }
    return projectMap.get(worktreeDialogProjectId) ?? null;
  }, [projectMap, worktreeDialogProjectId]);

  const hiddenTags = useMemo(
    () => new Set(appState.tags.filter((tag) => tag.hidden).map((tag) => tag.name)),
    [appState.tags],
  );

  useEffect(() => {
    if (!worktreeDialogProjectId) {
      return;
    }
    if (!projectMap.has(worktreeDialogProjectId)) {
      setWorktreeDialogProjectId(null);
    }
  }, [projectMap, worktreeDialogProjectId]);

  const filteredProjects = useMemo(() => {
    let result = [...visibleProjects];

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
  }, [
    visibleProjects,
    selectedDirectory,
    selectedTags,
    heatmapFilteredProjectIds,
    searchText,
    dateFilter,
    gitFilter,
    hiddenTags,
  ]);

  const selectedProject = selectedProjectId ? projectMap.get(selectedProjectId) ?? null : null;
  const resolvedSelectedProject =
    selectedProject && recycleBinSet.has(selectedProject.path) ? null : selectedProject;

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

  const handleMoveProjectToRecycleBin = useCallback(
    async (project: Project) => {
      try {
        await moveProjectToRecycleBin(project.path);
        showToast("已移入回收站");
        setSelectedProjects((prev) => {
          if (!prev.has(project.id)) {
            return prev;
          }
          const next = new Set(prev);
          next.delete(project.id);
          return next;
        });
        setSelectedProjectId((prev) => (prev === project.id ? null : prev));
        setHeatmapFilteredProjectIds((prev) => {
          if (!prev.has(project.id)) {
            return prev;
          }
          const next = new Set(prev);
          next.delete(project.id);
          return next;
        });
      } catch (error) {
        console.error("移入回收站失败。", error);
        showToast("移入回收站失败，请稍后重试", "error");
      }
    },
    [moveProjectToRecycleBin, showToast],
  );

  const handleRestoreProjectFromRecycleBin = useCallback(
    async (path: string) => {
      try {
        await restoreProjectFromRecycleBin(path);
        showToast("已从回收站恢复");
      } catch (error) {
        console.error("恢复项目失败。", error);
        showToast("回收站恢复失败，请稍后重试", "error");
      }
    },
    [restoreProjectFromRecycleBin, showToast],
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    const missingDaily = visibleProjects.filter((project) => project.git_commits > 0 && !project.git_daily);
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
  }, [isLoading, updateGitDaily, visibleProjects]);

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
    const gitPaths = visibleProjects.filter((project) => project.git_commits > 0).map((project) => project.path);
    if (gitPaths.length === 0) {
      return;
    }
    void updateGitDaily(gitPaths);
  }, [gitIdentitySignature, isLoading, updateGitDaily, visibleProjects]);

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

  const openTerminalWorkspace = useCallback((project: Project) => {
    setShowTerminalWorkspace(true);
    setTerminalOpenProjects((prev) => {
      const index = prev.findIndex((item) => item.id === project.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = project;
        return next;
      }
      return [...prev, project];
    });
    setTerminalActiveProjectId(project.id);
  }, []);

  const handleRunProjectScript = useCallback(
    async (projectId: string, scriptId: string) => {
      const project = projectMap.get(projectId);
      if (!project) {
        showToast("项目不存在或已移除", "error");
        return;
      }
      const script = (project.scripts ?? []).find((item) => item.id === scriptId);
      if (!script) {
        showToast("命令不存在或已被删除", "error");
        return;
      }

      const payload = {
        requestId: createQuickCommandRequestId(),
        projectId: project.id,
        projectPath: project.path,
        scriptId,
      };

      const alreadyOpen = terminalOpenProjectsRef.current.some((item) => item.id === project.id);
      if (!alreadyOpen) {
        enqueueTerminalQuickCommandAction({ type: "run", payload });
      }

      openTerminalWorkspace(project);
      window.setTimeout(() => {
        void emitTerminalQuickCommandRun(MAIN_WINDOW_LABEL, payload).catch((error) => {
          console.error("发送快捷命令运行事件失败。", error);
        });
      }, 0);
    },
    [projectMap, openTerminalWorkspace, showToast],
  );

  const handleStopProjectScript = useCallback(
    async (projectId: string, scriptId: string) => {
      const project = projectMap.get(projectId);
      if (!project) {
        showToast("项目不存在或已移除", "error");
        return;
      }
      const script = (project.scripts ?? []).find((item) => item.id === scriptId);
      if (!script) {
        showToast("命令不存在或已被删除", "error");
        return;
      }

      const payload = {
        requestId: createQuickCommandRequestId(),
        projectId: project.id,
        projectPath: project.path,
        scriptId,
      };

      const alreadyOpen = terminalOpenProjectsRef.current.some((item) => item.id === project.id);
      if (!alreadyOpen) {
        enqueueTerminalQuickCommandAction({ type: "stop", payload });
      }

      openTerminalWorkspace(project);
      window.setTimeout(() => {
        void emitTerminalQuickCommandStop(MAIN_WINDOW_LABEL, payload).catch((error) => {
          console.error("发送快捷命令停止事件失败。", error);
        });
      }, 0);
    },
    [projectMap, openTerminalWorkspace, showToast],
  );

  const handleOpenTerminal = useCallback(
    (project: Project) => {
      openTerminalWorkspace(project);
    },
    [openTerminalWorkspace],
  );

  const handleRequestCreateWorktree = useCallback(
    async (projectId: string) => {
      const sourceProject = projectMap.get(projectId);
      if (!sourceProject) {
        showToast("项目不存在或已移除", "error");
        return;
      }
      try {
        const isRepo = await gitIsRepo(sourceProject.path);
        if (!isRepo) {
          showToast("该项目不是 Git 仓库，无法创建 worktree", "error");
          return;
        }
        setWorktreeDialogProjectId(projectId);
      } catch (error) {
        console.error("校验 Git 仓库失败。", error);
        showToast("无法校验项目 Git 状态，请重试", "error");
      }
    },
    [projectMap, showToast],
  );

  const handleOpenWorktreeFromProject = useCallback(
    async (projectId: string, worktreePath: string) => {
      const sourceProject = projectMap.get(projectId);
      if (!sourceProject) {
        showToast("项目不存在或已移除", "error");
        return;
      }
      const normalizedPath = worktreePath.trim();
      const worktree = (sourceProject.worktrees ?? []).find((item) => item.path === normalizedPath);
      if (!worktree) {
        // worktree 列表以 Git 为准：当记录未同步时，尝试从缓存/仓库读取并补录。
        const cached = terminalGitWorktreesByProjectIdRef.current[projectId];
        const cachedMatch = cached?.find(
          (item) => normalizePathForCompare(item.path) === normalizePathForCompare(normalizedPath),
        );
        try {
          const gitItems = cached ?? (await gitWorktreeList(sourceProject.path));
          setTerminalGitWorktreesByProjectId((prev) => ({ ...prev, [projectId]: gitItems }));
          await syncProjectWorktrees(projectId, gitItems);

          const match =
            cachedMatch ??
            gitItems.find((item) => normalizePathForCompare(item.path) === normalizePathForCompare(normalizedPath));
          if (!match) {
            showToast("worktree 不存在或已移除", "error");
            return;
          }

          openTerminalWorkspace(
            buildWorktreeVirtualProject(sourceProject, {
              id: createWorktreeProjectId(match.path),
              name: resolveNameFromPath(match.path),
              path: match.path,
              branch: match.branch,
              inheritConfig: true,
              created: jsDateToSwiftDate(new Date()),
            }),
          );
          return;
        } catch (error) {
          console.error("打开 worktree 失败。", error);
          const message = error instanceof Error ? error.message : String(error);
          showToast(message || "打开 worktree 失败", "error");
          return;
        }
      }
      openTerminalWorkspace(buildWorktreeVirtualProject(sourceProject, worktree));
    },
    [openTerminalWorkspace, projectMap, showToast, syncProjectWorktrees],
  );

  const handleCreateWorktree = useCallback(
    async (payload: WorktreeCreateSubmitPayload) => {
      const sourceProject = projectMap.get(payload.sourceProjectId);
      if (!sourceProject) {
        throw new Error("项目不存在或已移除");
      }

      try {
        const result =
          payload.mode === "create"
            ? await gitWorktreeAdd({
                path: payload.sourceProjectPath,
                branch: payload.branch,
                createBranch: payload.createBranch,
              })
            : {
                path: payload.worktreePath,
                branch: payload.branch,
              };

        const nextWorktree: ProjectWorktree = {
          id: createWorktreeProjectId(result.path),
          name: resolveNameFromPath(result.path),
          path: result.path,
          branch: result.branch,
          inheritConfig: true,
          created: jsDateToSwiftDate(new Date()),
        };

        await addProjectWorktree(sourceProject.id, nextWorktree);
        // 若当前已加载 Git worktree 列表，则同步更新缓存，避免列表显示旧数据。
        setTerminalGitWorktreesByProjectId((prev) => {
          if (!(sourceProject.id in prev)) {
            return prev;
          }
          const current = prev[sourceProject.id] ?? [];
          const normalizedTarget = normalizePathForCompare(result.path);
          if (current.some((item) => normalizePathForCompare(item.path) === normalizedTarget)) {
            return prev;
          }
          const next = [...current, { path: result.path, branch: result.branch }].sort((left, right) =>
            left.path.localeCompare(right.path),
          );
          return { ...prev, [sourceProject.id]: next };
        });
        setWorktreeDialogProjectId(null);
        showToast(payload.mode === "create" ? "worktree 创建成功" : "已有 worktree 已添加");

        if (payload.autoOpen) {
          openTerminalWorkspace(buildWorktreeVirtualProject(sourceProject, nextWorktree));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast(message || "创建 worktree 失败", "error");
        throw error;
      }
    },
    [addProjectWorktree, openTerminalWorkspace, projectMap, showToast],
  );

  useEffect(() => {
    setTerminalOpenProjects((prev) =>
      prev.map((project) => {
        if (isWorktreeProject(project)) {
          return project;
        }
        return projectMap.get(project.id) ?? project;
      }),
    );
  }, [projectMap]);

  const handleCloseTerminalProject = useCallback(
    (projectId: string) => {
      const currentProjects = terminalOpenProjectsRef.current;
      const closingProject = currentProjects.find((item) => item.id === projectId);
      if (!closingProject) {
        return;
      }

      const closingPaths = new Set<string>([closingProject.path]);
      if (!isWorktreeProject(closingProject)) {
        for (const item of closingProject.worktrees ?? []) {
          closingPaths.add(item.path);
        }
      }

      const nextProjects = currentProjects.filter((item) => !closingPaths.has(item.path));
      setTerminalOpenProjects(nextProjects);

      if (nextProjects.length === 0) {
        setTerminalActiveProjectId(null);
        setShowTerminalWorkspace(false);
      } else {
        const currentActive = terminalActiveProjectIdRef.current;
        const nextActive =
          currentActive === projectId || !currentActive || !nextProjects.some((item) => item.id === currentActive)
            ? nextProjects[0].id
            : currentActive;
        setTerminalActiveProjectId(nextActive);
      }

      // 先卸载终端 pane（清理 PTY/定时保存），再异步删除持久化工作区，避免竞态把 workspace 又写回去。
      window.setTimeout(() => {
        void Promise.all(Array.from(closingPaths).map((path) => deleteTerminalWorkspace(path))).catch((error) => {
          console.error("删除终端工作区失败。", error);
          showToast("关闭项目失败，请重试", "error");
        });
      }, 0);
    },
    [showToast],
  );

  const syncTerminalProjectWorktrees = useCallback(
    async (projectId: string, options?: { showToast?: boolean }) => {
      const sourceProject = projectMap.get(projectId);
      if (!sourceProject) {
        if (options?.showToast) {
          showToast("项目不存在或已移除", "error");
        }
        return;
      }

      if (worktreeSyncingProjectIdsRef.current.has(projectId)) {
        return;
      }
      worktreeSyncingProjectIdsRef.current.add(projectId);

      try {
        let gitItems: GitWorktreeListItem[] | null = null;
        try {
          gitItems = await gitWorktreeList(sourceProject.path);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // 非 Git 项目：同步为空列表，避免保留过期记录。
          if (message.includes("不是 Git 仓库")) {
            gitItems = [];
          } else {
            if (options?.showToast) {
              showToast(message || "同步 worktree 失败", "error");
            }
            console.error("同步 worktree 失败。", error);
            return;
          }
        }

        setTerminalGitWorktreesByProjectId((prev) => ({ ...prev, [projectId]: gitItems ?? [] }));

        const trackedWorktrees = sourceProject.worktrees ?? [];
        const trackedByPath = new Map(trackedWorktrees.map((item) => [normalizePathForCompare(item.path), item]));

        const gitPathSet = new Set((gitItems ?? []).map((item) => normalizePathForCompare(item.path)));
        const trackedPathSet = new Set(trackedWorktrees.map((item) => normalizePathForCompare(item.path)));

        const removedPaths = trackedWorktrees
          .map((item) => normalizePathForCompare(item.path))
          .filter((path) => path && !gitPathSet.has(path));

        // 若 worktree 已在 Git 中移除，但仍在终端里打开，先关闭避免“幽灵项目”无法再从列表操作。
        for (const removedPath of removedPaths) {
          const opened = terminalOpenProjectsRef.current.find(
            (item) => isWorktreeProject(item) && normalizePathForCompare(item.path) === removedPath,
          );
          if (opened) {
            handleCloseTerminalProject(opened.id);
          }
        }

        const addedCount = Array.from(gitPathSet).filter((path) => !trackedPathSet.has(path)).length;
        const removedCount = removedPaths.length;
        const updatedCount = (gitItems ?? []).reduce((count, item) => {
          const tracked = trackedByPath.get(normalizePathForCompare(item.path));
          return tracked && tracked.branch !== item.branch ? count + 1 : count;
        }, 0);

        await syncProjectWorktrees(projectId, gitItems ?? []);

        if (options?.showToast) {
          if (addedCount === 0 && removedCount === 0 && updatedCount === 0) {
            showToast("worktree 已是最新", "success");
          } else {
            showToast(`已同步 worktree：新增 ${addedCount} · 移除 ${removedCount} · 更新 ${updatedCount}`, "success");
          }
        }
      } finally {
        worktreeSyncingProjectIdsRef.current.delete(projectId);
      }
    },
    [handleCloseTerminalProject, projectMap, showToast, syncProjectWorktrees],
  );

  useEffect(() => {
    if (!showTerminalWorkspace) {
      return;
    }

    const rootProjects = terminalOpenProjects.filter((project) => !isWorktreeProject(project));
    const rootIds = new Set(rootProjects.map((project) => project.id));

    // 清理已关闭项目的缓存。
    setTerminalGitWorktreesByProjectId((prev) => {
      const entries = Object.entries(prev);
      if (entries.length === 0) {
        return prev;
      }
      let changed = false;
      const next: Record<string, GitWorktreeListItem[]> = {};
      for (const [key, value] of entries) {
        if (rootIds.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    for (const project of rootProjects) {
      if (worktreeAutoSyncedProjectIdsRef.current.has(project.id)) {
        continue;
      }
      worktreeAutoSyncedProjectIdsRef.current.add(project.id);
      void syncTerminalProjectWorktrees(project.id).catch(() => {
        worktreeAutoSyncedProjectIdsRef.current.delete(project.id);
      });
    }
  }, [showTerminalWorkspace, syncTerminalProjectWorktrees, terminalOpenProjects]);

  const handleDeleteWorktreeFromProject = useCallback(
    async (projectId: string, worktreePath: string) => {
      const sourceProject = projectMap.get(projectId);
      if (!sourceProject) {
        showToast("项目不存在或已移除", "error");
        return;
      }

      const normalizedPath = worktreePath.trim();
      const trackedWorktree = (sourceProject.worktrees ?? []).find((item) => item.path === normalizedPath);
      const cached = terminalGitWorktreesByProjectIdRef.current[projectId];
      const cachedMatch = cached?.find(
        (item) => normalizePathForCompare(item.path) === normalizePathForCompare(normalizedPath),
      );
      const worktree = trackedWorktree ?? (cachedMatch ? {
        id: createWorktreeProjectId(cachedMatch.path),
        name: resolveNameFromPath(cachedMatch.path),
        path: cachedMatch.path,
        branch: cachedMatch.branch,
        inheritConfig: true,
        created: jsDateToSwiftDate(new Date()),
      } : null);
      if (!worktree) {
        showToast("worktree 不存在或已移除", "error");
        return;
      }

      const confirmed = await confirm(
        `确定要删除该 worktree 吗？\n\n分支：${worktree.branch}\n路径：${worktree.path}\n\n将执行 git worktree remove 并删除该目录。`,
        {
          title: "删除 worktree",
          kind: "warning",
          okLabel: "删除",
          cancelLabel: "取消",
        },
      );
      if (!confirmed) {
        return;
      }

      const openedWorktree = terminalOpenProjectsRef.current.find((item) => item.path === worktree.path);
      if (openedWorktree) {
        handleCloseTerminalProject(openedWorktree.id);
        // 给 unmount / PTY 清理一个 tick，避免 Windows 等平台目录占用导致删除失败。
        await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
      }

      try {
        await gitWorktreeRemove({
          path: sourceProject.path,
          worktreePath: worktree.path,
          force: false,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const forceConfirmed = await confirm(
          `删除失败：${message || "未知错误"}\n\n是否尝试“强制删除”？（可能丢失未提交修改）`,
          {
            title: "删除 worktree",
            kind: "warning",
            okLabel: "强制删除",
            cancelLabel: "取消",
          },
        );
        if (!forceConfirmed) {
          const removeOnly = await confirm(
            "是否仅从 DevHaven 列表中移除该 worktree 记录？（不会执行 Git 删除）",
            {
              title: "移除 worktree 记录",
              kind: "warning",
              okLabel: "移除记录",
              cancelLabel: "取消",
            },
          );
          if (removeOnly) {
            await removeProjectWorktree(sourceProject.id, worktree.path);
            await deleteTerminalWorkspace(worktree.path).catch(() => undefined);
            showToast("worktree 记录已移除", "success");
          }
          return;
        }
        try {
          await gitWorktreeRemove({
            path: sourceProject.path,
            worktreePath: worktree.path,
            force: true,
          });
        } catch (forceError) {
          const forceMessage = forceError instanceof Error ? forceError.message : String(forceError);
          showToast(forceMessage || "强制删除 worktree 失败", "error");
          const removeOnly = await confirm(
            "是否仅从 DevHaven 列表中移除该 worktree 记录？（不会执行 Git 删除）",
            {
              title: "移除 worktree 记录",
              kind: "warning",
              okLabel: "移除记录",
              cancelLabel: "取消",
            },
          );
          if (removeOnly) {
            await removeProjectWorktree(sourceProject.id, worktree.path);
            await deleteTerminalWorkspace(worktree.path).catch(() => undefined);
            showToast("worktree 记录已移除", "success");
          }
          return;
        }
      }

      await removeProjectWorktree(sourceProject.id, worktree.path);
      await deleteTerminalWorkspace(worktree.path).catch(() => undefined);
      showToast("worktree 已删除", "success");
      void syncTerminalProjectWorktrees(projectId).catch(() => undefined);
    },
    [handleCloseTerminalProject, projectMap, removeProjectWorktree, showToast, syncTerminalProjectWorktrees],
  );

  const handleOpenCodexSession = useCallback(
    (session: CodexSessionView) => {
      if (!session.projectId) {
        showToast("未能匹配到项目", "error");
        return;
      }
      const project = projectMap.get(session.projectId);
      if (!project) {
        showToast("项目不存在或已移除", "error");
        return;
      }
      openTerminalWorkspace(project);
    },
    [openTerminalWorkspace, projectMap, showToast],
  );

  const resolveProjectFromPayload = useCallback(
    (payload: MonitorOpenSessionPayload) =>
      (payload.projectId ? projectMap.get(payload.projectId) ?? null : null) ??
      (payload.projectPath ? projects.find((item) => item.path === payload.projectPath) ?? null : null) ??
      (payload.projectName ? projects.find((item) => item.name === payload.projectName) ?? null : null) ??
      (payload.cwd ? matchProjectByCwd(payload.cwd, projects) : null),
    [projectMap, projects],
  );

  const handleMonitorOpenCodexSession = useCallback(async (session: CodexSessionView) => {
    try {
      const mainWindow = await WebviewWindow.getByLabel(MAIN_WINDOW_LABEL);
      if (mainWindow) {
        await mainWindow.show().catch(() => undefined);
        await mainWindow.setFocus().catch(() => undefined);
      }
      await emitTo<MonitorOpenSessionPayload>(MAIN_WINDOW_LABEL, MONITOR_OPEN_SESSION_EVENT, {
        sessionId: session.id,
        projectId: session.projectId,
        projectPath: session.projectPath,
        projectName: session.projectName,
        cwd: session.cwd,
      });
    } catch (error) {
      console.error("从悬浮窗跳转项目失败。", error);
    }
  }, []);

  useEffect(() => {
    if (isMonitorView) {
      return;
    }
    let unlisten: (() => void) | null = null;
    const registerListener = async () => {
      try {
        unlisten = await listen<MonitorOpenSessionPayload>(MONITOR_OPEN_SESSION_EVENT, (event) => {
          const payload = event.payload;
          const project = resolveProjectFromPayload(payload);
          if (!project) {
            if (isLoading) {
              showToast("项目加载中，请稍后重试");
              return;
            }
            showToast("项目不存在或已移除", "error");
            return;
          }
          openTerminalWorkspace(project);
        });
      } catch (error) {
        console.error("监听悬浮窗跳转事件失败。", error);
      }
    };
    void registerListener();
    return () => {
      unlisten?.();
    };
  }, [isLoading, isMonitorView, openTerminalWorkspace, resolveProjectFromPayload, showToast]);

  useEffect(() => {
    if (isMonitorView || codexSessionStore.isLoading) {
      return;
    }
    const previousProjectIds = codexProjectSnapshotRef.current;
    const nextProjectIds = new Set(Object.keys(codexProjectStatusById));
    if (codexSessionSnapshotReadyRef.current) {
      for (const projectId of previousProjectIds) {
        if (nextProjectIds.has(projectId)) {
          continue;
        }
        const project = projectMap.get(projectId) ?? null;
        if (!project) {
          showToast("Codex 已完成，但未匹配到项目", "error");
          continue;
        }
        showToast(`Codex 已完成：${project.name}`);
        void sendSystemNotification("Codex 已完成", project.name);
      }
    }
    codexProjectSnapshotRef.current = nextProjectIds;
    codexSessionSnapshotReadyRef.current = true;
  }, [
    codexSessionStore.isLoading,
    codexProjectStatusById,
    isMonitorView,
    projectMap,
    showToast,
  ]);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
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

  useEffect(() => {
    if (isMonitorView) {
      return;
    }
    if (appState.settings.showMonitorWindow) {
      void openMonitorWindow();
    } else {
      void closeMonitorWindow();
    }
  }, [appState.settings.showMonitorWindow, isMonitorView]);

  useEffect(() => {
    const wasVisible = lastTerminalVisibleRef.current;
    lastTerminalVisibleRef.current = showTerminalWorkspace;
    if (!wasVisible || showTerminalWorkspace) {
      return;
    }
    // 终端隐藏后，把焦点移回主界面搜索框，避免继续把输入写入后台 xterm。
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, [showTerminalWorkspace]);

  useEffect(() => {
    if (showTerminalWorkspace) {
      return;
    }
    // 终端隐藏后清空 Git worktree 缓存与同步标记，避免下次打开显示旧数据。
    worktreeAutoSyncedProjectIdsRef.current = new Set();
    worktreeSyncingProjectIdsRef.current = new Set();
    setTerminalGitWorktreesByProjectId({});
  }, [showTerminalWorkspace]);

  useEffect(() => {
    terminalOpenProjectsRef.current = terminalOpenProjects;
  }, [terminalOpenProjects]);

  useEffect(() => {
    terminalActiveProjectIdRef.current = terminalActiveProjectId;
  }, [terminalActiveProjectId]);

  useEffect(() => {
    terminalGitWorktreesByProjectIdRef.current = terminalGitWorktreesByProjectId;
  }, [terminalGitWorktreesByProjectId]);

  if (isMonitorView) {
    return (
      <div className="h-full bg-transparent">
        <MonitorWindow
          sessions={runningCodexSessionViews}
          isLoading={codexSessionStore.isLoading}
          error={codexSessionStore.error}
          onOpenSession={handleMonitorOpenCodexSession}
        />
      </div>
    );
  }

  return (
    <div className="relative h-full bg-background">
      <div
        className={`grid h-full ${
          showDetailPanel
            ? "grid-cols-[220px_minmax(0,1fr)_380px]"
            : "grid-cols-[220px_minmax(0,1fr)]"
        }`}
      >
        <Sidebar
          appState={appState}
          projects={visibleProjects}
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
          onOpenRecycleBin={() => setShowRecycleBin(true)}
          onRefresh={refresh}
          onAddProjects={addProjects}
          isHeatmapLoading={heatmapStore.isLoading}
          codexSessions={codexSessionViews}
          codexSessionsLoading={codexSessionStore.isLoading}
          codexSessionsError={codexSessionStore.error}
          onOpenCodexSession={handleOpenCodexSession}
        />
        <MainContent
          projects={visibleProjects}
          filteredProjects={filteredProjects}
          recycleBinCount={recycleBinCount}
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
          onTagSelected={handleSelectTag}
          onRemoveTagFromProject={removeTagFromProject}
          onRefreshProject={refreshProject}
          onCopyPath={handleCopyPath}
          onOpenTerminal={handleOpenTerminal}
          onMoveToRecycleBin={handleMoveProjectToRecycleBin}
          getTagColor={getTagColor}
          searchInputRef={searchInputRef}
        />
        {showDetailPanel ? (
          <DetailPanel
            project={resolvedSelectedProject}
            tags={appState.tags}
            onClose={() => setShowDetailPanel(false)}
            onAddTagToProject={addTagToProject}
            onRemoveTagFromProject={removeTagFromProject}
            onRunProjectScript={handleRunProjectScript}
            onStopProjectScript={handleStopProjectScript}
            onAddProjectScript={addProjectScript}
            onUpdateProjectScript={updateProjectScript}
            onRemoveProjectScript={removeProjectScript}
            getTagColor={getTagColor}
          />
        ) : null}
      </div>

      <TagEditDialog
        title={tagDialogState?.mode === "edit" ? "编辑标签" : "新建标签"}
        isOpen={Boolean(tagDialogState)}
        existingTags={appState.tags}
        initialName={tagDialogState?.tag?.name ?? ""}
        initialColor={tagDialogState?.tag ? getTagHex(tagDialogState.tag.color) : undefined}
        onClose={() => setTagDialogState(null)}
        onSubmit={(name, color) => void handleTagSubmit(name, color)}
      />

      {showRecycleBin ? (
        <RecycleBinModal
          items={recycleBinItems}
          onClose={() => setShowRecycleBin(false)}
          onRestore={handleRestoreProjectFromRecycleBin}
        />
      ) : null}

      {showDashboard ? (
        <DashboardModal
          projects={visibleProjects}
          tags={appState.tags}
          heatmapStore={heatmapStore}
          onClose={() => setShowDashboard(false)}
          onUpdateGitDaily={updateGitDaily}
        />
      ) : null}
      {showSettings ? (
        <SettingsModal
          settings={appState.settings}
          onClose={handleCloseSettings}
          onSaveSettings={handleSaveSettings}
        />
      ) : null}

      <WorktreeCreateDialog
        isOpen={Boolean(worktreeDialogProjectId)}
        sourceProject={worktreeDialogSourceProject}
        onClose={() => setWorktreeDialogProjectId(null)}
        onSubmit={handleCreateWorktree}
      />

      {toast ? (
        <div
          className={`fixed left-1/2 bottom-7 -translate-x-1/2 rounded-full px-4 py-2 text-fs-caption border text-text z-[95] backdrop-blur-[6px] ${
            toast.variant === "error"
              ? "bg-[rgba(239,68,68,0.15)] border-[rgba(239,68,68,0.4)]"
              : "bg-[rgba(16,185,129,0.15)] border-[rgba(16,185,129,0.4)]"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      {terminalOpenProjects.length > 0 ? (
        <div
          className={`absolute inset-0 z-[80] transition-opacity duration-150 ${
            showTerminalWorkspace ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <Suspense fallback={<div className="h-full w-full bg-[var(--bg)]" />}>
            <TerminalWorkspaceWindow
              openProjects={terminalOpenProjects}
              activeProjectId={terminalActiveProjectId}
              onSelectProject={setTerminalActiveProjectId}
              onCloseProject={handleCloseTerminalProject}
              onCreateWorktree={(projectId) => void handleRequestCreateWorktree(projectId)}
              onOpenWorktree={(projectId, worktreePath) => void handleOpenWorktreeFromProject(projectId, worktreePath)}
              onDeleteWorktree={(projectId, worktreePath) => void handleDeleteWorktreeFromProject(projectId, worktreePath)}
              onRefreshWorktrees={(projectId) => void syncTerminalProjectWorktrees(projectId, { showToast: true })}
              onExit={() => setShowTerminalWorkspace(false)}
              windowLabel={MAIN_WINDOW_LABEL}
              isVisible={showTerminalWorkspace}
              codexProjectStatusById={codexProjectStatusById}
              gitWorktreesByProjectId={terminalGitWorktreesByProjectId}
            />
          </Suspense>
        </div>
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
