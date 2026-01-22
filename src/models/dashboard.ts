export type DailyActivity = {
  id: string;
  date: Date;
  commitCount: number;
  projectIds: string[];
};

export type HeatmapStats = {
  totalDays: number;
  activeDays: number;
  totalCommits: number;
  maxCommitsInDay: number;
  averageCommitsPerDay: number;
  activityRate: number;
};

export type TimeRange = {
  key: "oneMonth" | "threeMonths" | "sixMonths" | "oneYear";
  label: string;
  days: number;
};

export const TIME_RANGES: TimeRange[] = [
  { key: "oneMonth", label: "最近1个月", days: 30 },
  { key: "threeMonths", label: "最近3个月", days: 90 },
  { key: "sixMonths", label: "最近6个月", days: 180 },
  { key: "oneYear", label: "最近1年", days: 365 },
];
