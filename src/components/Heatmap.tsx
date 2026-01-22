import { useEffect, useMemo, useRef, useState } from "react";

import type { HeatmapConfig, HeatmapData } from "../models/heatmap";
import { formatDateKey } from "../utils/gitDaily";

export type HeatmapProps = {
  data: HeatmapData[];
  config: HeatmapConfig;
  title?: string;
  subtitle?: string;
  selectedDateKey?: string | null;
  onSelectDate?: (item: HeatmapData | null) => void;
  className?: string;
};

/** 通用热力图组件，支持不同布局配置。 */
export default function Heatmap({
  data,
  config,
  title,
  subtitle,
  selectedDateKey,
  onSelectDate,
  className,
}: HeatmapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [cellSize, setCellSize] = useState(config.compactMode ? 8 : 12);
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const weeks = useMemo(() => buildWeeks(data), [data]);
  const monthLabels = useMemo(() => buildMonthLabels(weeks), [weeks]);

  const gap = config.compactMode ? 2 : 4;

  useEffect(() => {
    if (!config.useAdaptiveSpacing) {
      setCellSize(config.compactMode ? 8 : 12);
      return;
    }
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const labelWidth = config.showWeekdayLabels ? 20 : 0;
    const observer = new ResizeObserver(() => {
      const width = element.clientWidth - labelWidth;
      if (width <= 0 || weeks.length === 0) {
        return;
      }
      const computed = Math.floor((width - gap * (weeks.length - 1)) / weeks.length);
      const baseSize = config.compactMode ? 8 : 12;
      setCellSize(Math.max(6, Math.min(baseSize + 4, computed)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [config.compactMode, config.showWeekdayLabels, config.useAdaptiveSpacing, gap, weeks.length]);

  const gridStyle = useMemo(
    () => ({
      gap: `${gap}px`,
      "--heatmap-cell": `${cellSize}px`,
      "--heatmap-gap": `${gap}px`,
    }),
    [cellSize, gap],
  );

  return (
    <div className={`heatmap ${config.compactMode ? "is-compact" : ""}${className ? ` ${className}` : ""}`}>
      {config.showHeader ? (
        <div className="heatmap-header">
          <div>
            <div className="heatmap-title">{title ?? "开发热力图"}</div>
            {subtitle ? <div className="heatmap-subtitle">{subtitle}</div> : null}
          </div>
        </div>
      ) : null}
      <div className="heatmap-body" ref={containerRef} style={gridStyle}>
        {config.showWeekdayLabels ? (
          <div className="heatmap-weekdays">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label.key} className="heatmap-weekday" style={{ gridRow: label.row + 1 }}>
                {label.label}
              </span>
            ))}
          </div>
        ) : null}
        <div className="heatmap-grid" style={gridStyle}>
          {config.showHeader ? (
            <div className="heatmap-months">
              {monthLabels.map((label, index) => (
                <span key={`month-${index}`} className="heatmap-month" style={{ width: cellSize }}>
                  {label}
                </span>
              ))}
            </div>
          ) : null}
          <div className="heatmap-weeks">
            {weeks.map((week, weekIndex) => (
              <div key={`week-${weekIndex}`} className="heatmap-week" style={gridStyle}>
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return <div key={`empty-${weekIndex}-${dayIndex}`} className="heatmap-cell is-empty" />;
                  }
                  const dateKey = formatDateKey(day.date);
                  const isSelected = selectedDateKey === dateKey;
                  const label = formatTooltip(day);
                  return (
                    <button
                      key={`cell-${dateKey}`}
                      type="button"
                      className={`heatmap-cell intensity-${day.intensity}${day.commitCount > 0 ? " is-active" : ""}${
                        isSelected ? " is-selected" : ""
                      }`}
                      aria-label={label}
                      onMouseEnter={(event) => {
                        if (!config.showTooltip) {
                          return;
                        }
                        const containerRect = containerRef.current?.getBoundingClientRect();
                        const cellRect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        if (!containerRect) {
                          return;
                        }
                        setTooltip({
                          text: label,
                          x: cellRect.left - containerRect.left + cellRect.width / 2,
                          y: cellRect.top - containerRect.top,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onFocus={(event) => {
                        if (!config.showTooltip) {
                          return;
                        }
                        const containerRect = containerRef.current?.getBoundingClientRect();
                        const cellRect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        if (!containerRect) {
                          return;
                        }
                        setTooltip({
                          text: label,
                          x: cellRect.left - containerRect.left + cellRect.width / 2,
                          y: cellRect.top - containerRect.top,
                        });
                      }}
                      onBlur={() => setTooltip(null)}
                      onClick={() => {
                        if (!onSelectDate) {
                          return;
                        }
                        onSelectDate(day.commitCount > 0 ? day : null);
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {tooltip ? (
          <div className="heatmap-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
            {tooltip.text}
          </div>
        ) : null}
      </div>
      {config.showLegend ? (
        <div className="heatmap-legend">
          <span>少</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={`legend-${level}`} className={`heatmap-legend-cell intensity-${level}`} />
          ))}
          <span>多</span>
        </div>
      ) : null}
    </div>
  );
}

type WeekCell = HeatmapData | null;

type WeekLabel = {
  key: string;
  label: string;
  row: number;
};

const WEEKDAY_LABELS: WeekLabel[] = [
  { key: "mon", label: "一", row: 1 },
  { key: "wed", label: "三", row: 3 },
  { key: "fri", label: "五", row: 5 },
];

function buildWeeks(data: HeatmapData[]): WeekCell[][] {
  if (data.length === 0) {
    return [];
  }
  const start = data[0].date;
  const startDay = start.getDay();
  const totalCells = startDay + data.length;
  const weekCount = Math.ceil(totalCells / 7);
  const weeks: WeekCell[][] = Array.from({ length: weekCount }, () => Array(7).fill(null));

  data.forEach((item, index) => {
    const cellIndex = startDay + index;
    const weekIndex = Math.floor(cellIndex / 7);
    const dayIndex = cellIndex % 7;
    weeks[weekIndex][dayIndex] = item;
  });

  return weeks;
}

function buildMonthLabels(weeks: WeekCell[][]) {
  let lastMonth: number | null = null;
  return weeks.map((week) => {
    const firstDay = week.find((item) => item !== null) as HeatmapData | null;
    if (!firstDay) {
      return "";
    }
    const month = firstDay.date.getMonth();
    if (lastMonth === month) {
      return "";
    }
    lastMonth = month;
    return `${month + 1}月`;
  });
}

function formatTooltip(item: HeatmapData) {
  const dateLabel = item.date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const commitLabel = item.commitCount === 0 ? "无提交" : `${item.commitCount} 次提交`;
  const projectLabel = item.projectIds.length > 0 ? ` · ${item.projectIds.length} 个项目` : "";
  return `${dateLabel}：${commitLabel}${projectLabel}`;
}
