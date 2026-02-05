# Change: add-project-quick-commands

## Why
用户希望每个项目能快捷配置“启动/查看日志”等简单命令，并在项目面板与终端页面都能快速运行/停止，提高日常开发效率。

## What Changes
- 在项目详情面板新增“快捷命令”管理：新增/编辑/删除/运行/停止。
- 运行命令时在终端工作区自动新建 Tab 并下发命令，输出在终端中查看。
- 终端工作区右侧新增可拖拽“快捷命令悬浮窗”，支持运行/停止；位置与开关按项目持久化。

## Impact
- Affected specs:
  - New: `project-quick-commands`
  - Modified: `terminal-workspace`
- Affected code (key):
  - `src/components/DetailPanel.tsx`
  - `src/state/useDevHaven.ts`
  - `src/App.tsx`
  - `src/components/terminal/TerminalWorkspaceView.tsx`
  - `src/components/terminal/TerminalPane.tsx`
  - `src/models/terminal.ts`
  - `src/utils/terminalLayout.ts`

