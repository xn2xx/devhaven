# Change: Add CLI 悬浮监控窗

## Why
当前 CLI 监控仅存在于主窗口工作区内，无法在开发时悬浮查看。需要一个独立悬浮窗，在不打断主界面的情况下只读显示会话与输出。

## What Changes
- 新增独立悬浮监控窗（只读）用于展示 tmux 会话列表与终端输出
- 在悬浮窗内提供置顶开关（仅影响悬浮窗自身）
- 设置中新增“显示悬浮窗”开关，保存后自动打开/关闭悬浮窗

## Impact
- Affected specs: cli-monitor-window
- Affected code:
  - src/App.tsx
  - src/components/SettingsModal.tsx
  - src/components/TerminalPanel.tsx
  - src/components/TabBar.tsx
  - src/models/types.ts
  - src/state/useDevHaven.ts
  - src-tauri/src/models.rs
  - (新增) src/components/MonitorWindow.tsx 或等效文件
  - (新增) src/services/monitorWindow.ts
