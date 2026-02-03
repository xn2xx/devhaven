import { useEffect, useMemo, useRef, useState } from "react";

import type { Project, ProjectScript, TagData } from "../models/types";
import type { BranchListItem } from "../models/branch";
import { swiftDateToJsDate } from "../models/types";
import { readProjectNotes, writeProjectNotes } from "../services/notes";
import { listBranches } from "../services/git";
import { IconArrowDownCircle, IconArrowUpCircle, IconTerminal, IconX } from "./Icons";
import ProjectMarkdownSection from "./ProjectMarkdownSection";
import ProjectScriptDialog from "./ProjectScriptDialog";

export type DetailPanelProps = {
  project: Project | null;
  tags: TagData[];
  onClose: () => void;
  onAddTagToProject: (projectId: string, tag: string) => Promise<void>;
  onRemoveTagFromProject: (projectId: string, tag: string) => Promise<void>;
  getTagColor: (tag: string) => string;
  runningScriptId?: string | null;
  onUpdateProjectScripts: (projectId: string, scripts: ProjectScript[]) => Promise<void>;
  onRunProjectScript: (project: Project, script: ProjectScript) => void;
  onStopProjectScript: (project: Project, script: ProjectScript) => void;
};

type DetailTab = "overview" | "branches";

type ScriptDialogState = { mode: "new" | "edit"; script?: ProjectScript } | null;

const createScriptId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "script_" + Date.now() + "_" + Math.random().toString(16).slice(2);
};

/** 格式化 Swift 时间戳为中文时间。 */
const formatDate = (swiftDate: number) => {
  if (!swiftDate) {
    return "--";
  }
  const date = swiftDateToJsDate(swiftDate);
  return date.toLocaleString("zh-CN");
};

