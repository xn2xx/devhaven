# Change: 在项目详情侧边栏展示 Markdown 预览

## Why
当前只能查看项目列表与备注，缺少对项目内 Markdown 文档的快速预览能力。

## What Changes
- 在项目详情侧边栏新增 Markdown 文件树与预览区域。
- 扩展后端命令以读取项目内 Markdown 文件清单与内容。
- 前端调用命令加载 Markdown 文件并展示预览内容。

## Impact
- Affected specs: project-markdown-preview (新增)
- Affected code: `src/components/DetailPanel.tsx`, `src/App.css`, `src/services/markdown.ts`, `src-tauri/src/markdown.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/models.rs`
