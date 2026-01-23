## 1. 技术调研与准备

- [ ] 1.1 调研 xterm.js + portable-pty 原生会话方案的集成路径
- [ ] 1.2 验证 macOS/Linux/Windows 平台的 PTY 与默认 shell 可用性
- [ ] 1.3 确定终端通信通道（PTY、事件通道或其他）
- [ ] 1.4 评估性能影响（内存、CPU）和多实例限制

## 2. 架构设计

- [ ] 2.1 设计开发模式 UI 布局（标签页 + 终端区域）
- [ ] 2.2 定义前后端通信 API（启动终端、切换会话、关闭会话）
- [ ] 2.3 设计会话持久化方案（可选功能）
- [ ] 2.4 设计模式切换机制（gallery-mode ↔ workspace-mode）

## 3. 后端实现（Tauri）

- [ ] 3.1 集成 portable-pty 依赖并封装 PTY 适配层
- [ ] 3.2 实现终端进程管理模块 `terminal.rs`（多 PTY 原生会话）
  - [ ] 3.2.1 为每个会话创建 PTY 并绑定默认 shell
  - [ ] 3.2.2 支持按项目复用已存在的会话
  - [ ] 3.2.3 切换会话时绑定对应 PTY 的输入输出
  - [ ] 3.2.4 维护项目与会话标识的映射（单项目单会话）
  - [ ] 3.2.5 关闭会话时终止子进程并清理映射
  - [ ] 3.2.6 处理 shell 不可用或启动失败提示
- [ ] 3.3 实现 Tauri 命令
  - [ ] 3.3.1 `create_terminal_session(project_path)` - 创建/复用会话
  - [ ] 3.3.2 `switch_terminal_session(session_id)` - 切换会话
  - [ ] 3.3.3 `close_terminal_session(session_id)` - 关闭会话
  - [ ] 3.3.4 `list_terminal_sessions()` - 列出活跃会话
- [ ] 3.4 处理窗口嵌入/通信（如果使用嵌入方案）

## 4. 前端实现（React）

- [ ] 4.1 创建 `WorkspaceView` 组件
  - [ ] 4.1.1 实现标签页栏 `TabBar`
  - [ ] 4.1.2 实现终端容器 `TerminalContainer`（单一终端实例）
- [ ] 4.1.3 处理标签切换、关闭（切换时调用 `switch_terminal_session`）
- [ ] 4.2 创建 `terminal.ts` 服务
  - [ ] 4.2.1 调用 Tauri 命令创建/切换/关闭会话
  - [ ] 4.2.2 管理前端会话状态
  - [ ] 4.2.3 移除终端快照拉取逻辑
- [ ] 4.3 修改 `App.tsx`
  - [ ] 4.3.1 添加模式状态（gallery | workspace）
  - [ ] 4.3.2 实现双击项目卡片进入 workspace 模式
  - [ ] 4.3.3 添加返回按钮退出 workspace 模式
- [ ] 4.4 设计和实现开发模式 UI/UX
  - [ ] 4.4.1 设计标签页样式
  - [ ] 4.4.2 设计终端区域样式
  - [ ] 4.4.3 设计模式切换动画

## 5. 集成与测试

- [ ] 5.1 端到端测试：启动应用 → 双击项目 → 验证终端可用
- [ ] 5.2 测试多项目标签页切换
- [ ] 5.3 测试会话关闭和资源清理
- [ ] 5.4 测试 shell 不可用时的错误提示
- [ ] 5.5 测试模式切换的状态保持
- [ ] 5.6 跨平台测试（macOS、Linux、Windows）

## 6. 文档与发布

- [ ] 6.1 更新 README 说明开发模式功能
- [ ] 6.2 添加用户指南：如何使用集成终端
- [ ] 6.3 更新依赖文档（xterm.js/portable-pty 说明）
- [ ] 6.4 准备 Release Notes
- [ ] 6.5 更新版本号（breaking change: 2.0.2）