/** 右侧详情面板，负责项目详情、备注与分支管理。 */
export default function DetailPanel({
  project,
  tags,
  onClose,
  onAddTagToProject,
  onRemoveTagFromProject,
  getTagColor,
  runningScriptId,
  onUpdateProjectScripts,
  onRunProjectScript,
  onStopProjectScript,
}: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [notes, setNotes] = useState("");
  const [notesSnapshot, setNotesSnapshot] = useState("");
  const [branches, setBranches] = useState<BranchListItem[]>([]);
  const [worktreeError, setWorktreeError] = useState<string | null>(null);
  const [activeScriptId, setActiveScriptId] = useState<string>("");
  const [scriptDialogState, setScriptDialogState] = useState<ScriptDialogState>(null);

  const saveTimer = useRef<number | null>(null);

  const projectTags = useMemo(() => project?.tags ?? [], [project]);
  const projectScripts = useMemo(() => project?.scripts ?? [], [project]);
  const availableTags = useMemo(
    () => tags.filter((tag) => !projectTags.includes(tag.name)),
    [tags, projectTags],
  );

  const activeScript = useMemo(
    () => projectScripts.find((script) => script.id === activeScriptId) ?? projectScripts[0] ?? null,
    [activeScriptId, projectScripts],
  );
  const runningScript = useMemo(
    () => (runningScriptId ? projectScripts.find((script) => script.id === runningScriptId) ?? null : null),
    [projectScripts, runningScriptId],
  );

  useEffect(() => {
    if (!project) {
      return;
    }
    let cancelled = false;
    setNotes("");
    setNotesSnapshot("");
    readProjectNotes(project.path)
      .then((value) => {
        if (cancelled) {
          return;
        }
        const resolved = value ?? "";
        setNotes(resolved);
        setNotesSnapshot(resolved);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setNotes("");
        setNotesSnapshot("");
      });
    return () => {
      cancelled = true;
    };
  }, [project?.id]);

  useEffect(() => {
    if (!project) {
      setActiveScriptId("");
      setScriptDialogState(null);
      return;
    }
    if (projectScripts.length === 0) {
      setActiveScriptId("");
      return;
    }
    setActiveScriptId((prev) =>
      projectScripts.some((script) => script.id === prev) ? prev : projectScripts[0].id,
    );
  }, [project, projectScripts]);

  useEffect(() => {
    if (!project) {
      return;
    }
    if (notes === notesSnapshot) {
      return;
    }
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    saveTimer.current = window.setTimeout(() => {
      const trimmed = notes.trim();
      void writeProjectNotes(project.path, trimmed ? trimmed : null);
      setNotesSnapshot(notes);
    }, 800);
  }, [notes, notesSnapshot, project]);

  useEffect(() => {
    if (!project || activeTab !== "branches") {
      return;
    }
    void refreshWorktrees(project.path);
  }, [project?.id, activeTab]);

  /** 读取当前项目的分支列表。 */
  const refreshWorktrees = async (path: string) => {
    try {
      const list = await listBranches(path);
      setBranches(list);
      setWorktreeError(null);
    } catch (error) {
      setWorktreeError(error instanceof Error ? error.message : String(error));
    }
  };

  /** 为项目添加标签。 */
  const handleAddTag = async (tagName: string) => {
    if (!project) {
      return;
    }
    await onAddTagToProject(project.id, tagName);
  };

  /** 从项目移除标签。 */
  const handleRemoveTag = async (tagName: string) => {
    if (!project) {
      return;
    }
    await onRemoveTagFromProject(project.id, tagName);
  };

  const handleSubmitScript = async (value: { name: string; start: string; stop?: string | null }) => {
    if (!project) {
      return;
    }
    const nextScripts = projectScripts.slice();
    if (scriptDialogState?.mode === "edit" && scriptDialogState.script) {
      const index = nextScripts.findIndex((script) => script.id === scriptDialogState.script?.id);
      if (index >= 0) {
        nextScripts[index] = {
          ...nextScripts[index],
          name: value.name,
          start: value.start,
          stop: value.stop ?? null,
        };
      }
    } else {
      const id = createScriptId();
      nextScripts.push({
        id,
        name: value.name,
        start: value.start,
        stop: value.stop ?? null,
      });
      setActiveScriptId(id);
    }
    await onUpdateProjectScripts(project.id, nextScripts);
    setScriptDialogState(null);
  };

  const handleDeleteScript = async (scriptId: string) => {
    if (!project) {
      return;
    }
    const nextScripts = projectScripts.filter((script) => script.id !== scriptId);
    await onUpdateProjectScripts(project.id, nextScripts);
    if (activeScriptId === scriptId) {
      setActiveScriptId(nextScripts[0]?.id ?? "");
    }
  };

  const handleMoveScript = async (index: number, offset: number) => {
    if (!project) {
      return;
    }
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= projectScripts.length) {
      return;
    }
    const nextScripts = projectScripts.slice();
    const [target] = nextScripts.splice(index, 1);
    nextScripts.splice(nextIndex, 0, target);
    await onUpdateProjectScripts(project.id, nextScripts);
  };

  if (!project) {
    return (
      <aside className="flex min-w-detail max-w-detail flex-col border-l border-divider bg-background pb-4 overflow-hidden">
        <div className="p-4 text-secondary-text">请选择一个项目查看详情</div>
      </aside>
    );
  }

  return (
    <aside className="flex min-w-detail max-w-detail flex-col border-l border-divider bg-background pb-4 overflow-hidden">
      <div className="flex items-center justify-between border-b border-divider bg-secondary-background p-4">
        <div>
          <div className="text-[16px] font-semibold">{project.name}</div>
          <div className="max-w-[320px] truncate text-fs-caption text-secondary-text" title={project.path}>
            {project.path}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="关闭">
          <IconX size={14} />
        </button>
      </div>
      <div className="flex gap-2 border-b border-divider px-4 py-2">
        <button
          className={`rounded-lg px-3 py-1.5 ${
            activeTab === "overview" ? "bg-[rgba(69,59,231,0.2)] text-text" : "text-secondary-text"
          }`}
          onClick={() => setActiveTab("overview")}
        >
          概览
        </button>
        <button
          className={`rounded-lg px-3 py-1.5 ${
            activeTab === "branches" ? "bg-[rgba(69,59,231,0.2)] text-text" : "text-secondary-text"
          }`}
          onClick={() => setActiveTab("branches")}
        >
          分支
        </button>
      </div>
      {activeTab === "overview" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <section className="flex flex-col gap-2.5">
            <div className="text-[14px] font-semibold">基础信息</div>
            <div className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 text-fs-caption text-secondary-text">
              <div>最近修改</div>
              <div>{formatDate(project.mtime)}</div>
              <div>Git 提交</div>
              <div>{project.git_commits > 0 ? `${project.git_commits} 次` : "非 Git"}</div>
              <div>最后检查</div>
              <div>{formatDate(project.checked)}</div>
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="text-[14px] font-semibold">标签</div>
            <div className="flex flex-wrap gap-1.5">
              {projectTags.map((tag) => (
                <span
                  key={tag}
                  className="tag-pill"
                  style={{ background: `${getTagColor(tag)}33`, color: getTagColor(tag) }}
                >
                  {tag}
                  <button
                    className="ml-1.5 inline-flex items-center justify-center text-[12px] opacity-60 hover:opacity-100"
                    onClick={() => void handleRemoveTag(tag)}
                    aria-label={`移除标签 ${tag}`}
                  >
                    <IconX size={12} />
                  </button>
                </span>
              ))}
            </div>
            {availableTags.length > 0 ? (
              <select
                className="rounded-md border border-border bg-card-bg px-2 py-2 text-text"
                onChange={(event) => {
                  const value = event.target.value;
                  if (value) {
                    void handleAddTag(value);
                  }
                }}
                defaultValue=""
              >
                <option value="">添加标签...</option>
                {availableTags.map((tag) => (
                  <option key={tag.name} value={tag.name}>
                    {tag.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-fs-caption text-secondary-text">暂无可添加标签</div>
            )}
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="text-[14px] font-semibold">脚本</div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-secondary-text">
                <IconTerminal size={14} />
                <select
                  className="flex-1 min-w-0 rounded-md border border-border bg-card-bg px-2 py-2 text-text"
                  value={activeScript?.id ?? ""}
                  onChange={(event) => setActiveScriptId(event.target.value)}
                  disabled={projectScripts.length === 0}
                >
                  <option value="">选择脚本...</option>
                  {projectScripts.map((script) => (
                    <option key={script.id} value={script.id}>
                      {script.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeScript ? (
                  runningScript && runningScript.id === activeScript.id ? (
                    <button
                      className="btn btn-danger"
                      onClick={() => onStopProjectScript(project, activeScript)}
                    >
                      停止
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => onRunProjectScript(project, activeScript)}
                    >
                      运行
                    </button>
                  )
                ) : (
                  <button className="btn btn-primary" disabled>
                    运行
                  </button>
                )}
                <button className="btn" onClick={() => setScriptDialogState({ mode: "new" })}>
                  新增
                </button>
              </div>
            </div>
            <div className={`text-fs-caption ${runningScript ? "text-success" : "text-secondary-text"}`}>
              {runningScript ? "运行中：" + runningScript.name : "未运行"}
            </div>
            {projectScripts.length === 0 ? (
              <div className="text-fs-caption text-secondary-text">暂无脚本配置</div>
            ) : (
              <div className="flex flex-col gap-2">
                {projectScripts.map((script, index) => {
                  const isRunning = runningScript?.id === script.id;
                  return (
                    <div
                      key={script.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary-background px-3 py-2.5"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="text-[13px] font-semibold text-text">{script.name}</div>
                        <div className="truncate text-fs-caption text-secondary-text" title={script.start}>
                          {script.start}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          className={`btn ${isRunning ? "btn-danger" : "btn-primary"}`}
                          onClick={() =>
                            isRunning
                              ? onStopProjectScript(project, script)
                              : onRunProjectScript(project, script)
                          }
                        >
                          {isRunning ? "停止" : "运行"}
                        </button>
                        <button
                          className="btn btn-outline"
                          onClick={() => setScriptDialogState({ mode: "edit", script })}
                        >
                          编辑
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => void handleDeleteScript(script.id)}
                        >
                          删除
                        </button>
                        <div className="flex gap-1">
                          <button
                            className="icon-btn disabled:opacity-40"
                            aria-label={"上移 " + script.name}
                            onClick={() => void handleMoveScript(index, -1)}
                            disabled={index === 0}
                          >
                            <IconArrowUpCircle size={14} />
                          </button>
                          <button
                            className="icon-btn disabled:opacity-40"
                            aria-label={"下移 " + script.name}
                            onClick={() => void handleMoveScript(index, 1)}
                            disabled={index === projectScripts.length - 1}
                          >
                            <IconArrowDownCircle size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="text-[14px] font-semibold">备注</div>
            <textarea
              className="min-h-[120px] resize-y rounded-md border border-border bg-card-bg px-2 py-2 text-text focus:outline-2 focus:outline-accent focus:outline-offset-[-1px]"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="记录项目备注"
            />
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="text-[14px] font-semibold">Markdown</div>
            <ProjectMarkdownSection project={project} />
          </section>

        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <section className="flex flex-col gap-2.5">
            <div className="text-[14px] font-semibold">分支管理</div>
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={() => void refreshWorktrees(project.path)}>
                刷新
              </button>
            </div>
            {worktreeError ? <div className="text-fs-caption text-error">{worktreeError}</div> : null}
            {branches.length === 0 ? (
              <div className="text-fs-caption text-secondary-text">暂无分支信息或非 Git 项目</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {branches.map((branch) => (
                  <div key={branch.name} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card-bg p-3">
                    <div>
                      <div className="text-[14px] font-semibold">
                        {branch.name}
                        {branch.isMain ? <span className="ml-1.5 text-[11px] text-accent">主分支</span> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      {scriptDialogState ? (
        <ProjectScriptDialog
          title={scriptDialogState.mode === "edit" ? "编辑脚本" : "新增脚本"}
          isOpen={Boolean(scriptDialogState)}
          initialName={scriptDialogState.script?.name}
          initialStart={scriptDialogState.script?.start}
          initialStop={scriptDialogState.script?.stop}
          onClose={() => setScriptDialogState(null)}
          onSubmit={(value) => void handleSubmitScript(value)}
        />
      ) : null}
    </aside>
  );
}
