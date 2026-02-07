## 1. Backend（Rust/Tauri）
- [x] 1.1 扩展 Codex 监控会话模型，支持 `model/effort` 字段
- [x] 1.2 在会话解析中提取 `turn_context.model` 与 `turn_context.effort`
- [x] 1.3 在终端模块实现 pane↔codex 精确映射（shell 子进程树 + lsof rollout 识别）
- [x] 1.4 新增 command：`get_terminal_codex_pane_overlay` 并注册到 `invoke_handler`

## 2. Frontend（React）
- [x] 2.1 新增 service：拉取 pane overlay 数据
- [x] 2.2 在终端工作区按 session 轮询 overlay 并分发到 pane
- [x] 2.3 在 `TerminalPane` 右上角渲染 model/effort 浮层（effort 使用原始值）

## 3. 测试与验证
- [x] 3.1 追加后端单测：验证 `turn_context` 能提取 model/effort
- [x] 3.2 通过 Rust 测试：`cargo test`
- [x] 3.3 通过前端构建：`npm run build`

## 4. 文档回写
- [x] 4.1 更新 `AGENTS.md`：补充 pane 级 Codex 浮层能力与 command 索引
