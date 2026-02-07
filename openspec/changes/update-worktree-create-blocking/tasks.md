## 1. Implementation
- [x] 为后端新增全局交互锁状态与事件（`interaction-lock`）
- [x] 后端新增非阻塞式创建命令（`worktree_init_create`）并保留阻塞式命令兼容
- [x] 后端在锁定期间拦截 `CloseRequested` / `ExitRequested`
- [x] 前端监听 `interaction-lock` 并渲染全局阻塞遮罩（拦截键鼠交互）
- [x] 将初始化进度迁移到全局遮罩（监听 `worktree-init-progress`）
- [x] worktree 创建弹窗移除内嵌进度展示，创建后关闭弹窗
- [x] 自测：创建成功/失败、遮罩立即显示、进度实时更新、无法关闭窗口/退出

## 2. Docs
- [x] 更新 `openspec/specs/terminal-workspace/spec.md` delta
- [x] 更新仓库 `AGENTS.md`（新增 command/事件与入口链路）
