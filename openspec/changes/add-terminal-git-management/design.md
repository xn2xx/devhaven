# Design: Terminal Git Panel

## Data Flow
- UI（React）通过 `@tauri-apps/api/core.invoke` 调用 Rust 端 commands。
- Rust 端通过执行 `git` CLI 获取状态与 diff，并返回结构化数据给前端。

## Git Status 解析
- 使用 `git status --porcelain=v2 -z -b`：
  - `-b` 提供分支/上游/ahead/behind 信息；
  - `-z` 使用 NUL 分隔，避免路径包含空格/特殊字符导致解析错误。
- 解析规则（与 superset 的 staged/unstaged/untracked 分类保持一致）：
  - 记录类型 `1` / `2`：读取 `XY`，若 `X != .` 归入 staged；若 `Y != .` 归入 unstaged。
  - 记录类型 `?`：归入 untracked。
  - `2`（rename/copy）额外读取 `oldPath`。

## Diff 获取
- unstaged diff：`git -c color.ui=false diff -- <path>`
- staged diff：`git -c color.ui=false diff --cached -- <path>`

## Mutations
- stage：`git add -- <paths...>`
- unstage：`git reset HEAD -- <paths...>`
- discard（仅未暂存）：`git checkout -- <paths...>`（UI 侧二次确认）
- commit：`git commit -m <message>`
- checkout：`git checkout <branch>`

## UI/State
- 在 `TerminalWorkspaceUi` 增加 `rightSidebar`：持久化侧边栏开关/宽度/Tab（files/git）；同时保留 legacy `gitPanel.open` 仅用于兼容与同步。
- Git 入口显示策略：仅对“有 Git 管理”的项目显示（以 `projectPath/.git` 是否存在作为判定；worktree 场景下 `.git` 可能是文件但仍视为存在）。
- Git 面板打开时：
  - 支持手动刷新；
  - 可选定时刷新（例如 2~3s）以跟随终端内 Git 操作变化。
