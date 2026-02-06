# Change: 在终端工作区为已打开项目创建 Git worktree（作为项目子项）

## Why
当前在 DevHaven 的终端工作区里做并行开发（尤其是多分支/多 agent）时，用户需要手动在外部终端执行 `git worktree add`，再回到 DevHaven 扫描/添加目录，流程割裂且容易出错（路径、分支、重复检出等）。

在终端工作区的“已打开项目”列表中提供一键创建 worktree 的入口，可以让用户在同一个上下文内完成：创建 worktree → 作为项目子项记录 → 直接打开验证。

## What Changes
- 在终端工作区（`TerminalWorkspaceWindow`）左侧「已打开项目」列表中，为每个项目提供「创建 worktree」入口（菜单/按钮）。
- worktree 目录不作为顶层项目展示：项目扫描时识别 Git worktree 并从主项目列表中过滤。
- 点击后弹出「创建 worktree」对话框：
  - 支持选择“已有分支”或“新建分支”。
  - worktree 目标目录采用固定策略：`~/.devhaven/worktrees/<projectName>/<branch>`（无需用户输入）。
  - 支持读取并打开该仓库下已存在的 worktree（无需再次创建）。
  - 新建分支默认以当前 `HEAD` 为起点。
  - 支持可选项：创建后自动在终端打开。
- 创建成功后：
  - 调用 `git worktree add` 在本地创建 worktree 目录；
  - 将新 worktree 记录为源项目的子项（持久化到 `projects.json` 的源项目字段中）；
  - （若勾选）自动在终端工作区打开该 worktree 并设为激活。

## Out of Scope
- worktree 的完整管理（列出/移除/锁定/解锁/prune/强制覆盖等）。
- 高风险 Git 操作（merge/rebase/cherry-pick/stash/push/pull 等）。
- 自动端口隔离（例如自动为 `pnpm dev` 分配端口）——仍由用户通过命令参数或脚本自行控制。

## Impact
- Affected specs: `terminal-workspace`
- New Tauri commands:
  - `git_worktree_add`
  - `git_worktree_list`
- New frontend services:
  - `src/services/gitWorktree.ts`
- New UI:
  - `src/components/terminal/WorktreeCreateDialog.tsx`
  - `src/components/terminal/TerminalWorkspaceWindow.tsx`（新增入口）
- State / model changes:
  - `src/models/types.ts`、`src-tauri/src/models.rs`：`Project` 新增 `worktrees` 字段（作为子项列表，记录 worktree 元数据）
  - `worktrees` 子项最小 schema：`id`、`name`、`path`、`branch`、`inheritConfig`、`created`（以 `path` 作为幂等去重键）
  - `src-tauri/src/project_loader.rs`：构建项目时复用并保留 `worktrees`（类似 tags/scripts）；扫描时识别并过滤 worktree 目录
- Storage:
  - `projects.json`：在源项目条目中持久化 `worktrees`
