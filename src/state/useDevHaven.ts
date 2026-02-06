import { useCallback, useEffect, useMemo, useState } from "react";

import type { AppStateFile, Project, ProjectScript, ProjectWorktree, TagData } from "../models/types";
import { jsDateToSwiftDate } from "../models/types";
import {
  buildProjects,
  discoverProjects,
  loadAppState,
  loadProjects,
  saveAppState,
  saveProjects,
} from "../services/appStorage";
import { collectGitDaily } from "../services/gitDaily";
import { pickColorForTag } from "../utils/tagColors";

const emptyState: AppStateFile = {
  version: 4,
  tags: [],
  directories: [],
  recycleBin: [],
  settings: {
    editorOpenTool: {
      commandPath: "",
      arguments: [],
    },
    terminalOpenTool: {
      commandPath: "",
      arguments: [],
    },
    terminalUseWebglRenderer: true,
    terminalTheme: "DevHaven Dark",
    showMonitorWindow: false,
    gitIdentities: [],
  },
};

function normalizeAppState(state: AppStateFile): AppStateFile {
  return {
    ...state,
    recycleBin: state.recycleBin ?? [],
  };
}

export type DevHavenState = {
  appState: AppStateFile;
  projects: Project[];
  isLoading: boolean;
  error: string | null;
};

export type DevHavenActions = {
  refresh: () => Promise<void>;
  addProjects: (paths: string[]) => Promise<void>;
  refreshProject: (path: string) => Promise<void>;
  updateGitDaily: (paths?: string[]) => Promise<void>;
  addProjectScript: (
    projectId: string,
    script: { name: string; start: string; stop?: string | null },
  ) => Promise<void>;
  updateProjectScript: (projectId: string, script: ProjectScript) => Promise<void>;
  removeProjectScript: (projectId: string, scriptId: string) => Promise<void>;
  addProjectWorktree: (projectId: string, worktree: ProjectWorktree) => Promise<void>;
  removeProjectWorktree: (projectId: string, worktreePath: string) => Promise<void>;
  syncProjectWorktrees: (projectId: string, worktrees: Array<{ path: string; branch: string }>) => Promise<void>;
  addDirectory: (path: string) => Promise<void>;
  removeDirectory: (path: string) => Promise<void>;
  moveProjectToRecycleBin: (path: string) => Promise<void>;
  restoreProjectFromRecycleBin: (path: string) => Promise<void>;
  updateSettings: (settings: AppStateFile["settings"]) => Promise<void>;
  updateTags: (tags: TagData[]) => Promise<void>;
  addTag: (name: string, colorHex?: string) => Promise<void>;
  renameTag: (from: string, to: string) => Promise<void>;
  removeTag: (name: string) => Promise<void>;
  toggleTagHidden: (name: string) => Promise<void>;
  setTagColor: (name: string, colorHex: string) => Promise<void>;
  addTagToProject: (projectId: string, tag: string) => Promise<void>;
  removeTagFromProject: (projectId: string, tag: string) => Promise<void>;
};

export type DevHavenStore = DevHavenState &
  DevHavenActions & {
    projectMap: Map<string, Project>;
  };

