import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FsEntry, FsFailureReason } from "../../models/filesystem";
import { listProjectDirEntries } from "../../services/filesystem";
import { copyToClipboard } from "../../services/system";
import {
  IconChevronDown,
  IconChevronRight,
  IconChevronsDownUp,
  IconEye,
  IconEyeOff,
  IconFile,
  IconFolder,
  IconRefresh,
  IconSearch,
  IconX,
} from "../Icons";

type DirState = {
  loading: boolean;
  reason?: FsFailureReason | null;
  message?: string | null;
};

export type TerminalFileExplorerPanelProps = {
  projectPath: string;
  showHidden: boolean;
  embedded?: boolean;
  onToggleShowHidden: (next: boolean) => void;
  onClose: () => void;
  onSelectFile: (relativePath: string) => void;
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

const PATH_LABEL_MAX_CHARS = 48;
const TREE_INDENT_PX = 14;

function getFolderLabel(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) {
    return "root";
  }
  return normalized.slice(0, lastSlash);
}

function truncatePathStart(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  const sliceLength = Math.max(1, maxLength - 3);
  return `...${value.slice(value.length - sliceLength)}`;
}

export default function TerminalFileExplorerPanel({
  projectPath,
  showHidden,
  embedded = false,
  onToggleShowHidden,
  onClose,
  onSelectFile,
}: TerminalFileExplorerPanelProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set([""]));
  const [entriesByDir, setEntriesByDir] = useState<Record<string, FsEntry[]>>({});
  const [dirStateByDir, setDirStateByDir] = useState<Record<string, DirState>>({});

  const [selectedRowPath, setSelectedRowPath] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const requestIdByDirRef = useRef(new Map<string, number>());

  const rootEntries = entriesByDir[""] ?? null;
  const rootState = dirStateByDir[""] ?? { loading: false };

  const loadDir = useCallback(
    async (relativeDir: string) => {
      const nextId = (requestIdByDirRef.current.get(relativeDir) ?? 0) + 1;
      requestIdByDirRef.current.set(relativeDir, nextId);
      setDirStateByDir((prev) => ({
        ...prev,
        [relativeDir]: { loading: true, reason: null, message: null },
      }));
      try {
        const response = await listProjectDirEntries(projectPath, relativeDir, showHidden);
        const latestId = requestIdByDirRef.current.get(relativeDir);
        if (latestId !== nextId) {
          return;
        }
        if (!response.ok) {
          setEntriesByDir((prev) => ({ ...prev, [relativeDir]: [] }));
          setDirStateByDir((prev) => ({
            ...prev,
            [relativeDir]: {
              loading: false,
              reason: response.reason ?? null,
              message: response.message ?? null,
            },
          }));
          return;
        }
        setEntriesByDir((prev) => ({ ...prev, [relativeDir]: response.entries }));
        setDirStateByDir((prev) => ({ ...prev, [relativeDir]: { loading: false } }));
      } catch (err) {
        const latestId = requestIdByDirRef.current.get(relativeDir);
        if (latestId !== nextId) {
          return;
        }
        setEntriesByDir((prev) => ({ ...prev, [relativeDir]: [] }));
        setDirStateByDir((prev) => ({
          ...prev,
          [relativeDir]: { loading: false, reason: "io-error", message: String(err) },
        }));
      }
    },
    [projectPath, showHidden],
  );

  const reloadRoot = useCallback(() => {
    setExpandedDirs(new Set([""]));
    setEntriesByDir({});
    setDirStateByDir({});
    setSelectedRowPath(null);
    setSearchTerm("");
    setSearchFocused(false);
    void loadDir("");
  }, [loadDir]);

  useEffect(() => {
    reloadRoot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath, showHidden]);

  const toggleDir = useCallback(
    (relativeDir: string) => {
      setSelectedRowPath(relativeDir);
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        if (next.has(relativeDir)) {
          next.delete(relativeDir);
        } else {
          next.add(relativeDir);
          if (!entriesByDir[relativeDir] && !dirStateByDir[relativeDir]?.loading) {
            void loadDir(relativeDir);
          }
        }
        return next;
      });
    },
    [dirStateByDir, entriesByDir, loadDir],
  );

  const selectFile = useCallback(
    (relativePath: string) => {
      setSelectedRowPath(relativePath);
      onSelectFile(relativePath);
    },
    [onSelectFile],
  );

  const flatRows = useMemo(() => {
    const rows: Array<
      | {
          type: "dir";
          entry: FsEntry;
          depth: number;
          expanded: boolean;
          loading: boolean;
          active: boolean;
          error?: string | null;
        }
      | { type: "file"; entry: FsEntry; depth: number; active: boolean }
    > = [];

    const walk = (dirPath: string, depth: number) => {
      const entries = entriesByDir[dirPath] ?? [];
      for (const entry of entries) {
        if (entry.kind === "dir") {
          const expanded = expandedDirs.has(entry.relativePath);
          const loading = Boolean(dirStateByDir[entry.relativePath]?.loading);
          const state = dirStateByDir[entry.relativePath];
          const error =
            state && !state.loading && (state.reason || state.message)
              ? formatFailure(state.reason ?? null, state.message ?? null)
              : null;
          rows.push({
            type: "dir",
            entry,
            depth,
            expanded,
            loading,
            active: selectedRowPath === entry.relativePath,
            error,
          });
          if (expanded) {
            walk(entry.relativePath, depth + 1);
          }
        } else if (entry.kind === "file") {
          rows.push({
            type: "file",
            entry,
            depth,
            active: selectedRowPath === entry.relativePath,
          });
        }
      }
    };

    walk("", 0);
    return rows;
  }, [dirStateByDir, entriesByDir, expandedDirs, selectedRowPath]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isSearching = normalizedSearch.length > 0;

  const searchResults = useMemo(() => {
    if (!isSearching) {
      return [];
    }
    const seen = new Set<string>();
    const results: FsEntry[] = [];
    for (const entries of Object.values(entriesByDir)) {
      for (const entry of entries) {
        if (seen.has(entry.relativePath)) {
          continue;
        }
        seen.add(entry.relativePath);
        const haystack = `${entry.name} ${entry.relativePath}`.toLowerCase();
        if (haystack.includes(normalizedSearch)) {
          results.push(entry);
        }
      }
    }
    results.sort((a, b) => a.relativePath.toLowerCase().localeCompare(b.relativePath.toLowerCase()));
    return results;
  }, [entriesByDir, isSearching, normalizedSearch]);

  return (
    <aside
      className={`flex min-h-0 min-w-0 flex-col bg-[var(--terminal-panel-bg)] ${
        embedded ? "flex-1" : "w-[320px] border-l border-[var(--terminal-divider)]"
      }`}
    >
      {!embedded ? (
        <div className="flex items-start justify-between gap-2 border-b border-[var(--terminal-divider)] px-3 py-2">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-[var(--terminal-muted-fg)]">Files</div>
            <button
              type="button"
              className="mt-0.5 max-w-[260px] truncate text-left text-[10px] text-[var(--terminal-muted-fg)] transition-colors hover:text-[var(--terminal-fg)]"
              title="点击复制项目路径"
              onClick={() => copyToClipboard(projectPath)}
            >
              {projectPath}
            </button>
          </div>
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[var(--terminal-muted-fg)] hover:border-[var(--terminal-divider)] hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--terminal-accent-outline)] focus-visible:outline-offset-2"
            type="button"
            aria-label="关闭文件面板"
            title="关闭"
            onClick={onClose}
          >
            <IconX size={14} />
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5 border-b border-[var(--terminal-divider)] px-2 py-2">
        <div
          className={`relative flex items-center rounded-md border px-2 transition-colors ${
            searchFocused
              ? "border-[var(--terminal-accent-outline)] bg-[var(--terminal-bg)]"
              : "border-[var(--terminal-divider)] bg-[var(--terminal-bg)]"
          }`}
        >
          <IconSearch size={14} className="shrink-0 text-[var(--terminal-muted-fg)]" />
          <input
            value={searchTerm}
            placeholder="搜索文件..."
            onChange={(event) => setSearchTerm(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSearchTerm("");
              }
            }}
            className="h-7 w-full border-none bg-transparent px-2 text-[12px] text-[var(--terminal-fg)] outline-none placeholder:text-[var(--terminal-muted-fg)] caret-[var(--terminal-accent)]"
          />
          {searchTerm ? (
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--terminal-muted-fg)] transition-colors hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)]"
              aria-label="清除搜索"
              title="清除搜索"
              onClick={() => setSearchTerm("")}
            >
              <IconX size={12} />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-0.5">
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--terminal-muted-fg)] transition-colors hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--terminal-accent-outline)] focus-visible:outline-offset-2"
            type="button"
            aria-label={showHidden ? "隐藏隐藏文件" : "显示隐藏文件"}
            title={showHidden ? "隐藏隐藏文件" : "显示隐藏文件"}
            onClick={() => onToggleShowHidden(!showHidden)}
          >
            {showHidden ? <IconEyeOff size={14} /> : <IconEye size={14} />}
          </button>
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--terminal-muted-fg)] transition-colors hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--terminal-accent-outline)] focus-visible:outline-offset-2"
            type="button"
            aria-label="折叠全部"
            title="折叠全部"
            onClick={() => setExpandedDirs(new Set([""]))}
          >
            <IconChevronsDownUp size={14} />
          </button>
          <div className="flex-1" />
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--terminal-muted-fg)] transition-colors hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--terminal-accent-outline)] focus-visible:outline-offset-2"
            type="button"
            aria-label="刷新"
            title="刷新"
            onClick={reloadRoot}
          >
            <IconRefresh size={14} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--terminal-bg)]">
          {rootState.loading && !rootEntries ? (
            <div className="px-3 py-2 text-[12px] text-[var(--terminal-muted-fg)]">正在读取文件列表...</div>
          ) : null}
          {!rootState.loading && rootState.reason ? (
            <div className="px-3 py-2 text-[12px] text-[var(--terminal-muted-fg)]">
              {formatFailure(rootState.reason, rootState.message ?? null)}
            </div>
          ) : null}

          {isSearching ? (
            searchResults.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-[var(--terminal-muted-fg)]">没有匹配文件</div>
            ) : (
              <div className="flex flex-col py-1">
                {searchResults.map((entry) => {
                  const folderLabel = truncatePathStart(getFolderLabel(entry.relativePath), PATH_LABEL_MAX_CHARS);
                  const active = selectedRowPath === entry.relativePath;
                  return (
                    <button
                      key={entry.relativePath}
                      type="button"
                      className={`flex w-full items-center gap-2 px-2 py-1 text-left transition-colors hover:bg-[var(--terminal-hover-bg)] ${
                        active
                          ? "bg-[var(--terminal-hover-bg)] shadow-[inset_0_1px_0_var(--terminal-divider),inset_0_-1px_0_var(--terminal-divider)]"
                          : ""
                      }`}
                      onClick={() => {
                        if (entry.kind === "dir") {
                          toggleDir(entry.relativePath);
                          setSearchTerm("");
                          return;
                        }
                        selectFile(entry.relativePath);
                      }}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[10px] text-[var(--terminal-muted-fg)]" title={entry.relativePath}>
                          {folderLabel}
                        </div>
                        <div className="flex min-w-0 items-center gap-1.5">
                          {entry.kind === "dir" ? (
                            <IconFolder size={14} className="shrink-0 text-[#f59e0b]" />
                          ) : (
                            <IconFile size={14} className="shrink-0 text-[var(--terminal-muted-fg)]" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--terminal-fg)]">
                            {entry.name}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : !rootState.loading && rootEntries && rootEntries.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-[var(--terminal-muted-fg)]">目录为空</div>
          ) : (
            <div className="flex flex-col py-1">
              {flatRows.map((row) => {
                const rowClass = `flex h-7 w-full items-center gap-1.5 text-left text-[12px] transition-colors duration-150 hover:bg-[var(--terminal-hover-bg)] ${
                  row.active
                    ? "bg-[var(--terminal-hover-bg)] shadow-[inset_0_1px_0_var(--terminal-divider),inset_0_-1px_0_var(--terminal-divider)]"
                    : ""
                }`;
                const rowStyle = { paddingLeft: 8 + row.depth * TREE_INDENT_PX, paddingRight: 8 };

                if (row.type === "dir") {
                  return (
                    <div key={row.entry.relativePath}>
                      <button
                        className={rowClass}
                        style={rowStyle}
                        type="button"
                        aria-expanded={row.expanded}
                        onClick={() => toggleDir(row.entry.relativePath)}
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                          {row.expanded ? (
                            <IconChevronDown size={14} className="text-[var(--terminal-muted-fg)]" />
                          ) : (
                            <IconChevronRight size={14} className="text-[var(--terminal-muted-fg)]" />
                          )}
                        </span>
                        <IconFolder size={14} className="shrink-0 text-[#f59e0b]" />
                        <span className="min-w-0 flex-1 truncate text-[var(--terminal-fg)]">{row.entry.name}</span>
                        {row.loading ? (
                          <span className="shrink-0 text-[10px] font-semibold text-[var(--terminal-muted-fg)]">
                            ...
                          </span>
                        ) : null}
                      </button>
                      {row.error ? (
                        <div
                          className="px-2 py-1 text-[11px] text-[var(--terminal-muted-fg)]"
                          style={{ paddingLeft: 8 + (row.depth + 1) * TREE_INDENT_PX }}
                        >
                          {row.error}
                        </div>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <button
                    key={row.entry.relativePath}
                    className={rowClass}
                    style={rowStyle}
                    type="button"
                    onClick={() => selectFile(row.entry.relativePath)}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true" />
                    <IconFile size={14} className="shrink-0 text-[var(--terminal-muted-fg)]" />
                    <span className="min-w-0 flex-1 truncate text-[var(--terminal-muted-fg)]">
                      {row.entry.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
