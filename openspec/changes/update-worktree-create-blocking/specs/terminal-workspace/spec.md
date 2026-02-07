# terminal-workspace Specification (Delta)

## ADDED Requirements

### Requirement: Worktree Creation Must Use Global Interaction Lock
系统 SHALL 在 worktree 创建期间启用全局交互锁，拦截所有窗口交互与关闭/退出请求，直到任务结束。

#### Scenario: 创建期间拦截交互与关闭
- **GIVEN** 用户在终端工作区发起创建 worktree
- **WHEN** worktree 创建尚未完成
- **THEN** 所有窗口进入不可交互状态（拦截键盘/鼠标交互）
- **AND** 关闭窗口/退出应用请求被拦截
- **AND** 创建完成（成功或失败）后解除交互锁

### Requirement: Worktree Creation Should Start Non-Blocking And Report Progress Globally
系统 SHALL 通过非阻塞命令启动 worktree 创建，前端应立即获得任务 `jobId`，并在全局遮罩中展示实时进度。

#### Scenario: 创建命令快速返回
- **GIVEN** 用户发起创建 worktree
- **WHEN** 前端调用创建命令
- **THEN** 命令 SHALL 快速返回任务 `jobId`，不等待任务完成

#### Scenario: 全局遮罩展示进度
- **GIVEN** worktree 创建任务正在执行
- **WHEN** 后端发出 `worktree-init-progress`
- **THEN** 前端 SHALL 在全局遮罩中展示当前步骤、进度与状态信息
