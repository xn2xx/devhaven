# Change: Add Codex Status In Terminal Workspace

## Why
用户在终端工作区中运行 Codex CLI 时，需要在对应项目空间快速看到“正在运行”状态，避免切回侧栏或猜测是否还在执行。

## What Changes
- 在终端工作区的顶部栏与“已打开项目”列表中，当检测到该项目存在运行中的 Codex 会话时显示状态标识（Codex 运行中）。
- 会话归属按 `session.cwd` 以 `project.path` 为前缀匹配到项目（复用现有匹配逻辑）。

## Impact
- Affected specs: terminal-workspace
- Affected code:
  - src/App.tsx
  - src/components/terminal/TerminalWorkspaceWindow.tsx
  - src/components/terminal/TerminalWorkspaceView.tsx
  - src/utils/codexProjectStatus.ts
  - src/hooks/useCodexSessions.ts (existing)
  - src-tauri/src/codex_sessions.rs (existing)

