import { memo } from "react";

import type { Project } from "../models/types";
import { swiftDateToJsDate } from "../models/types";
import { openInFinder } from "../services/system";
import { formatPathWithTilde } from "../utils/pathDisplay";
import { IconCopy, IconFolder, IconRefresh, IconTrash } from "./Icons";

export type ProjectListRowProps = {
  project: Project;
  isSelected: boolean;
  selectedProjectIds: Set<string>;
  notePreview: string;
  onSelect: (event: React.MouseEvent<HTMLDivElement>) => void;
  onOpenTerminal: (project: Project) => void;
  onRefreshProject: (path: string) => void;
  onCopyPath: (path: string) => void;
  onMoveToRecycleBin: (project: Project) => void;
};

const formatDateTime = (swiftDate: number) => {
  if (!swiftDate) {
    return "--";
  }
  return swiftDateToJsDate(swiftDate).toLocaleString("zh-CN");
};

function ProjectListRow({
  project,
  isSelected,
  selectedProjectIds,
  notePreview,
  onSelect,
  onOpenTerminal,
  onRefreshProject,
  onCopyPath,
  onMoveToRecycleBin,
}: ProjectListRowProps) {
  const displayPath = formatPathWithTilde(project.path);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    const ids = selectedProjectIds.has(project.id)
      ? Array.from(selectedProjectIds)
      : [project.id];
    event.dataTransfer.setData("application/x-project-ids", JSON.stringify(ids));
    event.dataTransfer.effectAllowed = "copy";
  };

  const handleActionClick = (event: React.MouseEvent, action: () => void) => {
    event.stopPropagation();
    action();
  };

  return (
    <div
      className={`group grid cursor-pointer grid-cols-[minmax(220px,2.2fr)_170px_minmax(180px,2fr)_116px] items-center gap-3 border-b border-divider px-3 py-2.5 text-[13px] transition-colors duration-150 last:border-b-0 ${
        isSelected ? "bg-card-selected-bg" : "hover:bg-card-hover"
      }`}
      onClick={onSelect}
      onDoubleClick={() => onOpenTerminal(project)}
      draggable
      onDragStart={handleDragStart}
      role="row"
      aria-selected={isSelected}
    >
      <div className="min-w-0">
        <div className="truncate font-semibold text-text" title={project.name}>
          {project.name}
        </div>
        <div className="truncate text-fs-caption text-secondary-text" title={project.path}>
          {displayPath}
        </div>
      </div>
      <div className="truncate text-secondary-text" title={formatDateTime(project.mtime)}>
        {formatDateTime(project.mtime)}
      </div>
      <div className="truncate text-secondary-text" title={notePreview}>
        {notePreview}
      </div>
      <div className="ml-auto inline-flex items-center justify-end gap-1">
        <button
          className="icon-btn text-titlebar-icon"
          aria-label="在 Finder 中显示"
          title="在 Finder 中显示"
          onClick={(event) => handleActionClick(event, () => void openInFinder(project.path))}
        >
          <IconFolder size={16} />
        </button>
        <button
          className="icon-btn text-titlebar-icon"
          aria-label="复制路径"
          title="复制路径"
          onClick={(event) => handleActionClick(event, () => void onCopyPath(project.path))}
        >
          <IconCopy size={16} />
        </button>
        <button
          className="icon-btn text-titlebar-icon"
          aria-label="刷新项目"
          title="刷新项目"
          onClick={(event) => handleActionClick(event, () => void onRefreshProject(project.path))}
        >
          <IconRefresh size={16} />
        </button>
        <button
          className="icon-btn text-titlebar-icon"
          aria-label="移入回收站"
          title="移入回收站"
          onClick={(event) => handleActionClick(event, () => void onMoveToRecycleBin(project))}
        >
          <IconTrash size={16} />
        </button>
      </div>
    </div>
  );
}

export default memo(ProjectListRow);
