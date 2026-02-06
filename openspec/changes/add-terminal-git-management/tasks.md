## 1. Backend（Rust/Tauri）
- [x] 在 `src-tauri/src/git_ops.rs`（或新增模块）实现 Git 面板所需能力：status/diff/stage/unstage/discard/commit/checkout
- [x] 在 `src-tauri/src/models.rs` 增加 Git 面板返回结构体（状态、文件列表等）
- [x] 在 `src-tauri/src/lib.rs` 注册新的 Tauri commands，并加入 `invoke_handler!` 列表

## 2. Frontend（React）
- [x] 新增 Git 状态/变更文件等 TS 模型（`src/models/*`）
- [x] 新增 service：`src/services/gitManagement.ts`，封装 `invoke(...)`
- [x] 新增 UI：`src/components/terminal/TerminalGitPanel.tsx`
- [x] 在 `src/components/terminal/TerminalWorkspaceView.tsx` 接入 Git 面板入口、布局与交互

## 3. 持久化与兼容
- [x] 扩展 `src/models/terminal.ts`：新增 `gitPanel` UI 状态
- [x] 扩展 `src/utils/terminalLayout.ts`：对旧版 `terminal_workspaces.json` 做默认值/兼容归一化

## 4. 文档回写
- [x] 更新仓库根 `AGENTS.md`（功能地图 + commands/services 定位信息）
