import { useEffect, useMemo, useState } from "react";

import type { BranchListItem } from "../../models/branch";
import type { Project } from "../../models/types";
import { listBranches } from "../../services/git";
import { gitWorktreeList, type GitWorktreeListItem } from "../../services/gitWorktree";
import type { WorktreeInitStep } from "../../services/worktreeInit";
import { copyToClipboard } from "../../services/system";

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

export type WorktreeCreateSubmitResult =
  | {
      mode: "create";
      jobId: string;
      worktreePath: string;
      branch: string;
    }
  | {
      mode: "open-existing";
    };

type WorktreeCreateDialogProps = {
  isOpen: boolean;
  sourceProject: Project | null;
  onClose: () => void;
  onSubmit: (payload: WorktreeCreateSubmitPayload) => Promise<WorktreeCreateSubmitResult>;
};

const INIT_STEP_META: Array<{ step: WorktreeInitStep; label: string; summary: string }> = [
  { step: "pending", label: "准备任务", summary: "进入后台队列" },
  { step: "validating", label: "校验仓库", summary: "检查路径与仓库状态" },
  { step: "checking_branch", label: "校验分支", summary: "确认分支可用性" },
  { step: "creating_worktree", label: "创建目录", summary: "执行 git worktree add" },
  { step: "syncing", label: "同步状态", summary: "回写并刷新工作区" },
  { step: "ready", label: "创建完成", summary: "可在终端中打开" },
];

