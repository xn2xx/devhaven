# Change: 终端工作区支持“关闭项目”并清理会话信息

## Why
当前终端工作区会累积“已打开项目”，缺少单个项目的关闭入口；关闭后也会保留该项目的终端工作区持久化数据（sessions/tabs/panes），不利于用户管理与隐私/空间控制。

## What Changes
- 在终端工作区（`TerminalWorkspaceWindow`）的“已打开项目”列表中，新增关闭单个项目的入口。
- 关闭项目时：
  - 从“已打开项目”中移除该项目（UI 层面关闭）。
  - 删除该项目对应的终端工作区持久化数据（`~/.devhaven/terminal_workspaces.json` 中以 `projectPath` 为 key 的 workspace/sessions 记录）。
  - 终端 pane 卸载后现有逻辑会释放并 kill 对应 PTY（保持既有行为）。
- 新增一个 Tauri command 用于删除指定项目的终端工作区数据（例如：`delete_terminal_workspace`），并补齐前端 `src/services/terminalWorkspace.ts` 调用。

## Impact
- Affected code:
  - 前端：`src/App.tsx`、`src/components/terminal/TerminalWorkspaceWindow.tsx`、`src/services/terminalWorkspace.ts`
  - 后端：`src-tauri/src/storage.rs`、`src-tauri/src/lib.rs`
- Affected data:
  - `~/.devhaven/terminal_workspaces.json`（删除指定 `projectPath` 的 entry）

