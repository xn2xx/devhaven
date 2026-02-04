import { useEffect, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { Project } from "../../models/types";
import TerminalWorkspaceView from "./TerminalWorkspaceView";

export type TerminalWorkspaceWindowProps = {
  openProjects: Project[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onExit?: () => void;
  windowLabel: string;
  isVisible: boolean;
};

export default function TerminalWorkspaceWindow({
  openProjects,
  activeProjectId,
  onSelectProject,
  onExit,
  windowLabel,
  isVisible,
}: TerminalWorkspaceWindowProps) {
  const activeProject = useMemo(() => {
    if (openProjects.length === 0) {
      return null;
    }
    if (activeProjectId) {
      return openProjects.find((project) => project.id === activeProjectId) ?? openProjects[0];
    }
    return openProjects[0];
  }, [activeProjectId, openProjects]);

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
      <div className="flex h-full items-center justify-center text-secondary-text">
        未找到项目
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#0b0b0b] text-text">
      <aside className="w-[220px] shrink-0 border-r border-divider bg-secondary-background">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="text-[12px] font-semibold text-secondary-text">已打开项目</div>
          {onExit ? (
            <button className="btn btn-outline h-7 px-2 text-[12px]" onClick={onExit}>
              返回
            </button>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 p-2">
          {openProjects.map((project) => {
            const isActive = (activeProject?.id ?? "") === project.id;
            return (
              <button
                key={project.id}
                className={`rounded-md px-2.5 py-2 text-left text-[12px] font-semibold transition-colors ${
                  isActive
                    ? "bg-[rgba(69,59,231,0.25)] text-text"
                    : "text-secondary-text hover:bg-button-hover hover:text-text"
                }`}
                onClick={() => onSelectProject(project.id)}
                title={project.path}
              >
                <div className="truncate">{project.name}</div>
              </button>
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
              />
            </div>
          );
        })}
      </main>
    </div>
  );
}
