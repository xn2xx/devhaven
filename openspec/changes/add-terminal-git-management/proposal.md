# Change: 在终端工作区增加 Git 管理面板

## Why
当前 DevHaven 的终端工作区需要用户手动在终端里执行 Git 命令或切到外部工具（如 VS Code / SourceTree）来查看与管理改动。
参考 `superset` 项目的「Changes/Diff」体验，在终端工作区内提供一个轻量的 Git 管理面板，可以显著减少上下文切换成本。

## What Changes
- 在终端工作区（`TerminalWorkspaceView`）顶部增加「Git」入口，打开/关闭 Git 侧栏面板。
- 仅对“有 Git 管理”的项目显示 Git 入口与面板（以 `projectPath/.git` 是否存在作为判定；非 Git 项目不展示相关 UI）。
- Git 面板提供：
  - 当前分支/上游/ ahead/behind 信息（如可获取）。
  - 变更文件分组展示：已暂存（staged）/ 未暂存（unstaged）/ 未跟踪（untracked）。
  - 文件级操作：暂存 / 取消暂存 / 丢弃未暂存修改。
  - 文件查看/编辑（raw/渲染）与文件对比预览（按文件加载，使用左右对比视图）。
  - 提交（commit）：输入提交信息并提交已暂存改动。
  - 分支切换（checkout）：复用现有 `list_branches`，新增 checkout command。

## Out of Scope
- push/pull/merge/rebase/cherry-pick/stash 等高风险或需要交互认证的操作。
- Git worktree 管理（Superset 的核心能力之一），本次仅做工作目录层面的 Git 变更管理。

## Impact
- Affected specs: `terminal-workspace`
- Affected storage: `terminal_workspaces.json`（新增 `workspace.ui.rightSidebar`（open/width/tab）；并保留 legacy `workspace.ui.gitPanel.open`/`workspace.ui.fileExplorerPanel.open` 由 `rightSidebar` 同步）
- New Tauri commands：
  - `git_is_repo`
  - `git_get_status`
  - `git_get_diff_contents`
  - `git_stage_files`
  - `git_unstage_files`
  - `git_discard_files`
  - `git_commit`
  - `git_checkout_branch`
- New frontend service：`src/services/gitManagement.ts`
- New UI：`src/components/terminal/TerminalGitPanel.tsx`、`src/components/terminal/TerminalRightSidebar.tsx`