/** 项目管理主 Hook，封装状态、缓存与业务操作。 */
export function useDevHaven(): DevHavenStore {
  const [appState, setAppState] = useState<AppStateFile>(emptyState);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const handleError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : String(err));
  }, []);

  const commitAppState = useCallback(async (nextState: AppStateFile) => {
    setAppState(nextState);
    await saveAppState(nextState);
  }, []);

  const commitProjects = useCallback(async (nextProjects: Project[]) => {
    setProjects(nextProjects);
    await saveProjects(nextProjects);
  }, []);

  const commitAppStateAndProjects = useCallback(async (nextState: AppStateFile, nextProjects: Project[]) => {
    setAppState(nextState);
    setProjects(nextProjects);
    await Promise.all([saveAppState(nextState), saveProjects(nextProjects)]);
  }, []);

  /** 将项目中的标签同步到全局标签配置，并持久化。 */
  const syncTagsFromProjects = useCallback(
    async (state: AppStateFile, nextProjects: Project[]) => {
      const existing = new Map(state.tags.map((tag) => [tag.name, tag]));
      let changed = false;

      for (const project of nextProjects) {
        for (const tag of project.tags) {
          if (!existing.has(tag)) {
            existing.set(tag, {
              name: tag,
              color: hexToColorData(pickColorForTag(tag)),
              hidden: false,
            });
            changed = true;
          }
        }
      }

      if (!changed) {
        return state;
      }

      const nextState = {
        ...state,
        tags: Array.from(existing.values()),
      };

      await commitAppState(nextState);
      return nextState;
    },
    [commitAppState],
  );

  /** 刷新应用状态与项目列表，必要时触发扫描与构建。 */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [state, cachedProjects] = await Promise.all([loadAppState(), loadProjects()]);
      const resolvedState = normalizeAppState(state ?? emptyState);
      const resolvedProjects = (cachedProjects ?? []).map(normalizeProject);
      setAppState(resolvedState);
      if (resolvedState.directories.length === 0) {
        setProjects(resolvedProjects);
        await syncTagsFromProjects(resolvedState, resolvedProjects);
        return;
      }
      const paths = await discoverProjects(resolvedState.directories);
      const updatedProjects = await buildProjects(paths, resolvedProjects);
      const normalizedProjects = updatedProjects.map(normalizeProject);
      setProjects(normalizedProjects);
      await saveProjects(normalizedProjects);
      await syncTagsFromProjects(resolvedState, normalizedProjects);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [handleError, syncTagsFromProjects]);

  /** 将指定路径直接合并进项目列表并更新标签。 */
  const addProjects = useCallback(
    async (paths: string[]) => {
      const uniquePaths = Array.from(new Set(paths.map((path) => path.trim()).filter(Boolean)));
      if (uniquePaths.length === 0) {
        return;
      }
      try {
        const updatedProjects = await buildProjects(uniquePaths, projects);
        const nextProjects = mergeProjectsByPath(projects, updatedProjects);
        await commitProjects(nextProjects);
        await syncTagsFromProjects(appState, nextProjects);
      } catch (err) {
        handleError(err);
      }
    },
    [appState, commitProjects, handleError, projects, syncTagsFromProjects],
  );

  /** 重新扫描指定项目路径并更新缓存。 */
  const refreshProject = useCallback(
    async (path: string) => {
      if (!path) {
        return;
      }
      try {
        const updatedProjects = await buildProjects([path], projects);
        const nextProjects = mergeProjectsByPath(projects, updatedProjects);
        await commitProjects(nextProjects);
        await syncTagsFromProjects(appState, nextProjects);
      } catch (err) {
        handleError(err);
      }
    },
    [appState, commitProjects, handleError, projects, syncTagsFromProjects],
  );

  /** 更新项目的 Git 每日提交统计（支持指定路径）。 */
  const updateGitDaily = useCallback(
    async (paths?: string[]) => {
      const hiddenPaths = new Set(appState.recycleBin);
      let targetPaths: string[] = [];
      if (paths && paths.length > 0) {
        targetPaths = paths.filter((path) => !hiddenPaths.has(path));
      } else {
        targetPaths = projects
          .filter((project) => project.git_commits > 0 && !hiddenPaths.has(project.path))
          .map((project) => project.path);
      }
      if (targetPaths.length === 0) {
        return;
      }
      try {
        const results = await collectGitDaily(targetPaths, appState.settings.gitIdentities);
        if (results.length === 0) {
          return;
        }
        const byPath = new Map(results.map((result) => [result.path, result]));
        const nextProjects = projects.map((project) => {
          const match = byPath.get(project.path);
          if (!match || match.error) {
            return project;
          }
          return { ...project, git_daily: match.gitDaily ?? null };
        });
        await commitProjects(nextProjects);
      } catch (err) {
        handleError(err);
      }
    },
    [appState.recycleBin, appState.settings.gitIdentities, commitProjects, handleError, projects],
  );

  const createScriptId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  /** 为项目新增快捷命令并持久化。 */
  const addProjectScript = useCallback(
    async (projectId: string, script: { name: string; start: string; stop?: string | null }) => {
      const name = script.name.trim();
      const start = script.start.trim();
      const stop = (script.stop ?? "").trim();
      if (!projectId || !name || !start) {
        return;
      }

      const nextScript: ProjectScript = {
        id: createScriptId(),
        name,
        start,
        stop: stop ? stop : null,
      };
      const nextProjects = projects.map((project) =>
        project.id === projectId ? { ...project, scripts: [...(project.scripts ?? []), nextScript] } : project,
      );
      await commitProjects(nextProjects);
    },
    [commitProjects, projects],
  );

  /** 更新项目快捷命令并持久化。 */
  const updateProjectScript = useCallback(
    async (projectId: string, script: ProjectScript) => {
      const name = script.name.trim();
      const start = script.start.trim();
      const stop = (script.stop ?? "").trim();
      if (!projectId || !script.id || !name || !start) {
        return;
      }

      const nextScript: ProjectScript = {
        ...script,
        name,
        start,
        stop: stop ? stop : null,
      };

      const nextProjects = projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }
        const scripts = project.scripts ?? [];
        return {
          ...project,
          scripts: scripts.map((item) => (item.id === script.id ? nextScript : item)),
        };
      });
      await commitProjects(nextProjects);
    },
    [commitProjects, projects],
  );

  /** 删除项目快捷命令并持久化。 */
  const removeProjectScript = useCallback(
    async (projectId: string, scriptId: string) => {
      if (!projectId || !scriptId) {
        return;
      }
      const nextProjects = projects.map((project) =>
        project.id === projectId
          ? { ...project, scripts: (project.scripts ?? []).filter((item) => item.id !== scriptId) }
          : project,
      );
      await commitProjects(nextProjects);
    },
    [commitProjects, projects],
  );

  /** 为项目新增/更新 worktree 子项并持久化（按 path 幂等）。 */
  const addProjectWorktree = useCallback(
    async (projectId: string, worktree: ProjectWorktree) => {
      if (!projectId) {
        return;
      }
      const normalizedPath = worktree.path.trim();
      const normalizedBranch = worktree.branch.trim();
      if (!normalizedPath || !normalizedBranch) {
        return;
      }

      const nextWorktree: ProjectWorktree = {
        id: worktree.id?.trim() || createScriptId(),
        name: worktree.name?.trim() || normalizedPath.split("/").pop() || normalizedPath,
        path: normalizedPath,
        branch: normalizedBranch,
        inheritConfig: worktree.inheritConfig,
        created: Number.isFinite(worktree.created) ? worktree.created : jsDateToSwiftDate(new Date()),
        status: worktree.status,
        initStep: worktree.initStep,
        initMessage: worktree.initMessage,
        initError: worktree.initError,
        initJobId: worktree.initJobId,
        updatedAt: worktree.updatedAt,
      };

      const nextProjects = projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }
        const current = project.worktrees ?? [];
        const existingIndex = current.findIndex((item) => item.path === normalizedPath);
        if (existingIndex >= 0) {
          const worktrees = [...current];
          worktrees[existingIndex] = {
            ...worktrees[existingIndex],
            ...nextWorktree,
          };
          return { ...project, worktrees };
        }
        return { ...project, worktrees: [...current, nextWorktree] };
      });

      await commitProjects(nextProjects);
    },
    [commitProjects, projects],
  );

  /** 删除项目 worktree 子项并持久化。 */
  const removeProjectWorktree = useCallback(
    async (projectId: string, worktreePath: string) => {
      const normalizedPath = worktreePath.trim();
      if (!projectId || !normalizedPath) {
        return;
      }

      const nextProjects = projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }
        return {
          ...project,
          worktrees: (project.worktrees ?? []).filter((item) => item.path !== normalizedPath),
        };
      });

      await commitProjects(nextProjects);
    },
    [commitProjects, projects],
  );

  /** 根据 Git worktree 列表同步指定项目的 worktrees（一次性写盘，按 path 幂等）。 */
  const syncProjectWorktrees = useCallback(
    async (projectId: string, worktrees: Array<{ path: string; branch: string }>) => {
      if (!projectId) {
        return;
      }

      const normalizedGitWorktrees = worktrees
        .map((item) => ({ path: item.path.trim(), branch: item.branch.trim() }))
        .filter((item) => item.path && item.branch)
        .sort((left, right) => left.path.localeCompare(right.path));

      const now = jsDateToSwiftDate(new Date());
      let changed = false;

      const nextProjects = projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const existingWorktrees = project.worktrees ?? [];
        const existingByPath = new Map(existingWorktrees.map((item) => [item.path, item]));

        const nextWorktrees: ProjectWorktree[] = normalizedGitWorktrees.map((item) => {
          const existing = existingByPath.get(item.path);
          const name =
            existing?.name?.trim() ||
            item.path
              .replace(/\\/g, "/")
              .replace(/\/+$/, "")
              .split("/")
              .filter(Boolean)
              .pop() ||
            item.path;
          const inheritConfig = existing?.inheritConfig ?? true;
          const created = Number.isFinite(existing?.created) ? (existing?.created ?? now) : now;
          const id = existing?.id?.trim() || `worktree:${item.path}`;
          return {
            id,
            name,
            path: item.path,
            branch: item.branch,
            inheritConfig,
            created,
            status: existing?.status,
            initStep: existing?.initStep,
            initMessage: existing?.initMessage,
            initError: existing?.initError,
            initJobId: existing?.initJobId,
            updatedAt: existing?.updatedAt,
          };
        });

        if (existingWorktrees.length !== nextWorktrees.length) {
          changed = true;
        } else {
          for (let index = 0; index < nextWorktrees.length; index += 1) {
            const prev = existingWorktrees[index];
            const next = nextWorktrees[index];
            if (
              prev?.id !== next.id ||
              prev?.name !== next.name ||
              prev?.path !== next.path ||
              prev?.branch !== next.branch ||
              prev?.inheritConfig !== next.inheritConfig ||
              prev?.created !== next.created ||
              prev?.status !== next.status ||
              prev?.initStep !== next.initStep ||
              prev?.initMessage !== next.initMessage ||
              prev?.initError !== next.initError ||
              prev?.initJobId !== next.initJobId ||
              prev?.updatedAt !== next.updatedAt
            ) {
              changed = true;
              break;
            }
          }
        }

        if (!changed) {
          return project;
        }
        return { ...project, worktrees: nextWorktrees };
      });

      if (!changed) {
        return;
      }
      await commitProjects(nextProjects);
    },
    [commitProjects, projects],
  );

  /** 添加需要扫描的工作目录并持久化。 */
  const addDirectory = useCallback(
    async (path: string) => {
      const nextDirectories = Array.from(new Set([...appState.directories, path]));
      const nextState = { ...appState, directories: nextDirectories };
      await commitAppState(nextState);
    },
    [appState, commitAppState],
  );

  /** 移除工作目录并持久化。 */
  const removeDirectory = useCallback(
    async (path: string) => {
      const nextDirectories = appState.directories.filter((item) => item !== path);
      const nextState = { ...appState, directories: nextDirectories };
      await commitAppState(nextState);
    },
    [appState, commitAppState],
  );

  /** 将项目路径移入回收站并持久化。 */
  const moveProjectToRecycleBin = useCallback(
    async (path: string) => {
      if (!path) {
        return;
      }
      const nextRecycleBin = Array.from(new Set([...appState.recycleBin, path]));
      const nextState = { ...appState, recycleBin: nextRecycleBin };
      await commitAppState(nextState);
    },
    [appState, commitAppState],
  );

  /** 从回收站恢复项目路径并持久化。 */
  const restoreProjectFromRecycleBin = useCallback(
    async (path: string) => {
      if (!path) {
        return;
      }
      const nextRecycleBin = appState.recycleBin.filter((item) => item !== path);
      const nextState = { ...appState, recycleBin: nextRecycleBin };
      await commitAppState(nextState);
    },
    [appState, commitAppState],
  );

  /** 批量更新标签配置并持久化。 */
  const updateTags = useCallback(
    async (tags: TagData[]) => {
      const nextState = { ...appState, tags };
      await commitAppState(nextState);
    },
    [appState, commitAppState],
  );

  /** 更新应用设置并持久化。 */
  const updateSettings = useCallback(
    async (settings: AppStateFile["settings"]) => {
      const nextState = { ...appState, settings };
      await commitAppState(nextState);
    },
    [appState, commitAppState],
  );

  /** 新建标签并自动分配颜色。 */
  const addTag = useCallback(
    async (name: string, colorHex?: string) => {
      const normalized = name.trim();
      if (!normalized) {
        return;
      }
      if (appState.tags.some((tag) => tag.name === normalized)) {
        return;
      }
      const nextState = {
        ...appState,
        tags: [
          ...appState.tags,
          {
            name: normalized,
            color: hexToColorData(colorHex ?? pickColorForTag(normalized)),
            hidden: false,
          },
        ],
      };
      await commitAppState(nextState);
    },
    [appState, commitAppState],
  );

  /** 重命名标签，同时更新项目上的标签引用。 */
  const renameTag = useCallback(
    async (from: string, to: string) => {
      const normalized = to.trim();
      if (!normalized || from === normalized) {
        return;
      }
      if (appState.tags.some((tag) => tag.name === normalized)) {
        return;
      }

      const nextTags = appState.tags.map((tag) =>
        tag.name === from ? { ...tag, name: normalized } : tag,
      );
      const nextProjects = projects.map((project) =>
        project.tags.includes(from)
          ? { ...project, tags: project.tags.map((tag) => (tag === from ? normalized : tag)) }
          : project,
      );

      const nextState = { ...appState, tags: nextTags };
      await commitAppStateAndProjects(nextState, nextProjects);
    },
    [appState, commitAppStateAndProjects, projects],
  );

  /** 删除标签并同步移除项目引用。 */
  const removeTag = useCallback(
    async (name: string) => {
      const nextTags = appState.tags.filter((tag) => tag.name !== name);
      const nextProjects = projects.map((project) => ({
        ...project,
        tags: project.tags.filter((tag) => tag !== name),
      }));
      const nextState = { ...appState, tags: nextTags };
      await commitAppStateAndProjects(nextState, nextProjects);
    },
    [appState, commitAppStateAndProjects, projects],
  );

  /** 切换标签的隐藏状态。 */
  const toggleTagHidden = useCallback(
    async (name: string) => {
      const nextTags = appState.tags.map((tag) =>
        tag.name === name ? { ...tag, hidden: !tag.hidden } : tag,
      );
      const nextState = { ...appState, tags: nextTags };
      await commitAppState(nextState);
    },
    [appState, commitAppState],
  );

  /** 更新标签颜色配置。 */
  const setTagColor = useCallback(
    async (name: string, colorHex: string) => {
      const nextTags = appState.tags.map((tag) =>
        tag.name === name ? { ...tag, color: hexToColorData(colorHex) } : tag,
      );
      const nextState = { ...appState, tags: nextTags };
      await commitAppState(nextState);
    },
    [appState, commitAppState],
  );

  /** 为指定项目添加标签并同步全局标签。 */
  const addTagToProject = useCallback(
    async (projectId: string, tag: string) => {
      const nextProjects = projects.map((project) =>
        project.id === projectId && !project.tags.includes(tag)
          ? { ...project, tags: [...project.tags, tag] }
          : project,
      );
      await commitProjects(nextProjects);
      await syncTagsFromProjects(appState, nextProjects);
    },
    [appState, commitProjects, projects, syncTagsFromProjects],
  );

  /** 从指定项目移除标签。 */
  const removeTagFromProject = useCallback(
    async (projectId: string, tag: string) => {
      const nextProjects = projects.map((project) =>
        project.id === projectId ? { ...project, tags: project.tags.filter((item) => item !== tag) } : project,
      );
      await commitProjects(nextProjects);
    },
    [commitProjects, projects],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    appState,
    projects,
    isLoading,
    error,
    projectMap,
    refresh,
    addProjects,
    refreshProject,
    updateGitDaily,
    addProjectScript,
    updateProjectScript,
    removeProjectScript,
    addProjectWorktree,
    removeProjectWorktree,
    syncProjectWorktrees,
    addDirectory,
    removeDirectory,
    moveProjectToRecycleBin,
    restoreProjectFromRecycleBin,
    updateSettings,
    updateTags,
    addTag,
    renameTag,
    removeTag,
    toggleTagHidden,
    setTagColor,
    addTagToProject,
    removeTagFromProject,
  };
}

/** 将 Hex 颜色转换为可存储的 RGBA 结构。 */
function hexToColorData(hex: string) {
  const value = hex.replace("#", "");
  if (value.length !== 6) {
    return { r: 0.3, g: 0.3, b: 0.3, a: 1 };
  }
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return { r, g, b, a: 1 };
}

/** 按路径合并新旧项目，保留未更新的旧项目。 */
function mergeProjectsByPath(existing: Project[], updates: Project[]) {
  const updatesByPath = new Map(updates.map((project) => [project.path, project]));
  const existingPaths = new Set(existing.map((project) => project.path));
  const nextProjects = existing.map((project) => updatesByPath.get(project.path) ?? project);
  for (const project of updates) {
    if (!existingPaths.has(project.path)) {
      nextProjects.push(project);
    }
  }
  return nextProjects;
}

function normalizeProject(project: Project): Project {
  return {
    ...project,
    scripts: project.scripts ?? [],
    worktrees: project.worktrees ?? [],
  };
}