type InitTracker = {
  jobId: string;
  worktreePath: string;
  branch: string;
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
  const [copyingDiagnostic, setCopyingDiagnostic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeInit, setActiveInit] = useState<InitTracker | null>(null);

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

  const trackedInitWorktree = useMemo(() => {
    if (!sourceProject || !activeInit) {
      return null;
    }
    const normalizedActivePath = normalizePathForCompare(activeInit.worktreePath);
    return (
      (sourceProject.worktrees ?? []).find(
        (item) =>
          item.initJobId === activeInit.jobId ||
          normalizePathForCompare(item.path) === normalizedActivePath,
      ) ?? null
    );
  }, [activeInit, sourceProject]);

  const initStatus = trackedInitWorktree?.status;
  const currentInitStep: WorktreeInitStep = trackedInitWorktree?.initStep ?? "pending";
  const isInitRunning = initStatus === "creating";
  const hasInitFailed = currentInitStep === "failed" || currentInitStep === "cancelled";

  const initError = useMemo(() => {
    if (!trackedInitWorktree) {
      return "";
    }
    if (trackedInitWorktree.initError) {
      return trackedInitWorktree.initError;
    }
    if (hasInitFailed) {
      return trackedInitWorktree.initMessage || "初始化失败";
    }
    return "";
  }, [hasInitFailed, trackedInitWorktree]);

  const initMessage = trackedInitWorktree?.initMessage || (activeInit ? "等待任务启动..." : "");

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
    setCopyingDiagnostic(false);
    setSubmitting(false);
    setActiveInit(null);
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
    if (mode === "create" && isInitRunning) {
      return;
    }

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
        const result = await onSubmit({
          mode: "create",
          sourceProjectId: sourceProject.id,
          sourceProjectPath: sourceProject.path,
          branch: trimmedBranch,
          createBranch: branchMode === "new",
          autoOpen,
        });
        if (result.mode === "create") {
          setActiveInit({
            jobId: result.jobId,
            worktreePath: result.worktreePath,
            branch: result.branch,
          });
        }
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

  const renderStepState = (step: WorktreeInitStep) => {
    if (!activeInit) {
      return { status: "pending" as const, marker: "○", className: "text-secondary-text" };
    }

    if (hasInitFailed) {
      if (step === currentInitStep || step === "ready") {
        return { status: "failed" as const, marker: "✕", className: "text-error" };
      }
      const failedIndex = INIT_STEP_META.findIndex((item) => item.step === currentInitStep);
      const index = INIT_STEP_META.findIndex((item) => item.step === step);
      if (failedIndex >= 0 && index >= 0 && index < failedIndex) {
        return { status: "done" as const, marker: "✓", className: "text-text" };
      }
      return { status: "pending" as const, marker: "○", className: "text-secondary-text" };
    }

    const currentIndex = INIT_STEP_META.findIndex((item) => item.step === currentInitStep);
    const index = INIT_STEP_META.findIndex((item) => item.step === step);
    if (currentIndex >= 0 && index < currentIndex) {
      return { status: "done" as const, marker: "✓", className: "text-text" };
    }
    if (currentIndex >= 0 && index === currentIndex) {
      return { status: "current" as const, marker: "●", className: "text-text" };
    }
    return { status: "pending" as const, marker: "○", className: "text-secondary-text" };
  };

  const handleCopyDiagnostic = async () => {
    if (!activeInit || !trackedInitWorktree) {
      return;
    }

    const content = [
      "[Worktree Init Diagnostic]",
      `projectPath=${sourceProject.path}`,
      `jobId=${activeInit.jobId}`,
      `worktreePath=${activeInit.worktreePath}`,
      `branch=${activeInit.branch}`,
      `step=${currentInitStep}`,
      `status=${trackedInitWorktree.status ?? "unknown"}`,
      `message=${trackedInitWorktree.initMessage ?? ""}`,
      `error=${trackedInitWorktree.initError ?? ""}`,
      `updatedAt=${trackedInitWorktree.updatedAt ?? ""}`,
    ].join("\n");

    setCopyingDiagnostic(true);
    try {
      await copyToClipboard(content);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "复制诊断信息失败");
    } finally {
      setCopyingDiagnostic(false);
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
            <input
              type="radio"
              checked={mode === "create"}
              disabled={isInitRunning}
              onChange={() => setMode("create")}
            />
            新建 worktree
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="radio"
              checked={mode === "open-existing"}
              disabled={isInitRunning}
              onChange={() => setMode("open-existing")}
            />
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
                    disabled={!hasExistingBranches || isInitRunning}
                    onChange={() => setBranchMode("existing")}
                  />
                  已有分支
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="worktree-branch-mode"
                    checked={branchMode === "new"}
                    disabled={isInitRunning}
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
                    disabled={loadingBranches || !hasExistingBranches || isInitRunning}
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
                    disabled={isInitRunning}
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

            <div className="flex flex-col gap-2 rounded-md border border-border bg-card-bg p-3">
              <div className="text-[13px] text-secondary-text">初始化进度</div>
              {activeInit ? (
                <div className="rounded-md border border-border px-2.5 py-2 text-fs-caption text-secondary-text">
                  分支：{activeInit.branch}
                  <br />
                  路径：{activeInit.worktreePath}
                </div>
              ) : (
                <div className="text-fs-caption text-secondary-text">提交后会实时展示后台初始化步骤，可随时关闭弹窗。</div>
              )}
              <div className="grid gap-1">
                {INIT_STEP_META.map((item) => {
                  const state = renderStepState(item.step);
                  return (
                    <div
                      key={item.step}
                      className={`flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-fs-caption ${state.className}`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span>{state.marker}</span>
                        <span>{item.label}</span>
                      </span>
                      <span className="opacity-80">{item.summary}</span>
                    </div>
                  );
                })}
              </div>
              {activeInit ? (
                <div className="rounded-md border border-border px-2.5 py-2 text-fs-caption text-secondary-text">
                  当前状态：{initMessage || "等待后台任务反馈"}
                </div>
              ) : null}
              {hasInitFailed ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-2.5 py-2 text-fs-caption text-error">
                  <span className="min-w-0 flex-1 truncate">{initError || "初始化失败"}</span>
                  <button
                    type="button"
                    className="btn"
                    disabled={copyingDiagnostic}
                    onClick={() => void handleCopyDiagnostic()}
                  >
                    {copyingDiagnostic ? "复制中..." : "复制诊断"}
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-card-bg p-3">
            <label className="flex flex-col gap-1.5 text-[13px] text-secondary-text">
              <span>已有 worktree</span>
              <select
                className="rounded-md border border-border bg-card-bg px-2 py-2 text-text"
                value={selectedExistingPath}
                disabled={loadingExistingWorktrees || !hasExistingWorktrees || isInitRunning}
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
            <input
              type="checkbox"
              checked={autoOpen}
              disabled={isInitRunning}
              onChange={(event) => setAutoOpen(event.target.checked)}
            />
            完成后在终端工作区打开
          </label>
        </div>

        {error ? <div className="text-fs-caption text-error">{error}</div> : null}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSubmit()}
            disabled={submitting || (mode === "create" && isInitRunning)}
          >
            {submitting
              ? "处理中..."
              : mode === "create"
                ? isInitRunning
                  ? "初始化中..."
                  : currentInitStep === "ready"
                    ? "再创建一个"
                    : "创建"
                : "添加并打开"}
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

function normalizePathForCompare(path: string): string {
  const normalized = path.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return normalized.toLowerCase();
}
