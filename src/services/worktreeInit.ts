import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type WorktreeInitStep =
  | "pending"
  | "validating"
  | "checking_branch"
  | "creating_worktree"
  | "preparing_environment"
  | "syncing"
  | "ready"
  | "failed"
  | "cancelled";

export type WorktreeInitStartRequest = {
  projectId: string;
  projectPath: string;
  branch: string;
  createBranch: boolean;
  baseBranch?: string;
  targetPath?: string;
};

export type WorktreeInitStartResult = {
  jobId: string;
  projectId: string;
  projectPath: string;
  worktreePath: string;
  branch: string;
  baseBranch?: string;
  step: WorktreeInitStep;
  message: string;
};

export type WorktreeInitProgressPayload = {
  jobId: string;
  projectId: string;
  projectPath: string;
  worktreePath: string;
  branch: string;
  baseBranch?: string;
  step: WorktreeInitStep;
  message: string;
  error?: string | null;
};

export type WorktreeInitCancelResult = {
  jobId: string;
  cancelled: boolean;
};

export type WorktreeInitJobStatus = {
  jobId: string;
  projectId: string;
  projectPath: string;
  worktreePath: string;
  branch: string;
  baseBranch?: string;
  createBranch: boolean;
  step: WorktreeInitStep;
  message: string;
  error?: string | null;
  updatedAt: number;
  isRunning: boolean;
  cancelRequested: boolean;
};

export async function worktreeInitStart(
  request: WorktreeInitStartRequest,
): Promise<WorktreeInitStartResult> {
  return invoke<WorktreeInitStartResult>("worktree_init_start", { request });
}

export async function worktreeInitCancel(jobId: string): Promise<WorktreeInitCancelResult> {
  return invoke<WorktreeInitCancelResult>("worktree_init_cancel", { jobId });
}

export async function worktreeInitRetry(jobId: string): Promise<WorktreeInitStartResult> {
  return invoke<WorktreeInitStartResult>("worktree_init_retry", {
    request: { jobId },
  });
}

export async function worktreeInitStatus(query?: {
  projectId?: string;
  projectPath?: string;
}): Promise<WorktreeInitJobStatus[]> {
  return invoke<WorktreeInitJobStatus[]>("worktree_init_status", {
    query: query ?? null,
  });
}

export async function listenWorktreeInitProgress(
  handler: (event: { payload: WorktreeInitProgressPayload }) => void,
) {
  return listen<WorktreeInitProgressPayload>("worktree-init-progress", handler);
}
