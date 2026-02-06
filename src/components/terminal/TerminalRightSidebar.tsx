import { useEffect, useState, type ReactNode } from "react";
import type { TerminalRightSidebarTab } from "../../models/terminal";
import { IconFolder, IconGitBranch, IconX } from "../Icons";
import TerminalFileExplorerPanel from "./TerminalFileExplorerPanel";
import TerminalFilePreviewPanel from "./TerminalFilePreviewPanel";
import TerminalGitPanel from "./TerminalGitPanel";
import TerminalGitFileViewPanel from "./TerminalGitFileViewPanel";
import type { GitSelectedFile } from "./TerminalGitPanel";

type TabButtonProps = {
  active: boolean;
  icon: ReactNode;
  label: string;
  dirty?: boolean;
  onClick: () => void;
};

function TabButton({ active, icon, label, dirty = false, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition-colors duration-150 ${
        active
          ? "border-[var(--terminal-divider)] bg-[var(--terminal-hover-bg)] text-[var(--terminal-fg)]"
          : "border-transparent text-[var(--terminal-muted-fg)] hover:border-[var(--terminal-divider)] hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)]"
      }`}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
      {dirty ? <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[var(--terminal-accent)]" /> : null}
    </button>
  );
}

export type TerminalRightSidebarProps = {
  projectPath: string;
  isGitRepo: boolean;
  sidebarWidth: number;
  activeTab: TerminalRightSidebarTab;
  previewDirty: boolean;
  previewFilePath: string | null;
  showHidden: boolean;
  onToggleShowHidden: (next: boolean) => void;
  onSelectFile: (relativePath: string) => void;
  onClosePreview: () => void;
  onPreviewDirtyChange: (dirty: boolean) => void;
  onChangeTab: (tab: TerminalRightSidebarTab) => void;
  onClose: () => void;
};

export default function TerminalRightSidebar({
  projectPath,
  isGitRepo,
  sidebarWidth,
  activeTab,
  previewDirty,
  previewFilePath,
  showHidden,
  onToggleShowHidden,
  onSelectFile,
  onClosePreview,
  onPreviewDirtyChange,
  onChangeTab,
  onClose,
}: TerminalRightSidebarProps) {
  const filesActive = activeTab === "files";
  const gitActive = activeTab === "git";
  const treeWidth = Math.min(320, Math.max(220, Math.round(sidebarWidth * 0.4)));
  const [gitSelected, setGitSelected] = useState<GitSelectedFile | null>(null);

  useEffect(() => {
    setGitSelected(null);
  }, [projectPath]);

  return (
    <aside className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--terminal-divider)] bg-[var(--terminal-panel-bg)] px-2 py-2">
        <TabButton
          active={filesActive}
          icon={<IconFolder size={14} />}
          label="文件"
          dirty={previewDirty}
          onClick={() => onChangeTab("files")}
        />
        {isGitRepo ? (
          <TabButton
            active={gitActive}
            icon={<IconGitBranch size={14} />}
            label="Git"
            onClick={() => onChangeTab("git")}
          />
        ) : null}
        <div className="flex-1" />
        <button
          type="button"
          aria-label="关闭侧边栏"
          title="关闭"
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[var(--terminal-muted-fg)] transition-colors duration-150 hover:border-[var(--terminal-divider)] hover:bg-[var(--terminal-hover-bg)] hover:text-[var(--terminal-fg)]"
        >
          <IconX size={14} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className={`absolute inset-0 flex min-h-0 ${
            filesActive ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex min-h-0 min-w-0 flex-1">
            <div
              className="flex min-h-0 shrink-0 flex-col border-r border-[var(--terminal-divider)]"
              style={{ width: treeWidth }}
            >
              <TerminalFileExplorerPanel
                embedded
                projectPath={projectPath}
                showHidden={showHidden}
                onToggleShowHidden={onToggleShowHidden}
                onSelectFile={onSelectFile}
                onClose={onClose}
              />
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {previewFilePath ? (
                <TerminalFilePreviewPanel
                  embedded
                  projectPath={projectPath}
                  relativePath={previewFilePath}
                  onDirtyChange={onPreviewDirtyChange}
                  onClose={onClosePreview}
                />
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center bg-[var(--terminal-bg)] text-[12px] text-[var(--terminal-muted-fg)]">
                  选择文件以预览/编辑
                </div>
              )}
            </div>
          </div>
        </div>

        {isGitRepo && gitActive ? (
          <div className="absolute inset-0 flex min-h-0 opacity-100">
            <div className="flex min-h-0 min-w-0 flex-1">
              <div
                className="flex min-h-0 shrink-0 flex-col border-r border-[var(--terminal-divider)]"
                style={{ width: treeWidth }}
              >
                <TerminalGitPanel
                  embedded
                  projectPath={projectPath}
                  onClose={onClose}
                  selected={gitSelected}
                  onSelect={setGitSelected}
                />
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <TerminalGitFileViewPanel
                  projectPath={projectPath}
                  selected={gitSelected}
                  onCloseSelected={() => setGitSelected(null)}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
