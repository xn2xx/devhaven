export type DateFilter = "all" | "lastDay" | "lastWeek";

export type GitFilter = "all" | "gitOnly" | "nonGitOnly";

type DateFilterOption = {
  value: DateFilter;
  title: string;
  shortLabel: string;
  days: number | null;
};

export const DATE_FILTER_OPTIONS: DateFilterOption[] = [
  {
    value: "all",
    title: "全部日期",
    shortLabel: "全部",
    days: null,
  },
  {
    value: "lastDay",
    title: "最近一天",
    shortLabel: "最近1天",
    days: 1,
  },
  {
    value: "lastWeek",
    title: "最近一周",
    shortLabel: "最近7天",
    days: 7,
  },
];

type GitFilterOption = {
  value: GitFilter;
  title: string;
};

export const GIT_FILTER_OPTIONS: GitFilterOption[] = [
  {
    value: "all",
    title: "全部项目",
  },
  {
    value: "gitOnly",
    title: "仅 Git 项目",
  },
  {
    value: "nonGitOnly",
    title: "仅非 Git 项目",
  },
];
