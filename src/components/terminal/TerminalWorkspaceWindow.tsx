import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { Project } from "../../models/types";
import { useDevHavenContext } from "../../state/DevHavenContext";
import TerminalWorkspaceView from "./TerminalWorkspaceView";
import {
  TERMINAL_OPEN_PROJECT_EVENT,
  TERMINAL_WINDOW_LABEL,
  type TerminalOpenProjectPayload,
} from "../../services/terminalWindow";

type OpenProjectRef = {
  projectId: string | null;
  projectPath: string;
  projectName: string | null;
};

function buildProjectTitle(project: Project | null, fallbackName: string | null, path: string) {
  return project?.name ?? fallbackName ?? path.split("/").pop() ?? path;
}

export default function TerminalWorkspaceWindow() {
  const { projects, projectMap, isLoading } = useDevHavenContext();
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const initialProject = useMemo<OpenProjectRef | null>(() => {
    const projectId = searchParams.get("projectId");
    const projectPath = searchParams.get("projectPath");
    const projectName = searchParams.get("projectName");
    if (!projectPath) {
      return null;
    }
    return { projectId, projectPath, projectName };
  }, [searchParams]);

  const [openProjects, setOpenProjects] = useState<OpenProjectRef[]>(() => (initialProject ? [initialProject] : []));
  const [activeProjectPath, setActiveProjectPath] = useState<string>(() => initialProject?.projectPath ?? "");

  const resolveProject = useCallback(
    (item: OpenProjectRef): Project | null => {
      if (item.projectId) {
        return projectMap.get(item.projectId) ?? null;
      }
      return projects.find((project) => project.path === item.projectPath) ?? null;
    },
    [projectMap, projects],
  );

  const activeProject = useMemo(() => {
    if (openProjects.length === 0) {
      return null;
    }
    if (activeProjectPath) {
      return openProjects.find((item) => item.projectPath === activeProjectPath) ?? openProjects[0];
    }
    return openProjects[0];
  }, [activeProjectPath, openProjects]);

  const openProject = useCallback((payload: TerminalOpenProjectPayload) => {
    if (!payload.projectPath) {
      return;
    }
    setOpenProjects((prev) => {
      const existing = prev.find((item) => item.projectPath === payload.projectPath);
      if (existing) {
        // 补齐项目 ID/名称（可能来自不同入口）。
        return prev.map((item) =>
          item.projectPath === payload.projectPath
            ? {
                ...item,
                projectId: payload.projectId ?? item.projectId,
                projectName: payload.projectName ?? item.projectName,
              }
            : item,
        );
      }
      return [
        ...prev,
        {
          projectId: payload.projectId ?? null,
          projectPath: payload.projectPath,
          projectName: payload.projectName ?? null,
        },
      ];
    });
    setActiveProjectPath(payload.projectPath);
  }, []);

  useEffect(() => {
    const unlistenPromise = listen<TerminalOpenProjectPayload>(TERMINAL_OPEN_PROJECT_EVENT, (event) => {
      openProject(event.payload);
    });
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [openProject]);

  useEffect(() => {
    if (!activeProject) {
      return;
    }
    const resolved = resolveProject(activeProject);
    const title = `${buildProjectTitle(resolved, activeProject.projectName, activeProject.projectPath)} - 终端`;
    getCurrentWindow()
      .setTitle(title)
      .catch(() => undefined);
  }, [activeProject, resolveProject]);

  if (!isLoading && openProjects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-secondary-text">
        未找到项目
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#0b0b0b] text-text">
      <aside className="w-[220px] shrink-0 border-r border-divider bg-secondary-background">
        <div className="px-3 py-2 text-[12px] font-semibold text-secondary-text">已打开项目</div>
        <div className="flex flex-col gap-1 p-2">
          {openProjects.map((item) => {
            const resolved = resolveProject(item);
            const title = buildProjectTitle(resolved, item.projectName, item.projectPath);
            const isActive = (activeProject?.projectPath ?? "") === item.projectPath;
            return (
              <button
                key={item.projectPath}
                className={`rounded-md px-2.5 py-2 text-left text-[12px] font-semibold transition-colors ${
                  isActive
                    ? "bg-[rgba(69,59,231,0.25)] text-text"
                    : "text-secondary-text hover:bg-button-hover hover:text-text"
                }`}
                onClick={() => setActiveProjectPath(item.projectPath)}
                title={item.projectPath}
              >
                <div className="truncate">{title}</div>
              </button>
            );
          })}
        </div>
      </aside>
      <main className="relative min-w-0 flex-1">
        {openProjects.map((item) => {
          const resolved = resolveProject(item);
          const title = buildProjectTitle(resolved, item.projectName, item.projectPath);
          const isActive = (activeProject?.projectPath ?? "") === item.projectPath;
          return (
            <div
              key={item.projectPath}
              className={`absolute inset-0 ${
                isActive ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <TerminalWorkspaceView
                projectId={resolved?.id ?? item.projectId}
                projectPath={resolved?.path ?? item.projectPath}
                projectName={title}
                windowLabel={TERMINAL_WINDOW_LABEL}
              />
            </div>
          );
        })}
      </main>
    </div>
  );
}

