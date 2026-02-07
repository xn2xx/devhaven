# Change: 在终端 pane 右上角展示 Codex 模型与推理强度

## Why
当前终端工作区仅能看到“项目级 Codex 运行中”状态，无法在具体 pane 里直接确认当前 Codex CLI 会话使用的模型与推理强度。用户在多 pane 场景下容易混淆“哪个 pane 在跑什么配置”。

## What Changes
- 为终端 pane 增加右上角 Codex 浮层，展示：
  - `model`（原始 model 字段）
  - `effort`（原始 effort 字段，不做文案映射）
- 不展示 token 相关信息。
- 后端新增 pane 级精确映射能力（方案 2）：
  - 基于 shell PID 的子进程树识别 `codex` 进程；
  - 基于 `lsof -p <codex_pid>` 识别该进程打开的 `~/.codex/sessions/**/rollout-*.jsonl`；
  - 从对应 rollout 日志解析 `turn_context.model/effort`；
  - 按终端 `sessionId` 返回 overlay 数据。
- 增强 Codex 监控会话字段：在快照中补充 `model/effort`，用于统一数据语义。

## Out of Scope
- token 用量展示与汇总策略。
- 多个 Codex 会话同时绑定单个 pane 的并发展示。

## Impact
- Affected specs: `terminal-workspace`
- New Tauri commands:
  - `get_terminal_codex_pane_overlay`
- Updated Tauri modules:
  - `src-tauri/src/terminal.rs`
  - `src-tauri/src/codex_monitor.rs`
  - `src-tauri/src/models.rs`
- Updated frontend:
  - `src/services/terminal.ts`
  - `src/components/terminal/TerminalWorkspaceView.tsx`
  - `src/components/terminal/TerminalPane.tsx`
  - `src/models/codex.ts`
