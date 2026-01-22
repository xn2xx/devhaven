export type HeatmapCacheEntry = {
  dateString: string;
  commitCount: number;
  projectIds: string[];
};

export type HeatmapCacheFile = {
  version: number;
  lastUpdated: string;
  dailyActivity: Record<string, HeatmapCacheEntry>;
  projectCount: number;
  gitDailySignature: string;
};

export type HeatmapData = {
  date: Date;
  commitCount: number;
  projectIds: string[];
  intensity: number;
};

export type HeatmapConfig = {
  days: number;
  showTooltip: boolean;
  showHeader: boolean;
  showLegend: boolean;
  showWeekdayLabels: boolean;
  compactMode: boolean;
  useAdaptiveSpacing: boolean;
};

export const HEATMAP_CONFIG = {
  sidebar: {
    days: 90,
    showTooltip: true,
    showHeader: false,
    showLegend: false,
    showWeekdayLabels: false,
    compactMode: true,
    useAdaptiveSpacing: true,
  },
  dashboard: {
    days: 365,
    showTooltip: true,
    showHeader: true,
    showLegend: false,
    showWeekdayLabels: false,
    compactMode: false,
    useAdaptiveSpacing: false,
  },
} as const satisfies Record<string, HeatmapConfig>;

export const EMPTY_HEATMAP_CACHE: HeatmapCacheFile = {
  version: 1,
  lastUpdated: "",
  dailyActivity: {},
  projectCount: 0,
  gitDailySignature: "",
};
