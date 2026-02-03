# Change: Project Scripts (快速启动脚本)

## Why
用户需要为每个项目配置可一键运行/停止的启动脚本（如 `pnpm dev`、`java -jar`），并通过界面快速操作，减少切换终端和手动输入的成本。

## What Changes
- 新增项目级脚本配置（启动/可选关闭命令），持久化到项目缓存。
- 详情面板提供 VSCode 任务风格的脚本运行区（下拉/列表 + 运行/停止按钮 + 状态文本）。
- 项目卡片展示前 1-2 个脚本的快捷运行按钮。
- 脚本运行在内置 tmux 工作区，自动进入工作区并在项目目录执行。

## Impact
- Affected specs: new capability `project-scripts`.
- Affected code: `src/models/types.ts`, `src/state/useDevHaven.ts`, `src/components/DetailPanel.tsx`,
  `src/components/ProjectCard.tsx`, `src/App.tsx`, `src/hooks/useTmuxWorkspace.ts`,
  `src-tauri/src/models.rs`, `src-tauri/src/project_loader.rs`, `src/App.css`.
