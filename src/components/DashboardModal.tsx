import { useMemo, useState } from "react";

import { HEATMAP_CONFIG } from "../models/heatmap";
import type { DailyActivity, TimeRange } from "../models/dashboard";
import { TIME_RANGES } from "../models/dashboard";
import type { Project, TagData } from "../models/types";
import type { HeatmapStore } from "../state/useHeatmapData";
import { formatDateKey, parseGitDaily } from "../utils/gitDaily";
import Heatmap from "./Heatmap";

export type DashboardModalProps = {
  projects: Project[];
  tags: TagData[];
  heatmapStore: HeatmapStore;
  onClose: () => void;
  onUpdateGitDaily: () => Promise<void>;
};

/** 仪表盘弹窗，展示热力图与统计概览。 */
export default function DashboardModal({ projects, tags, heatmapStore, onClose, onUpdateGitDaily }: DashboardModalProps) {
  const [range, setRange] = useState<TimeRange>(TIME_RANGES[TIME_RANGES.length - 1]);
  const [isUpdating, setIsUpdating] = useState(false);

  const heatmapData = useMemo(
    () => heatmapStore.getHeatmapData(range.days),
    [heatmapStore, range.days],
  );

  const stats = useMemo(() => heatmapStore.getStats(range.days), [heatmapStore, range.days]);

  const dailyActivities = useMemo(() => heatmapStore.getDailyActivities(range.days), [heatmapStore, range.days]);

  const activeProjects = useMemo(
    () => buildProjectActivity(projects, range.days),
    [projects, range.days],
  );

  const gitProjects = useMemo(() => projects.filter((project) => project.git_commits > 0).length, [projects]);

  const lastUpdatedLabel = useMemo(() => {
    if (!heatmapStore.cache.lastUpdated) {
      return "未更新";
    }
    const parsed = new Date(heatmapStore.cache.lastUpdated);
    if (Number.isNaN(parsed.getTime())) {
      return "未更新";
    }
    return parsed.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [heatmapStore.cache.lastUpdated]);

  const handleRefresh = async () => {
    if (isUpdating) {
      return;
    }
    setIsUpdating(true);
    try {
      await onUpdateGitDaily();
      await heatmapStore.refresh(true);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal>
      <div className="modal modal-large dashboard-modal">
        <div className="dashboard-header">
          <div>
            <div className="dashboard-title">项目仪表盘</div>
            <div className="dashboard-subtitle">最后更新：{lastUpdatedLabel}</div>
          </div>
          <div className="dashboard-actions">
            <button className="button button-outline" onClick={() => void handleRefresh()} disabled={isUpdating}>
              {isUpdating ? "更新中..." : "更新统计"}
            </button>
            <button className="button" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

        <div className="dashboard-range">
          {TIME_RANGES.map((item) => (
            <button
              key={item.key}
              className={`range-button${range.key === item.key ? " is-active" : ""}`}
              onClick={() => setRange(item)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="dashboard-grid">
          <StatCard label="总项目数" value={projects.length} />
          <StatCard label="Git 项目" value={gitProjects} />
          <StatCard label="标签数" value={tags.length} />
          <StatCard label="活跃天数" value={stats.activeDays} />
          <StatCard label="总提交数" value={stats.totalCommits} />
          <StatCard label="活跃率" value={`${Math.round(stats.activityRate * 100)}%`} />
        </div>

        <div className="dashboard-section">
          {heatmapStore.isLoading ? (
            <div className="heatmap-placeholder">正在生成热力图...</div>
          ) : heatmapData.length > 0 ? (
            <Heatmap
              data={heatmapData}
              config={HEATMAP_CONFIG.dashboard}
              title="开发热力图"
              subtitle={`${range.label} · 日均 ${stats.averageCommitsPerDay.toFixed(1)} 次提交`}
              className="heatmap-dashboard"
            />
          ) : (
            <div className="heatmap-placeholder">暂无提交数据</div>
          )}
        </div>

        <div className="dashboard-two-column">
          <div className="dashboard-section">
            <div className="dashboard-section-title">最近活跃日期</div>
            {dailyActivities.length === 0 ? (
              <div className="dashboard-empty">暂无活跃记录</div>
            ) : (
              <div className="dashboard-list">
                {dailyActivities.slice(0, 8).map((activity) => (
                  <DailyActivityRow key={activity.id} activity={activity} />
                ))}
              </div>
            )}
          </div>
          <div className="dashboard-section">
            <div className="dashboard-section-title">最活跃项目</div>
            {activeProjects.length === 0 ? (
              <div className="dashboard-empty">暂无 Git 项目</div>
            ) : (
              <div className="dashboard-list">
                {activeProjects.slice(0, 8).map((project) => (
                  <ProjectActivityRow key={project.id} data={project} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string | number;
};

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="dashboard-card">
      <div className="dashboard-label">{label}</div>
      <div className="dashboard-value">{value}</div>
    </div>
  );
}

type ProjectActivity = {
  id: string;
  name: string;
  commitCount: number;
  activeDays: number;
};

function buildProjectActivity(projects: Project[], days: number): ProjectActivity[] {
  const endDate = startOfDay(new Date());
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - (days - 1));
  const startKey = formatDateKey(startDate);
  const endKey = formatDateKey(endDate);

  const results: ProjectActivity[] = [];
  for (const project of projects) {
    if (!project.git_daily) {
      continue;
    }
    const map = parseGitDaily(project.git_daily);
    let commitCount = 0;
    let activeDays = 0;
    for (const [dateKey, count] of Object.entries(map)) {
      if (dateKey < startKey || dateKey > endKey) {
        continue;
      }
      commitCount += count;
      if (count > 0) {
        activeDays += 1;
      }
    }
    if (commitCount > 0) {
      results.push({ id: project.id, name: project.name, commitCount, activeDays });
    }
  }
  return results.sort((a, b) => b.commitCount - a.commitCount);
}

type ActivityRowProps = {
  activity: DailyActivity;
};

function DailyActivityRow({ activity }: ActivityRowProps) {
  const dateLabel = activity.date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
  return (
    <div className="dashboard-row">
      <div className="dashboard-row-title">{dateLabel}</div>
      <div className="dashboard-row-meta">
        {activity.commitCount} 次提交 · {activity.projectIds.length} 个项目
      </div>
    </div>
  );
}

type ProjectRowProps = {
  data: ProjectActivity;
};

function ProjectActivityRow({ data }: ProjectRowProps) {
  return (
    <div className="dashboard-row">
      <div className="dashboard-row-title">{data.name}</div>
      <div className="dashboard-row-meta">
        {data.commitCount} 次提交 · {data.activeDays} 天活跃
      </div>
    </div>
  );
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}
