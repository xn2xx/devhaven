import { memo } from "react";

import type { Project } from "../models/types";
import { swiftDateToJsDate } from "../models/types";
import { openInFinder } from "../services/system";
import { IconCalendar, IconCopy, IconFolder, IconRefresh, IconTerminal, IconX } from "./Icons";

export type ProjectCardProps = {
  project: Project;
  isSelected: boolean;
  selectedProjectIds: Set<string>;
  onSelect: (event: React.MouseEvent<HTMLDivElement>) => void;
  onEnterWorkspace: () => void;
  onTagClick: (tag: string) => void;
  onRemoveTag: (projectId: string, tag: string) => void;
  getTagColor: (tag: string) => string;
  onRefreshProject: (path: string) => void;
  onCopyPath: (path: string) => void;
  onOpenInTerminal: (path: string) => void;
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
  onEnterWorkspace,
  onTagClick,
  onRemoveTag,
  getTagColor,
  onRefreshProject,
  onCopyPath,
  onOpenInTerminal,
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
      className={`project-card${isSelected ? " is-selected" : ""}`}
      onClick={onSelect}
      onDoubleClick={onEnterWorkspace}
      draggable
      onDragStart={handleDragStart}
    >
      <div className="project-card-header">
        <div className="project-card-title" title={project.name}>
          {project.name}
        </div>
        <div className="project-card-actions">
          <button
            className="icon-button"
            aria-label="在 Finder 中显示"
            title="在 Finder 中显示"
            onClick={(event) => handleActionClick(event, () => void openInFinder(project.path))}
          >
            <IconFolder size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="在终端打开"
            title="在终端打开"
            onClick={(event) => handleActionClick(event, () => onOpenInTerminal(project.path))}
          >
            <IconTerminal size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="复制路径"
            title="复制路径"
            onClick={(event) => handleActionClick(event, () => void onCopyPath(project.path))}
          >
            <IconCopy size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="刷新项目"
            title="刷新项目"
            onClick={(event) => handleActionClick(event, () => void onRefreshProject(project.path))}
          >
            <IconRefresh size={16} />
          </button>
        </div>
      </div>
      <div className="project-card-path" title={project.path}>
        {project.path}
      </div>
      <div className="project-card-meta">
        <span className="project-card-date">
          <IconCalendar size={14} />
          {formatDate(project.mtime)}
        </span>
        {project.git_commits > 0 ? (
          <span className="git-badge">{project.git_commits} 次提交</span>
        ) : (
          <span>非 Git 项目</span>
        )}
      </div>
      <div className="project-card-tags">
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
              className="tag-remove"
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
