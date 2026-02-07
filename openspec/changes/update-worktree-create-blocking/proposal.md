# Change: Worktree 创建全局交互锁 + 全局进度遮罩

## Why
worktree 创建期间如果继续允许 UI 交互，容易出现误操作与状态竞争；同时进度只在局部弹窗展示，用户在全局锁定场景下缺少反馈。

## What Changes
- 新增 `worktree_init_create`：非阻塞创建命令，快速返回 `jobId`。
- 创建期间由后端后台持有全局交互锁（`interaction-lock`），拦截所有窗口键鼠交互与关闭/退出。
- 创建进度统一迁移到全局遮罩展示（监听 `worktree-init-progress`），创建弹窗移除内嵌进度区。
- 保留 `worktree_init_create_blocking` 兼容命令。

## Impact
- Affected specs: `terminal-workspace`
- Affected code:
  - Frontend: `src/App.tsx`, `src/components/InteractionLockOverlay.tsx`, `src/components/terminal/WorktreeCreateDialog.tsx`, `src/services/worktreeInit.ts`
  - Backend: `src-tauri/src/lib.rs`, `src-tauri/src/interaction_lock.rs`, `src-tauri/src/worktree_init.rs`, `src-tauri/src/models.rs`
