import { invoke } from "@tauri-apps/api/core";

export type GitWorktreeAddPayload = {
  path: string;
  targetPath?: string;
  branch: string;
  createBranch: boolean;
};

export type GitWorktreeAddResult = {
  path: string;
  branch: string;
};

export type GitWorktreeListItem = {
  path: string;
  branch: string;
};

export type GitWorktreeRemovePayload = {
  path: string;
  worktreePath: string;
  force?: boolean;
};

export async function gitWorktreeAdd(payload: GitWorktreeAddPayload): Promise<GitWorktreeAddResult> {
  const params: Record<string, unknown> = {
    path: payload.path,
    branch: payload.branch,
    createBranch: payload.createBranch,
  };
  const targetPath = payload.targetPath?.trim();
  if (targetPath) {
    params.targetPath = targetPath;
  }
  return invoke<GitWorktreeAddResult>("git_worktree_add", params);
}

export async function gitWorktreeList(path: string): Promise<GitWorktreeListItem[]> {
  return invoke<GitWorktreeListItem[]>("git_worktree_list", { path });
}

export async function gitWorktreeRemove(payload: GitWorktreeRemovePayload): Promise<void> {
  await invoke("git_worktree_remove", {
    path: payload.path,
    worktreePath: payload.worktreePath,
    force: payload.force ?? false,
  });
}
