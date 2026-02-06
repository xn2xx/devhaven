export type GitFileStatus = "added" | "modified" | "deleted" | "renamed" | "copied" | "untracked";

export type GitChangedFile = {
  path: string;
  oldPath?: string | null;
  status: GitFileStatus;
};

export type GitRepoStatus = {
  branch: string;
  upstream?: string | null;
  ahead: number;
  behind: number;
  staged: GitChangedFile[];
  unstaged: GitChangedFile[];
  untracked: GitChangedFile[];
};

export type GitDiffContents = {
  original: string;
  modified: string;
  originalTruncated?: boolean;
  modifiedTruncated?: boolean;
};
