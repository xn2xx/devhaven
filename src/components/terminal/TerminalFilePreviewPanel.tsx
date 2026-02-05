import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

import type { FsFailureReason } from "../../models/filesystem";
import { readProjectFile, writeProjectFile } from "../../services/filesystem";
import { copyToClipboard } from "../../services/system";
import { detectLanguage } from "../../utils/detectLanguage";
import { isMarkdownFile } from "../../utils/fileTypes";
import { IconCopy, IconX } from "../Icons";

const TerminalMonacoEditor = lazy(() => import("./TerminalMonacoEditor"));

type FilePreviewState = {
  loading: boolean;
  content: string | null;
  reason?: FsFailureReason | null;
  message?: string | null;
  size?: number;
  maxSize?: number;
};

export type TerminalFilePreviewPanelProps = {
  projectPath: string;
  relativePath: string;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

function formatFailure(reason?: FsFailureReason | null, message?: string | null) {
  if (message) {
    return message;
  }
  switch (reason) {
    case "binary":
      return "无法预览：二进制或非 UTF-8 文件";
    case "too-large":
      return "无法预览：文件过大";
    case "outside-project":
      return "读取被拒绝：路径越界";
    case "symlink-escape":
      return "读取被拒绝：符号链接路径";
    case "not-found":
      return "读取失败：文件或目录不存在";
    case "not-a-directory":
      return "读取失败：不是目录";
    case "not-a-file":
      return "读取失败：不是文件";
    case "invalid-path":
      return "读取失败：路径无效";
    case "io-error":
      return "读取失败：IO 错误";
    default:
      return "读取失败";
  }
}

function getFileName(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

export default function TerminalFilePreviewPanel({
  projectPath,
  relativePath,
  onClose,
  onDirtyChange,
}: TerminalFilePreviewPanelProps) {
  const [preview, setPreview] = useState<FilePreviewState>({ loading: false, content: null });
  const requestIdRef = useRef(0);
  const originalContentRef = useRef<string>("");
  const activeFileRef = useRef<{ projectPath: string; relativePath: string }>({ projectPath, relativePath });

  const [viewMode, setViewMode] = useState<"rendered" | "raw">("raw");
  const [draftContent, setDraftContent] = useState("");
  const draftContentRef = useRef(draftContent);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(dirty);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(saving);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const saveMessageTimerRef = useRef<number | null>(null);
  const lastAutoSaveContentRef = useRef<string | null>(null);
  const saveRequestIdRef = useRef(0);

  const isMarkdown = useMemo(() => isMarkdownFile(relativePath), [relativePath]);
  const language = useMemo(() => detectLanguage(relativePath), [relativePath]);

  useEffect(() => {
    activeFileRef.current = { projectPath, relativePath };
  }, [projectPath, relativePath]);

  useEffect(() => {
    draftContentRef.current = draftContent;
  }, [draftContent]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setPreview({ loading: true, content: null });
    setSaveMessage(null);
    if (saveMessageTimerRef.current !== null) {
      window.clearTimeout(saveMessageTimerRef.current);
      saveMessageTimerRef.current = null;
    }
    readProjectFile(projectPath, relativePath)
      .then((response) => {
        if (requestIdRef.current !== requestId) {
          return;
        }
        if (!response.ok) {
          setPreview({
            loading: false,
            content: null,
            reason: response.reason ?? null,
            message: response.message ?? null,
            size: response.size,
            maxSize: response.maxSize,
          });
          originalContentRef.current = "";
          setDraftContent("");
          setDirty(false);
          return;
        }
        const nextContent = response.content ?? "";
        setPreview({
          loading: false,
          content: nextContent,
          size: response.size,
          maxSize: response.maxSize,
        });
        originalContentRef.current = nextContent;
        setDraftContent(nextContent);
        setDirty(false);
        // Default to editable mode; markdown still supports switching to rendered preview.
        setViewMode("raw");
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) {
          return;
        }
        setPreview({ loading: false, content: null, reason: "io-error", message: String(err) });
        originalContentRef.current = "";
        setDraftContent("");
        setDirty(false);
      });
  }, [projectPath, relativePath]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    return () => {
      if (saveMessageTimerRef.current !== null) {
        window.clearTimeout(saveMessageTimerRef.current);
        saveMessageTimerRef.current = null;
      }
    };
  }, []);

  const fileName = useMemo(() => getFileName(relativePath), [relativePath]);
  const canEdit = preview.content !== null;

  const renderedMarkdown = useMemo(() => {
    if (!isMarkdown || preview.content === null) {
      return "";
    }
    const result = marked.parse(draftContent);
    const html = typeof result === "string" ? result : "";
    return DOMPurify.sanitize(html);
  }, [draftContent, isMarkdown, preview.content]);

  const showSaveMessage = useCallback((message: string) => {
    setSaveMessage(message);
    if (saveMessageTimerRef.current !== null) {
      window.clearTimeout(saveMessageTimerRef.current);
    }
    saveMessageTimerRef.current = window.setTimeout(() => {
      saveMessageTimerRef.current = null;
      setSaveMessage(null);
    }, 1600);
  }, []);

  const handleDraftChange = useCallback((next: string) => {
    setDraftContent(next);
    setDirty(next !== originalContentRef.current);
  }, []);

  const resetDraft = useCallback(() => {
    const original = originalContentRef.current;
    setDraftContent(original);
    setDirty(false);
  }, []);

  const saveContent = useCallback(async (contentToSave: string, mode: "auto" | "manual") => {
    if (!canEdit || savingRef.current) {
      return;
    }
    const saveId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = saveId;
    setSaving(true);
    try {
      const fileAtStart = { projectPath, relativePath };
      const response = await writeProjectFile(fileAtStart.projectPath, fileAtStart.relativePath, contentToSave);
      const currentFile = activeFileRef.current;
      if (currentFile.projectPath !== fileAtStart.projectPath || currentFile.relativePath !== fileAtStart.relativePath) {
        return;
      }
      if (saveRequestIdRef.current !== saveId) {
        return;
      }
      if (!response.ok) {
        if (mode === "manual") {
          showSaveMessage(`保存失败：${formatFailure(response.reason ?? null, response.message ?? null)}`);
        } else {
          showSaveMessage(`自动保存失败：${formatFailure(response.reason ?? null, response.message ?? null)}`);
        }
        return;
      }
      // Only mark clean if the draft hasn't moved on since we triggered this save.
      if (draftContentRef.current === contentToSave) {
        originalContentRef.current = contentToSave;
        setDirty(false);
      }
      if (mode === "manual") {
        showSaveMessage("已保存");
      }
    } catch (err) {
      if (mode === "manual") {
        showSaveMessage(`保存失败：${String(err)}`);
      } else {
        showSaveMessage(`自动保存失败：${String(err)}`);
      }
    } finally {
      if (saveRequestIdRef.current === saveId) {
        setSaving(false);
      }
    }
  }, [canEdit, projectPath, relativePath, showSaveMessage]);

  useEffect(() => {
    if (!dirty || !canEdit) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (savingRef.current || !dirtyRef.current) {
        return;
      }
      // Avoid infinite retries when save fails; retry only after user changes content again.
      if (lastAutoSaveContentRef.current === draftContent) {
        return;
      }
      lastAutoSaveContentRef.current = draftContent;
      void saveContent(draftContent, "auto");
    }, 800);
    return () => window.clearTimeout(timer);
  }, [canEdit, dirty, draftContent, saving, saveContent]);

  const handleManualSave = useCallback(() => {
    void saveContent(draftContent, "manual");
  }, [draftContent, saveContent]);

  return (
    <aside className="flex min-h-0 w-[520px] flex-col border-l border-[var(--terminal-divider)] bg-[var(--terminal-panel-bg)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--terminal-divider)] px-3 py-2">
        <div
          className="min-w-0 truncate text-[11px] font-semibold text-[var(--terminal-muted-fg)]"
          title={relativePath}
        >
          {fileName}
          {dirty ? <span className="ml-2 text-[10px] text-[var(--terminal-accent)]">未保存</span> : null}
          {saving ? <span className="ml-2 text-[10px] text-[var(--terminal-muted-fg)]">保存中...</span> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isMarkdown && preview.content !== null ? (
            <div className="mr-1 inline-flex overflow-hidden rounded-md border border-[var(--terminal-divider)] bg-[var(--terminal-bg)]">
              <button
                type="button"
                className={`px-2 py-1 text-[11px] font-semibold transition-colors ${
                  viewMode === "rendered"
                    ? "bg-[var(--terminal-hover-bg)] text-[var(--terminal-fg)]"
                    : "text-[var(--terminal-muted-fg)] hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)]"
                }`}
                onClick={() => setViewMode("rendered")}
              >
                预览
              </button>
              <button
                type="button"
                className={`px-2 py-1 text-[11px] font-semibold transition-colors ${
                  viewMode === "raw"
                    ? "bg-[var(--terminal-hover-bg)] text-[var(--terminal-fg)]"
                    : "text-[var(--terminal-muted-fg)] hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)]"
                }`}
                onClick={() => setViewMode("raw")}
              >
                源码
              </button>
            </div>
          ) : null}

          {preview.content !== null ? (
            <>
              <button
                type="button"
                className="inline-flex h-6 items-center justify-center rounded-md border border-[var(--terminal-divider)] bg-transparent px-2 text-[11px] font-semibold text-[var(--terminal-muted-fg)] transition-colors hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)] disabled:cursor-not-allowed disabled:opacity-50"
                title="撤销修改"
                disabled={!dirty || saving}
                onClick={resetDraft}
              >
                撤销
              </button>
              <button
                type="button"
                className="inline-flex h-6 items-center justify-center rounded-md border border-[var(--terminal-divider)] bg-[var(--terminal-hover-bg)] px-2 text-[11px] font-semibold text-[var(--terminal-muted-fg)] transition-colors hover:text-[var(--terminal-fg)] disabled:cursor-not-allowed disabled:opacity-50"
                title="立即保存（⌘/Ctrl+S）"
                disabled={!dirty || saving}
                onClick={handleManualSave}
              >
                {saving ? "保存中" : "保存"}
              </button>
            </>
          ) : null}

          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--terminal-muted-fg)] transition-colors hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--terminal-accent-outline)] focus-visible:outline-offset-2"
            aria-label="复制相对路径"
            title="复制相对路径"
            onClick={() => copyToClipboard(relativePath)}
          >
            <IconCopy size={14} />
          </button>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--terminal-muted-fg)] transition-colors hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--terminal-accent-outline)] focus-visible:outline-offset-2"
            aria-label="关闭预览"
            title="关闭预览"
            onClick={() => {
              if (dirty && !window.confirm("当前文件有未保存修改，确定关闭预览？")) {
                return;
              }
              onClose();
            }}
          >
            <IconX size={14} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[var(--terminal-bg)] p-3">
        {preview.loading ? (
          <div className="text-[12px] text-[var(--terminal-muted-fg)]">正在读取文件...</div>
        ) : preview.content !== null ? (
          <div className="flex h-full min-h-0 flex-col">
            {saveMessage ? (
              <div className="mb-2 text-[11px] font-semibold text-[var(--terminal-muted-fg)]">{saveMessage}</div>
            ) : null}

            {isMarkdown && viewMode === "rendered" ? (
              <div
                className="markdown-content select-text text-[12px] leading-6 text-[var(--terminal-fg)]"
                dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
              />
            ) : (
              <div className="min-h-0 flex-1">
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-[12px] text-[var(--terminal-muted-fg)]">
                      正在加载编辑器...
                    </div>
                  }
                >
                  <TerminalMonacoEditor
                    key={relativePath}
                    value={draftContent}
                    language={language}
                    readOnly={false}
                    onChange={handleDraftChange}
                    onSave={handleManualSave}
                  />
                </Suspense>
              </div>
            )}
          </div>
        ) : (
          <div className="text-[12px] text-[var(--terminal-muted-fg)]">
            {formatFailure(preview.reason ?? null, preview.message ?? null)}
            {preview.reason === "too-large" && typeof preview.size === "number" ? (
              <div className="mt-2 text-[11px]">
                size={preview.size} max={preview.maxSize ?? "?"}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
