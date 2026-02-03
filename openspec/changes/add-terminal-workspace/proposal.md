# Change: add terminal workspace

## Why
DevHaven 需要内置终端工作空间以减少上下文切换，并为每个项目提供可恢复的终端环境。

## What Changes
- 新增终端工作空间窗口（每项目独立）
- 支持 Tab + 分屏布局，并可拖拽调整比例
- 支持终端会话恢复（布局 + 会话配置 + CWD + 滚动缓冲）
- 新增终端会话与工作空间持久化 API

## Impact
- Affected specs: terminal-workspace
- Affected code: src/, src-tauri/
