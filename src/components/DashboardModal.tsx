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
      <div className="modal-panel min-w-[600px] w-[min(980px,92vw)] max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[18px] font-semibold">项目仪表盘</div>
            <div className="text-fs-caption text-secondary-text">最后更新：{lastUpdatedLabel}</div>
          </div>
          <div className="inline-flex gap-2">
            <button className="btn btn-outline" onClick={() => void handleRefresh()} disabled={isUpdating}>
              {isUpdating ? "更新中..." : "更新统计"}
            </button>
            <button className="btn" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {TIME_RANGES.map((item) => (
            <button
              key={item.key}
              className={`rounded-full px-3 py-1.5 text-[12px] ${
                range.key === item.key ? "bg-accent text-white" : "bg-button-bg text-secondary-text"
              }`}
              onClick={() => setRange(item)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
          <StatCard label="总项目数" value={projects.length} />
          <StatCard label="Git 项目" value={gitProjects} />
          <StatCard label="标签数" value={tags.length} />
          <StatCard label="活跃天数" value={stats.activeDays} />
          <StatCard label="总提交数" value={stats.totalCommits} />
          <StatCard label="活跃率" value={`${Math.round(stats.activityRate * 100)}%`} />
        </div>

        <div className="flex flex-col gap-3">
          {heatmapStore.isLoading ? (
            <div className="px-3 py-2 text-fs-caption text-secondary-text">正在生成热力图...</div>
          ) : heatmapData.length > 0 ? (
            <Heatmap
              data={heatmapData}
              config={HEATMAP_CONFIG.dashboard}
              title="开发热力图"
              subtitle={`${range.label} · 日均 ${stats.averageCommitsPerDay.toFixed(1)} 次提交`}
              className="heatmap-dashboard"
            />
          ) : (
            <div className="px-3 py-2 text-fs-caption text-secondary-text">暂无提交数据</div>
          )}
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          <div className="flex flex-col gap-3">
            <div className="text-[13px] font-semibold">最近活跃日期</div>
            {dailyActivities.length === 0 ? (
              <div className="text-fs-caption text-secondary-text">暂无活跃记录</div>
            ) : (
              <div className="flex flex-col gap-2">
                {dailyActivities.slice(0, 8).map((activity) => (
                  <DailyActivityRow key={activity.id} activity={activity} />
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-[13px] font-semibold">最活跃项目</div>
            {activeProjects.length === 0 ? (
              <div className="text-fs-caption text-secondary-text">暂无 Git 项目</div>
            ) : (
              <div className="flex flex-col gap-2">
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
    <div className="rounded-[10px] border border-border bg-card-bg p-3.5">
      <div className="text-fs-caption text-secondary-text">{label}</div>
      <div className="text-[20px] font-semibold">{value}</div>
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
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-card-bg px-2.5 py-2">
      <div className="text-[13px] font-semibold text-text">{dateLabel}</div>
      <div className="text-fs-caption text-secondary-text">
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
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-card-bg px-2.5 py-2">
      <div className="text-[13px] font-semibold text-text">{data.name}</div>
      <div className="text-fs-caption text-secondary-text">
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
