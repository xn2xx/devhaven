# Change: Remove terminal module UI and routing

## Why
终端模块整体移除；避免继续维护 tmux 与终端 UI 逻辑。用户双击项目不再打开终端，任务完成不再自动跳转。

## What Changes
- **BREAKING** 移除终端模块/页面与相关路由入口
- **BREAKING** 移除项目双击进入终端的行为
- **BREAKING** 移除任务完成后跳转到终端的行为
- 保留现有数据与配置（不做清理）

## Impact
- Affected specs: terminal-module
- Affected code: src, src-tauri, routing/menus/settings related files
