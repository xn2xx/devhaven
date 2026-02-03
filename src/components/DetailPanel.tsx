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
      <aside className="detail-panel">
        <div className="detail-empty">请选择一个项目查看详情</div>
      </aside>
    );
  }

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <div>
          <div className="detail-title">{project.name}</div>
          <div className="detail-path" title={project.path}>
            {project.path}
          </div>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="关闭">
          <IconX size={14} />
        </button>
      </div>
      <div className="detail-tabs">
        <button
          className={`tab-button${activeTab === "overview" ? " is-active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          概览
        </button>
        <button
          className={`tab-button${activeTab === "branches" ? " is-active" : ""}`}
          onClick={() => setActiveTab("branches")}
        >
          分支
        </button>
      </div>
      {activeTab === "overview" ? (
        <div className="detail-content">
          <section className="detail-section">
            <div className="detail-section-title">基础信息</div>
            <div className="detail-grid">
              <div>最近修改</div>
              <div>{formatDate(project.mtime)}</div>
              <div>Git 提交</div>
              <div>{project.git_commits > 0 ? `${project.git_commits} 次` : "非 Git"}</div>
              <div>最后检查</div>
              <div>{formatDate(project.checked)}</div>
            </div>
          </section>

          <section className="detail-section">
            <div className="detail-section-title">标签</div>
            <div className="detail-tags">
              {projectTags.map((tag) => (
                <span
                  key={tag}
                  className="tag-pill"
                  style={{ background: `${getTagColor(tag)}33`, color: getTagColor(tag) }}
                >
                  {tag}
                  <button
                    className="tag-remove"
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
                className="detail-select"
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
              <div className="detail-muted">暂无可添加标签</div>
            )}
          </section>

          <section className="detail-section">
            <div className="detail-section-title">脚本</div>
            <div className="script-toolbar">
              <div className="script-toolbar-left">
                <IconTerminal size={14} />
                <select
                  className="detail-select script-select"
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
              <div className="script-toolbar-actions">
                {activeScript ? (
                  runningScript && runningScript.id === activeScript.id ? (
                    <button
                      className="button button-danger"
                      onClick={() => onStopProjectScript(project, activeScript)}
                    >
                      停止
                    </button>
                  ) : (
                    <button
                      className="button button-primary"
                      onClick={() => onRunProjectScript(project, activeScript)}
                    >
                      运行
                    </button>
                  )
                ) : (
                  <button className="button button-primary" disabled>
                    运行
                  </button>
                )}
                <button className="button" onClick={() => setScriptDialogState({ mode: "new" })}>
                  新增
                </button>
              </div>
            </div>
            <div className={"script-status" + (runningScript ? " is-running" : "")}>
              {runningScript ? "运行中：" + runningScript.name : "未运行"}
            </div>
            {projectScripts.length === 0 ? (
              <div className="detail-muted">暂无脚本配置</div>
            ) : (
              <div className="script-list">
                {projectScripts.map((script, index) => {
                  const isRunning = runningScript?.id === script.id;
                  return (
                    <div key={script.id} className="script-item">
                      <div className="script-item-info">
                        <div className="script-item-title">{script.name}</div>
                        <div className="script-item-command" title={script.start}>
                          {script.start}
                        </div>
                      </div>
                      <div className="script-item-actions">
                        <button
                          className={"button" + (isRunning ? " button-danger" : " button-primary")}
                          onClick={() =>
                            isRunning
                              ? onStopProjectScript(project, script)
                              : onRunProjectScript(project, script)
                          }
                        >
                          {isRunning ? "停止" : "运行"}
                        </button>
                        <button
                          className="button button-outline"
                          onClick={() => setScriptDialogState({ mode: "edit", script })}
                        >
                          编辑
                        </button>
                        <button
                          className="button button-danger"
                          onClick={() => void handleDeleteScript(script.id)}
                        >
                          删除
                        </button>
                        <div className="script-item-sort">
                          <button
                            className="icon-button"
                            aria-label={"上移 " + script.name}
                            onClick={() => void handleMoveScript(index, -1)}
                            disabled={index === 0}
                          >
                            <IconArrowUpCircle size={14} />
                          </button>
                          <button
                            className="icon-button"
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

          <section className="detail-section">
            <div className="detail-section-title">备注</div>
            <textarea
              className="detail-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="记录项目备注"
            />
          </section>

          <section className="detail-section">
            <div className="detail-section-title">Markdown</div>
            <ProjectMarkdownSection project={project} />
          </section>

        </div>
      ) : (
        <div className="detail-content">
          <section className="detail-section">
            <div className="detail-section-title">分支管理</div>
            <div className="detail-actions">
              <button className="button" onClick={() => void refreshWorktrees(project.path)}>
                刷新
              </button>
            </div>
            {worktreeError ? <div className="detail-error">{worktreeError}</div> : null}
            {branches.length === 0 ? (
              <div className="detail-muted">暂无分支信息或非 Git 项目</div>
            ) : (
              <div className="branch-list">
                {branches.map((branch) => (
                  <div key={branch.name} className="branch-card">
                    <div>
                      <div className="branch-name">
                        {branch.name}
                        {branch.isMain ? <span className="branch-main">主分支</span> : null}
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
