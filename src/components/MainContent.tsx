import type { Project } from "../models/types";
import type { DateFilter, GitFilter } from "../models/filters";
import { DATE_FILTER_OPTIONS, GIT_FILTER_OPTIONS } from "../models/filters";
import ProjectCard from "./ProjectCard";
import SearchBar from "./SearchBar";
import {
  IconCalendar,
  IconChartLine,
  IconSearch,
  IconSettings,
  IconSidebarRight,
} from "./Icons";

export type MainContentProps = {
  projects: Project[];
  filteredProjects: Project[];
  recycleBinCount: number;
  isLoading: boolean;
  error: string | null;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  dateFilter: DateFilter;
  onDateFilterChange: (value: DateFilter) => void;
  gitFilter: GitFilter;
  onGitFilterChange: (value: GitFilter) => void;
  showDetailPanel: boolean;
  onToggleDetailPanel: () => void;
  onOpenDashboard: () => void;
  onOpenSettings: () => void;
  selectedProjects: Set<string>;
  onSelectProject: (project: Project, event: React.MouseEvent<HTMLDivElement>) => void;
  onTagSelected: (tag: string) => void;
  onRemoveTagFromProject: (projectId: string, tag: string) => void;
  onRefreshProject: (path: string) => void;
  onCopyPath: (path: string) => void;
  onOpenTerminal: (project: Project) => void;
  onMoveToRecycleBin: (project: Project) => void;
  getTagColor: (tag: string) => string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
};

/** 主内容区，负责搜索过滤与项目列表展示。 */
export default function MainContent({
  projects,
  filteredProjects,
  recycleBinCount,
  isLoading,
  error,
  searchText,
  onSearchTextChange,
  dateFilter,
  onDateFilterChange,
  gitFilter,
  onGitFilterChange,
  showDetailPanel,
  onToggleDetailPanel,
  onOpenDashboard,
  onOpenSettings,
  selectedProjects,
  onSelectProject,
  onTagSelected,
  onRemoveTagFromProject,
  onRefreshProject,
  onCopyPath,
  onOpenTerminal,
  onMoveToRecycleBin,
  getTagColor,
  searchInputRef,
}: MainContentProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col bg-background">
      <div className="flex h-search-area-h items-center gap-3 border-b border-search-area-border bg-search-area-bg p-2">
        <button className="icon-btn" aria-label="仪表盘" onClick={onOpenDashboard}>
          <IconChartLine size={18} />
        </button>
        <button
          className={`icon-btn ${showDetailPanel ? "text-accent" : ""}`}
          aria-label="详情面板"
          onClick={onToggleDetailPanel}
        >
          <IconSidebarRight size={18} />
        </button>
        <button className="icon-btn" aria-label="设置" onClick={onOpenSettings}>
          <IconSettings size={18} />
        </button>
        <SearchBar value={searchText} onChange={onSearchTextChange} ref={searchInputRef} />
        <label className="inline-flex items-center gap-1.5 rounded-md border border-search-border bg-search-bg px-2 py-1 text-[12px] font-semibold text-titlebar-icon">
          <IconCalendar size={14} />
          <select
            className="border-none bg-transparent text-[12px] font-semibold text-inherit outline-none"
            value={dateFilter}
            onChange={(event) => onDateFilterChange(event.target.value as DateFilter)}
          >
            {DATE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.title}
              </option>
            ))}
          </select>
        </label>
        <div className="inline-flex items-center gap-1 rounded-lg border border-search-border bg-search-bg p-0.5">
          {GIT_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors duration-150 ${
                gitFilter === option.value
                  ? "bg-accent text-white"
                  : "text-secondary-text hover:bg-button-hover hover:text-text"
              }`}
              onClick={() => onGitFilterChange(option.value)}
            >
              {option.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-secondary-text">
            正在加载项目数据...
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-secondary-text">{error}</div>
        ) : projects.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-secondary-text">
            {recycleBinCount > 0 ? (
              <>
                <div>当前没有可见项目</div>
                <div>可在左侧回收站恢复隐藏项目</div>
              </>
            ) : (
              <>
                <div>暂未添加项目目录</div>
                <div>请在左侧添加工作目录或直接导入项目</div>
              </>
            )}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-secondary-text">
            <IconSearch className="text-secondary-text" size={36} />
            <div>没有匹配的项目</div>
            <div>尝试修改搜索条件或清除标签筛选</div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4 p-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isSelected={selectedProjects.has(project.id)}
                selectedProjectIds={selectedProjects}
                onSelect={(event) => onSelectProject(project, event)}
                onOpenTerminal={onOpenTerminal}
                onTagClick={onTagSelected}
                onRemoveTag={onRemoveTagFromProject}
                getTagColor={getTagColor}
                onRefreshProject={onRefreshProject}
                onCopyPath={onCopyPath}
                onMoveToRecycleBin={onMoveToRecycleBin}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
