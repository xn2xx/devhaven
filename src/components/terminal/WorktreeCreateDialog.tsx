import { useEffect, useMemo, useState } from "react";

import type { BranchListItem } from "../../models/branch";
import type { Project } from "../../models/types";
import { listBranches } from "../../services/git";
import { gitWorktreeList, type GitWorktreeListItem } from "../../services/gitWorktree";

export type WorktreeCreateSubmitPayload =
  | {
      mode: "create";
      sourceProjectId: string;
      sourceProjectPath: string;
      branch: string;
      createBranch: boolean;
      autoOpen: boolean;
    }
  | {
      mode: "open-existing";
      sourceProjectId: string;
      sourceProjectPath: string;
      worktreePath: string;
      branch: string;
      autoOpen: boolean;
    };

type WorktreeCreateDialogProps = {
  isOpen: boolean;
  sourceProject: Project | null;
  onClose: () => void;
  onSubmit: (payload: WorktreeCreateSubmitPayload) => Promise<void>;
};

/** 在终端工作区内创建或打开 Git worktree 的弹窗。 */
export default function WorktreeCreateDialog({
  isOpen,
  sourceProject,
  onClose,
  onSubmit,
}: WorktreeCreateDialogProps) {
  const [mode, setMode] = useState<"create" | "open-existing">("create");
  const [branchMode, setBranchMode] = useState<"existing" | "new">("existing");
  const [branches, setBranches] = useState<BranchListItem[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [existingBranch, setExistingBranch] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [existingWorktrees, setExistingWorktrees] = useState<GitWorktreeListItem[]>([]);
  const [loadingExistingWorktrees, setLoadingExistingWorktrees] = useState(false);
  const [selectedExistingPath, setSelectedExistingPath] = useState("");
  const [autoOpen, setAutoOpen] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const hasExistingBranches = branches.length > 0;
  const hasExistingWorktrees = existingWorktrees.length > 0;

  const activeBranch = useMemo(() => {
    return branchMode === "existing" ? existingBranch.trim() : newBranch.trim();
  }, [branchMode, existingBranch, newBranch]);

  const targetPathPreview = useMemo(() => {
    if (!sourceProject) {
      return "~/.devhaven/worktrees/<project>/<branch>";
    }
    const branch = activeBranch || "<branch>";
    return `~/.devhaven/worktrees/${sanitizeSegment(resolveNameFromPath(sourceProject.path))}/${branch}`;
  }, [activeBranch, sourceProject]);

  const selectedExistingWorktree = useMemo(
    () => existingWorktrees.find((item) => item.path === selectedExistingPath) ?? null,
    [existingWorktrees, selectedExistingPath],
  );

  const trackedWorktreePaths = useMemo(() => {
    if (!sourceProject) {
      return new Set<string>();
    }
    return new Set((sourceProject.worktrees ?? []).map((item) => item.path));
  }, [sourceProject]);

  useEffect(() => {
    if (!isOpen || !sourceProject) {
      return;
    }
    setMode("create");
    setBranchMode("existing");
    setBranches([]);
    setExistingBranch("");
    setNewBranch("");
    setExistingWorktrees([]);
    setSelectedExistingPath("");
    setAutoOpen(true);
    setError("");
    setSubmitting(false);
  }, [isOpen, sourceProject]);

  useEffect(() => {
    if (!isOpen || !sourceProject) {
      return;
    }
    let canceled = false;

    const run = async () => {
      setLoadingBranches(true);
      try {
        const items = await listBranches(sourceProject.path);
        if (canceled) {
          return;
        }
        setBranches(items);
        const fallbackBranch = items.find((item) => item.isMain)?.name ?? items[0]?.name ?? "";
        setExistingBranch(fallbackBranch);
        if (!fallbackBranch) {
          setBranchMode("new");
        }
      } catch (err) {
        if (canceled) {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setError(message || "读取分支列表失败，请重试");
      } finally {
        if (!canceled) {
          setLoadingBranches(false);
        }
      }
    };

    void run();
    return () => {
      canceled = true;
    };
  }, [isOpen, sourceProject]);

  useEffect(() => {
    if (!isOpen || !sourceProject) {
      return;
    }

    let canceled = false;

    const run = async () => {
      setLoadingExistingWorktrees(true);
      try {
        const items = await gitWorktreeList(sourceProject.path);
        if (canceled) {
          return;
        }
        setExistingWorktrees(items);
        setSelectedExistingPath((prev) => {
          if (prev && items.some((item) => item.path === prev)) {
            return prev;
          }
          return items[0]?.path ?? "";
        });
      } catch (err) {
        if (canceled) {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setError(message || "读取已有 worktree 失败，请重试");
      } finally {
        if (!canceled) {
          setLoadingExistingWorktrees(false);
        }
      }
    };

    void run();
    return () => {
      canceled = true;
    };
  }, [isOpen, sourceProject]);

  if (!isOpen || !sourceProject) {
    return null;
  }

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");

    try {
      if (mode === "create") {
        const trimmedBranch = activeBranch.trim();
        if (!trimmedBranch) {
          setError("分支名不能为空");
          setSubmitting(false);
          return;
        }
        if (branchMode === "existing" && !hasExistingBranches) {
          setError("当前仓库没有可用分支，请改用“新建分支”");
          setSubmitting(false);
          return;
        }
        await onSubmit({
          mode: "create",
          sourceProjectId: sourceProject.id,
          sourceProjectPath: sourceProject.path,
          branch: trimmedBranch,
          createBranch: branchMode === "new",
          autoOpen,
        });
      } else {
        if (!selectedExistingWorktree) {
          setError("请选择要打开的 worktree");
          setSubmitting(false);
          return;
        }
        await onSubmit({
          mode: "open-existing",
          sourceProjectId: sourceProject.id,
          sourceProjectPath: sourceProject.path,
          worktreePath: selectedExistingWorktree.path,
          branch: selectedExistingWorktree.branch,
          autoOpen,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "操作失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay z-[90]" role="dialog" aria-modal>
      <div className="modal-panel w-[680px] max-w-[92vw]">
        <div className="text-[16px] font-semibold">Git worktree</div>

        <label className="flex flex-col gap-1.5 text-[13px] text-secondary-text">
          <span>源项目</span>
          <input className="rounded-md border border-border bg-card-bg px-2 py-2 text-text" value={sourceProject.path} readOnly />
        </label>

        <div className="flex items-center gap-4 rounded-md border border-border bg-card-bg px-3 py-2 text-[13px] text-text">
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" checked={mode === "create"} onChange={() => setMode("create")} />
            新建 worktree
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" checked={mode === "open-existing"} onChange={() => setMode("open-existing")} />
            打开已有 worktree
          </label>
        </div>

        {mode === "create" ? (
          <>
            <div className="flex flex-col gap-2 rounded-md border border-border bg-card-bg p-3">
              <div className="text-[13px] text-secondary-text">分支模式</div>
              <div className="flex items-center gap-4 text-[13px] text-text">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="worktree-branch-mode"
                    checked={branchMode === "existing"}
                    disabled={!hasExistingBranches}
                    onChange={() => setBranchMode("existing")}
                  />
                  已有分支
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="worktree-branch-mode"
                    checked={branchMode === "new"}
                    onChange={() => setBranchMode("new")}
                  />
                  新建分支
                </label>
              </div>

              {branchMode === "existing" ? (
                <label className="flex flex-col gap-1.5 text-[13px] text-secondary-text">
                  <span>选择分支</span>
                  <select
                    className="rounded-md border border-border bg-card-bg px-2 py-2 text-text"
                    value={existingBranch}
                    disabled={loadingBranches || !hasExistingBranches}
                    onChange={(event) => setExistingBranch(event.target.value)}
                  >
                    {hasExistingBranches ? (
                      branches.map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.name}
                          {item.isMain ? "（主分支）" : ""}
                        </option>
                      ))
                    ) : (
                      <option value="">暂无分支</option>
                    )}
                  </select>
                </label>
              ) : (
                <label className="flex flex-col gap-1.5 text-[13px] text-secondary-text">
                  <span>新分支名</span>
                  <input
                    className="rounded-md border border-border bg-card-bg px-2 py-2 text-text"
                    value={newBranch}
                    onChange={(event) => setNewBranch(event.target.value)}
                    placeholder="例如：feature/new-idea"
                  />
                </label>
              )}

              {loadingBranches ? <div className="text-fs-caption text-secondary-text">正在读取分支...</div> : null}
            </div>

            <div className="rounded-md border border-border bg-card-bg px-3 py-2 text-fs-caption text-secondary-text">
              固定目录策略：{targetPathPreview}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-card-bg p-3">
            <label className="flex flex-col gap-1.5 text-[13px] text-secondary-text">
              <span>已有 worktree</span>
              <select
                className="rounded-md border border-border bg-card-bg px-2 py-2 text-text"
                value={selectedExistingPath}
                disabled={loadingExistingWorktrees || !hasExistingWorktrees}
                onChange={(event) => setSelectedExistingPath(event.target.value)}
              >
                {hasExistingWorktrees ? (
                  existingWorktrees.map((item) => (
                    <option key={item.path} value={item.path}>
                      {item.branch} · {item.path}
                    </option>
                  ))
                ) : (
                  <option value="">暂无可用 worktree</option>
                )}
              </select>
            </label>

            {loadingExistingWorktrees ? <div className="text-fs-caption text-secondary-text">正在读取已有 worktree...</div> : null}

            {selectedExistingWorktree ? (
              <div className="rounded-md border border-border px-2.5 py-2 text-fs-caption text-secondary-text">
                分支：{selectedExistingWorktree.branch}
                <br />
                路径：{selectedExistingWorktree.path}
                {trackedWorktreePaths.has(selectedExistingWorktree.path) ? (
                  <>
                    <br />
                    <span>该 worktree 已记录，点击后会直接打开。</span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-md border border-border bg-card-bg p-3 text-[13px] text-text">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={autoOpen} onChange={(event) => setAutoOpen(event.target.checked)} />
            完成后在终端工作区打开
          </label>
        </div>

        {error ? <div className="text-fs-caption text-error">{error}</div> : null}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? "处理中..." : mode === "create" ? "创建" : "添加并打开"}
          </button>
        </div>
      </div>
    </div>
  );
}

function sanitizeSegment(value: string): string {
  const sanitized = value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");
  return sanitized || "project";
}

function resolveNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const last = normalized.split("/").filter(Boolean).pop();
  return last || normalized || path;
}
