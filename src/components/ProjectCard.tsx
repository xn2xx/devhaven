import { memo } from "react";

import type { Project } from "../models/types";
import { swiftDateToJsDate } from "../models/types";
import { openInFinder } from "../services/system";
import { IconCalendar, IconCopy, IconFolder, IconRefresh, IconTrash, IconX } from "./Icons";

export type ProjectCardProps = {
  project: Project;
  isSelected: boolean;
  selectedProjectIds: Set<string>;
  onSelect: (event: React.MouseEvent<HTMLDivElement>) => void;
  onOpenTerminal: (project: Project) => void;
  onTagClick: (tag: string) => void;
  onRemoveTag: (projectId: string, tag: string) => void;
  getTagColor: (tag: string) => string;
  onRefreshProject: (path: string) => void;
  onCopyPath: (path: string) => void;
  onMoveToRecycleBin: (project: Project) => void;
};

/** 格式化 Swift 时间戳为中文日期。 */
const formatDate = (swiftDate: number) => {
  if (!swiftDate) {
    return "--";
  }
  const date = swiftDateToJsDate(swiftDate);
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
};

/** 项目卡片，展示基础信息与快捷操作。 */
function ProjectCard({
  project,
  isSelected,
  selectedProjectIds,
  onSelect,
  onOpenTerminal,
  onTagClick,
  onRemoveTag,
  getTagColor,
  onRefreshProject,
  onCopyPath,
  onMoveToRecycleBin,
}: ProjectCardProps) {
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
      className={`card ${isSelected ? "card-selected" : "hover:bg-card-hover"}`}
      onClick={onSelect}
      onDoubleClick={() => onOpenTerminal(project)}
      draggable
      onDragStart={handleDragStart}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-fs-title font-semibold text-text" title={project.name}>
          {project.name}
        </div>
        <div className="ml-auto inline-flex items-center gap-1.5">
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
      <div className="truncate text-fs-caption text-secondary-text" title={project.path}>
        {project.path}
      </div>
      <div className="flex items-center justify-between text-fs-caption text-secondary-text">
        <span className="inline-flex items-center gap-1">
          <IconCalendar size={14} />
          {formatDate(project.mtime)}
        </span>
        {project.git_commits > 0 ? (
          <span className="rounded-md bg-[rgba(69,59,231,0.15)] px-2 py-1 text-[12px] text-accent">
            {project.git_commits} 次提交
          </span>
        ) : (
          <span>非 Git 项目</span>
        )}
      </div>
      <div className="project-card-tags flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5">
        {project.tags.map((tag) => (
          <span
            key={tag}
            className="tag-pill"
            style={{ background: `${getTagColor(tag)}33`, color: getTagColor(tag) }}
          >
            <span onClick={(event) => {
              event.stopPropagation();
              onTagClick(tag);
            }}>
              {tag}
            </span>
            <button
              className="ml-1.5 inline-flex items-center justify-center text-[12px] opacity-60 hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                onRemoveTag(project.id, tag);
              }}
              aria-label={`移除标签 ${tag}`}
            >
              <IconX size={12} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default memo(ProjectCard);
