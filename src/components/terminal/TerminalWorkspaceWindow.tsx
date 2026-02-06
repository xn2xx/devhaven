import type { CSSProperties } from "react";
import { useEffect, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { Project } from "../../models/types";
import type { GitWorktreeListItem } from "../../services/gitWorktree";
import { useSystemColorScheme } from "../../hooks/useSystemColorScheme";
import { useDevHavenContext } from "../../state/DevHavenContext";
import {
  getTerminalThemePresetByName,
  resolveTerminalThemeName,
} from "../../themes/terminalThemes";
import type { CodexProjectStatus } from "../../utils/codexProjectStatus";
import TerminalWorkspaceView from "./TerminalWorkspaceView";

export type TerminalWorkspaceWindowProps = {
  openProjects: Project[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCloseProject: (projectId: string) => void;
  onCreateWorktree: (projectId: string) => void;
  onOpenWorktree: (projectId: string, worktreePath: string) => void;
  onDeleteWorktree: (projectId: string, worktreePath: string) => void;
  onRefreshWorktrees: (projectId: string) => void;
  onExit?: () => void;
  windowLabel: string;
  isVisible: boolean;
  codexProjectStatusById: Record<string, CodexProjectStatus>;
  gitWorktreesByProjectId: Record<string, GitWorktreeListItem[] | undefined>;
};

export default function TerminalWorkspaceWindow({
  openProjects,
  activeProjectId,
  onSelectProject,
  onCloseProject,
  onCreateWorktree,
  onOpenWorktree,
  onDeleteWorktree,
  onRefreshWorktrees,
  onExit,
  windowLabel,
  isVisible,
  codexProjectStatusById,
  gitWorktreesByProjectId,
}: TerminalWorkspaceWindowProps) {
  const { appState } = useDevHavenContext();
  const systemScheme = useSystemColorScheme();
  const terminalThemePreset = useMemo(() => {
    const resolvedName = resolveTerminalThemeName(appState.settings.terminalTheme, systemScheme);
    return getTerminalThemePresetByName(resolvedName);
  }, [appState.settings.terminalTheme, systemScheme]);

  const terminalStyle = useMemo(() => {
    return {
      ...terminalThemePreset.uiVars,
      colorScheme: terminalThemePreset.colorScheme,
    } as CSSProperties;
  }, [terminalThemePreset]);

  const activeProject = useMemo(() => {
    if (openProjects.length === 0) {
      return null;
    }
    if (activeProjectId) {
      return openProjects.find((project) => project.id === activeProjectId) ?? openProjects[0];
    }
    return openProjects[0];
  }, [activeProjectId, openProjects]);

  const rootProjects = useMemo(
    () => openProjects.filter((project) => !project.id.startsWith("worktree:")),
    [openProjects],
  );

  const openProjectsByPath = useMemo(() => {
    return new Map(openProjects.map((project) => [project.path, project]));
  }, [openProjects]);

  const trackedWorktreesByProjectId = useMemo(() => {
    return new Map(rootProjects.map((project) => [project.id, project.worktrees ?? []]));
  }, [rootProjects]);

  const resolveWorktreeName = useMemo(() => {
    return (sourceProjectId: string, worktreePath: string) => {
      const tracked = trackedWorktreesByProjectId.get(sourceProjectId) ?? [];
      const match = tracked.find((item) => item.path === worktreePath);
      if (match?.name) {
        return match.name;
      }
      const normalized = worktreePath.replace(/\\/g, "/").replace(/\/+$/, "");
      const last = normalized.split("/").filter(Boolean).pop();
      return last || worktreePath;
    };
  }, [trackedWorktreesByProjectId]);

  useEffect(() => {
    // 仅在终端可见时更新窗口标题；隐藏时恢复默认标题，避免主界面停留在“xx - 终端”。
    if (!isVisible) {
      getCurrentWindow()
        .setTitle("DevHaven")
        .catch(() => undefined);
      return;
    }
    if (!activeProject) {
      return;
    }
    getCurrentWindow()
      .setTitle(`${activeProject.name} - 终端`)
      .catch(() => undefined);
  }, [activeProject, isVisible]);

  if (openProjects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--terminal-muted-fg)]">
        未找到项目
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[var(--terminal-bg)] text-[var(--terminal-fg)]" style={terminalStyle}>
      <aside className="w-[220px] shrink-0 border-r border-[var(--terminal-divider)] bg-[var(--terminal-panel-bg)]">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="text-[12px] font-semibold text-[var(--terminal-muted-fg)]">已打开项目</div>
          {onExit ? (
            <button
              className="inline-flex h-7 items-center justify-center rounded-md border border-[var(--terminal-divider)] px-2 text-[12px] font-semibold text-[var(--terminal-muted-fg)] transition-colors duration-150 hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)]"
              onClick={onExit}
            >
              返回
            </button>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 p-2">
          {rootProjects.map((project) => {
            const isActive = (activeProject?.id ?? "") === project.id;
            const codexStatus = codexProjectStatusById[project.id] ?? null;
            const codexRunningCount = codexStatus?.runningCount ?? 0;
            const trackedWorktrees = project.worktrees ?? [];
            const gitWorktrees = gitWorktreesByProjectId[project.id];

            const worktreesToRender = (gitWorktrees !== undefined
              ? gitWorktrees.map((item) => ({
                  path: item.path,
                  branch: item.branch,
                  name: resolveWorktreeName(project.id, item.path),
                }))
              : trackedWorktrees.map((item) => ({
                  path: item.path,
                  branch: item.branch,
                  name: item.name,
                }))) as Array<{ path: string; branch: string; name: string }>;

            const hasWorktrees = worktreesToRender.length > 0;
            return (
              <div key={project.id} className="flex flex-col gap-1" title={project.path}>
                <div
                  className={`group flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] font-semibold transition-colors ${
                    isActive
                      ? "bg-[var(--terminal-accent-bg)] text-[var(--terminal-fg)]"
                      : "text-[var(--terminal-muted-fg)] hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)]"
                  }`}
                >
                  <button className="min-w-0 flex-1 truncate text-left" onClick={() => onSelectProject(project.id)}>
                    {project.name}
                  </button>
                  {codexRunningCount > 0 ? (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--terminal-divider)] bg-[var(--terminal-hover-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--terminal-muted-fg)]"
                      title={`Codex 运行中（${codexRunningCount} 个会话）`}
                    >
                      <span className="h-2 w-2 rounded-full bg-[var(--terminal-accent)]" aria-hidden="true" />
                      <span className="whitespace-nowrap">Codex</span>
                    </span>
                  ) : null}
                  <button
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-[var(--terminal-muted-fg)] opacity-0 transition-opacity hover:border-[var(--terminal-divider)] hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)] group-hover:opacity-100"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRefreshWorktrees(project.id);
                    }}
                    aria-label={`刷新 ${project.name} worktree`}
                    title="刷新 worktree"
                    type="button"
                  >
                    ↻
                  </button>
                  <button
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-[var(--terminal-muted-fg)] opacity-0 transition-opacity hover:border-[var(--terminal-divider)] hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)] group-hover:opacity-100"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onCreateWorktree(project.id);
                    }}
                    aria-label={`为 ${project.name} 创建 worktree`}
                    title="创建 worktree"
                    type="button"
                  >
                    +
                  </button>
                  <button
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-[var(--terminal-muted-fg)] opacity-0 transition-opacity hover:border-[var(--terminal-divider)] hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)] group-hover:opacity-100"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onCloseProject(project.id);
                    }}
                    aria-label={`关闭 ${project.name}`}
                    title="关闭项目"
                    type="button"
                  >
                    ×
                  </button>
                </div>

                {hasWorktrees ? (
                  <div className="flex flex-col gap-1 pl-3">
                    {worktreesToRender.map((worktree) => {
                      const openedProject = openProjectsByPath.get(worktree.path);
                      const isWorktreeActive = activeProject?.path === worktree.path;
                      return (
                        <div
                          key={worktree.path}
                          className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
                            isWorktreeActive
                              ? "bg-[var(--terminal-accent-bg)] text-[var(--terminal-fg)]"
                              : "text-[var(--terminal-muted-fg)] hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)]"
                          }`}
                          title={worktree.path}
                        >
                          <button
                            className="min-w-0 flex-1 truncate text-left"
                            onClick={() => {
                              if (openedProject) {
                                onSelectProject(openedProject.id);
                                return;
                              }
                              onOpenWorktree(project.id, worktree.path);
                            }}
                          >
                            ↳ {worktree.name}
                          </button>
                          <span className="shrink-0 rounded border border-[var(--terminal-divider)] px-1.5 py-0.5 text-[10px] text-[var(--terminal-muted-fg)]">
                            {worktree.branch}
                          </span>
                          <button
                            className="inline-flex h-5 items-center justify-center rounded-md border border-transparent px-1.5 text-[10px] text-[var(--terminal-muted-fg)] opacity-0 transition-opacity hover:border-[rgba(239,68,68,0.35)] hover:bg-[rgba(239,68,68,0.15)] hover:text-[rgba(239,68,68,0.9)] group-hover:opacity-100"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onDeleteWorktree(project.id, worktree.path);
                            }}
                            title="删除 worktree"
                            type="button"
                          >
                            删除
                          </button>
                          <button
                            className="inline-flex h-5 items-center justify-center rounded-md border border-transparent px-1.5 text-[10px] text-[var(--terminal-muted-fg)] opacity-0 transition-opacity hover:border-[var(--terminal-divider)] hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)] group-hover:opacity-100"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (openedProject) {
                                onCloseProject(openedProject.id);
                                return;
                              }
                              onOpenWorktree(project.id, worktree.path);
                            }}
                            title={openedProject ? "关闭 worktree" : "打开 worktree"}
                            type="button"
                          >
                            {openedProject ? "关闭" : "打开"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>
      <main className="relative min-w-0 flex-1">
        {openProjects.map((project) => {
          const isActive = (activeProject?.id ?? "") === project.id;
          return (
            <div
              key={project.id}
              className={`absolute inset-0 ${
                isActive ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <TerminalWorkspaceView
                projectId={project.id}
                projectPath={project.path}
                projectName={project.name}
                isActive={isVisible && isActive}
                windowLabel={windowLabel}
                xtermTheme={terminalThemePreset.xterm}
                codexRunningCount={codexProjectStatusById[project.id]?.runningCount ?? 0}
                scripts={project.scripts ?? []}
              />
            </div>
          );
        })}
      </main>
    </div>
  );
}
