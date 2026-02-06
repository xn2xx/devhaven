<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# 项目概览（DevHaven）

DevHaven 是一个基于 **Tauri + React** 的桌面应用：前端负责 UI/交互（React + Vite + UnoCSS），后端负责本地能力（Rust + Tauri Commands：文件扫描、Git 读取、存储、PTY 终端等）。

## 1) 开发语言 + 框架

### 前端（UI）
- 语言：TypeScript
- 框架：React（见 `package.json`）
- 构建：Vite（见 `vite.config.ts`）
- 样式：UnoCSS（见 `unocss.config.ts`，入口 `src/main.tsx` 引入 `uno.css`）
- 入口：`src/main.tsx` → `src/App.tsx`

### 桌面/后端（Tauri）
- 语言：Rust
- 框架：Tauri v2（见 `src-tauri/`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`）
- 前后端通信：前端 `@tauri-apps/api/core` 的 `invoke`（`src/services/*`） ↔ 后端 `#[tauri::command]`（集中在 `src-tauri/src/lib.rs`）
- 插件：dialog/opener/clipboard/log（在 `src-tauri/src/lib.rs` 初始化）

### 本地数据落盘位置（便于排查）
- 应用数据目录：`~/.devhaven/`（实现：`src-tauri/src/storage.rs`）
  - `app_state.json`：应用状态（目录、标签、回收站、设置等）
  - `projects.json`：项目缓存列表
  - `heatmap_cache.json`：热力图缓存
  - `terminal_workspaces.json`：终端工作区/布局缓存

### 开发环境注意（不要入库）
- `.beads/`：bd/beads 本地工作区目录（可能由本地 git hooks 触发）；项目运行不依赖该目录，仓库应忽略/不提交。若 `git commit` 因 bd flush 报错，删除 `.beads/` 或移除本地 `.git/hooks/pre-commit` 中 bd 段落即可。

## 2) 功能列表 + 对应位置（功能地图）

下面按“用户功能 → 前端入口/UI → 前端服务层 → Rust 后端”给出快速定位点。

### A. 工作目录/项目扫描与项目列表
- 侧边栏「目录」区：`src/components/Sidebar.tsx`
- 主列表/卡片渲染：`src/components/MainContent.tsx`、`src/components/ProjectCard.tsx`
- 核心状态与动作（刷新/扫描/合并/持久化）：`src/state/useDevHaven.ts`、`src/state/DevHavenContext.tsx`
- 调用 Tauri 命令：`src/services/appStorage.ts`（`discoverProjects/buildProjects/load/save`）
- 扫描与构建项目元数据（是否 Git 仓库、提交数、最后提交时间）：`src-tauri/src/project_loader.rs`
- Command 注册处：`src-tauri/src/lib.rs`（`discover_projects`、`build_projects`、`load_projects`、`save_projects`）

### B. 筛选（标签/目录/搜索/时间范围/Git 状态）
- 筛选状态与组合逻辑（搜索词、目录、标签、日期、Git Filter 等）：`src/App.tsx`
- 筛选模型与选项：`src/models/filters.ts`
- 搜索输入组件：`src/components/SearchBar.tsx`

### C. 标签管理（新建/编辑/隐藏/颜色/批量打标）
- 标签列表与入口：`src/components/Sidebar.tsx`
- 标签编辑弹窗：`src/components/TagEditDialog.tsx`
- 颜色工具：`src/utils/tagColors.ts`、`src/utils/colors.ts`
- 标签持久化与变更动作：`src/state/useDevHaven.ts`（写入 `app_state.json`）

### D. 项目详情面板（备注/分支/Markdown/快捷操作）
- 详情面板容器：`src/components/DetailPanel.tsx`
- 项目卡片：`src/components/ProjectCard.tsx`（通常在主列表中触发打开详情）
- 项目快捷命令（配置/编辑/删除/运行/停止）：`src/components/DetailPanel.tsx`（入口）→ `src/App.tsx`（打开终端并派发事件）→ `src/services/terminalQuickCommands.ts` → `src/components/terminal/TerminalWorkspaceView.tsx`（执行）；持久化在 `projects.json`（字段：`Project.scripts`，模型：`src/models/types.ts`）
- Git 分支列表：
  - 前端：`src/services/git.ts`
  - 后端：`src-tauri/src/git_ops.rs`（`list_branches`）
  - Command：`src-tauri/src/lib.rs`（`list_branches`）
- 项目备注 `PROJECT_NOTES.md`：
  - 前端：`src/services/notes.ts`
  - 后端：`src-tauri/src/notes.rs`
  - Command：`src-tauri/src/lib.rs`（`read_project_notes/write_project_notes`）
- 项目内 Markdown 文件浏览/预览：
  - UI：`src/components/ProjectMarkdownSection.tsx`
  - 前端：`src/services/markdown.ts`
  - 后端：`src-tauri/src/markdown.rs`
  - Command：`src-tauri/src/lib.rs`（`list_project_markdown_files/read_project_markdown_file`）
- 系统快捷操作（打开目录/复制路径/外部编辑器）：
  - 前端：`src/services/system.ts`
  - 后端：`src-tauri/src/system.rs`
  - Command：`src-tauri/src/lib.rs`（`open_in_finder/open_in_editor/copy_to_clipboard`）

### E. Git 活跃度统计与热力图/仪表盘
- Git 每日提交统计（批量）：`src/services/gitDaily.ts` ↔ `src-tauri/src/git_daily.rs`（Command：`collect_git_daily`）
- 热力图数据管理（缓存/加载/计算）：`src/state/useHeatmapData.ts`、`src/services/heatmap.ts`
- 侧边栏热力图组件：`src/components/Heatmap.tsx`（在 `src/components/Sidebar.tsx` 使用）
- 仪表盘弹窗：`src/components/DashboardModal.tsx`（数据模型：`src/models/dashboard.ts`）

### F. 回收站（隐藏项目/恢复）
- UI：`src/components/RecycleBinModal.tsx`
- 数据与动作：`src/state/useDevHaven.ts`（`appState.recycleBin`，持久化在 `app_state.json`）

### G. 终端工作区（内置终端 + 布局持久化）
- 终端窗口管理：`src/services/terminalWindow.ts`、`src/components/terminal/TerminalWorkspaceWindow.tsx`
- 关闭已打开项目（并删除该项目的终端工作区 sessions/tabs 持久化）：`src/components/terminal/TerminalWorkspaceWindow.tsx`、`src/App.tsx` → `src/services/terminalWorkspace.ts`（`deleteTerminalWorkspace`） ↔ `src-tauri/src/lib.rs`（Command：`delete_terminal_workspace`）→ `src-tauri/src/storage.rs`（删除 `terminal_workspaces.json` entry）
- 终端 UI（xterm、分屏、标签）：`src/components/terminal/*`
- 终端右侧快捷命令悬浮窗（可拖拽，按项目记忆位置/开关，支持运行/停止）：`src/components/terminal/TerminalWorkspaceView.tsx`；事件协议：`src/services/terminalQuickCommands.ts`；面板状态持久化写入 `terminal_workspaces.json` 的 `workspace.ui.quickCommandsPanel`（类型：`src/models/terminal.ts`；默认/兼容处理：`src/utils/terminalLayout.ts`）
- 终端右侧侧边栏（可拖拽调整宽度，Tabs：文件/Git）：`src/components/terminal/TerminalRightSidebar.tsx`、`src/components/terminal/ResizablePanel.tsx`、`src/components/terminal/TerminalWorkspaceView.tsx`；面板状态持久化：`terminal_workspaces.json` 的 `workspace.ui.rightSidebar`（open/width/tab；类型：`src/models/terminal.ts`；默认/兼容：`src/utils/terminalLayout.ts`）
- 终端右侧文件（文件树 + 预览/编辑：Markdown 渲染、源码语法高亮、自动保存 + ⌘/Ctrl+S 保存）：`src/components/terminal/TerminalFileExplorerPanel.tsx`、`src/components/terminal/TerminalFilePreviewPanel.tsx`、`src/components/terminal/TerminalMonacoEditor.tsx`、`src/components/terminal/TerminalRightSidebar.tsx`；前端：`src/services/filesystem.ts`（`listProjectDirEntries/readProjectFile/writeProjectFile`）+ `src/utils/fileTypes.ts`/`src/utils/detectLanguage.ts` ↔ 后端：`src-tauri/src/filesystem.rs`；Command：`src-tauri/src/lib.rs`（`list_project_dir_entries/read_project_file/write_project_file`）；面板状态持久化：`terminal_workspaces.json` 的 `workspace.ui.fileExplorerPanel.showHidden`（隐藏文件开关；`workspace.ui.fileExplorerPanel.open` 为 legacy 字段，由 `rightSidebar` 同步）
- 终端 Git 管理（仅对 `projectPath/.git` 存在的项目显示；状态/变更列表/文件查看编辑/对比/暂存/取消暂存/丢弃未暂存/提交/切分支）：`src/components/terminal/TerminalGitPanel.tsx`（左侧列表/操作）、`src/components/terminal/TerminalGitFileViewPanel.tsx`（右侧文件/对比视图）、`src/components/terminal/TerminalRightSidebar.tsx`；前端：`src/services/gitManagement.ts`（`gitIsRepo/gitGetStatus/gitGetDiffContents/gitStageFiles/gitUnstageFiles/gitDiscardFiles/gitCommit/gitCheckoutBranch`）+ `src/services/git.ts`（`listBranches`）↔ 后端：`src-tauri/src/git_ops.rs`；Command：`src-tauri/src/lib.rs`（`git_is_repo/git_get_status/git_get_diff_contents/git_stage_files/git_unstage_files/git_discard_files/git_commit/git_checkout_branch`）；面板状态持久化：`terminal_workspaces.json` 的 `workspace.ui.rightSidebar.tab`（`workspace.ui.gitPanel.open` 为 legacy 字段，由 `rightSidebar` 同步）
- 终端 worktree 创建/打开/删除/同步（在“已打开项目”列表为父项目创建并展示 worktree 子项，支持已有/新建分支、打开仓库已存在 worktree、可选创建后打开；目标目录固定为 `~/.devhaven/worktrees/<project>/<branch>`，打开时默认继承父项目 tags/scripts；删除会执行 `git worktree remove` 并移除记录；终端打开或点击“刷新 worktree”会从 `git worktree list` 同步 `Project.worktrees` 记录）：`src/components/terminal/TerminalWorkspaceWindow.tsx`（入口/子项列表/刷新/删除/失败重试）+ `src/components/terminal/WorktreeCreateDialog.tsx`（创建弹窗，提交后后台初始化，含步骤进度视图与失败诊断复制）；前端：`src/services/gitWorktree.ts`（`gitWorktreeList/gitWorktreeRemove`）+ `src/services/worktreeInit.ts`（`worktreeInitStart/worktreeInitCancel/worktreeInitRetry/worktreeInitStatus` + `worktree-init-progress` 监听）+ `src/state/useDevHaven.ts`（`syncProjectWorktrees`）↔ 后端：`src-tauri/src/worktree_init.rs`（后台初始化任务、项目级互斥、取消/重试/状态查询）+ `src-tauri/src/git_ops.rs`（`add_worktree/list_worktrees/remove_worktree`）/`src-tauri/src/project_loader.rs`（扫描过滤 worktree 顶层目录）；Command：`src-tauri/src/lib.rs`（`worktree_init_start/worktree_init_cancel/worktree_init_retry/worktree_init_status` + `git_worktree_add/git_worktree_list/git_worktree_remove`）；持久化：`projects.json` 的 `Project.worktrees`（含 `status/initStep/initError/initJobId` 等创建态字段）
- 终端工作区显示 Codex CLI 运行状态（按项目路径归属聚合会话）：`src/utils/codexProjectStatus.ts`、`src/App.tsx` → `src/components/terminal/TerminalWorkspaceWindow.tsx`/`src/components/terminal/TerminalWorkspaceView.tsx`
- 终端快捷键（iTerm2/浏览器风格）：`src/components/terminal/TerminalWorkspaceView.tsx`（⌘T 新建 Tab、⌘W 关闭 Pane/Tab、⌘↑/⌘↓/⌘←/⌘→ 上一/下一 Tab、⌘⇧[ / ⌘⇧] 上一/下一 Tab、⌘1..⌘9 快速切换 Tab、⌘D 分屏）
- 会话/PTY 通信：
  - 前端：`src/services/terminal.ts`（`terminal-*` 事件监听）
  - 后端：`src-tauri/src/terminal.rs`
  - Command：`src-tauri/src/lib.rs`（`terminal_create_session/terminal_write/terminal_resize/terminal_kill`）
- 工作区持久化：
  - 前端：`src/services/terminalWorkspace.ts`
  - 后端：`src-tauri/src/storage.rs`（`terminal_workspaces.json`）

### H. 悬浮监控窗（Monitor）
- 窗口创建/置顶/跨工作区：`src/services/monitorWindow.ts`
- macOS 全屏空间辅助显示：`src-tauri/src/lib.rs`（`set_window_fullscreen_auxiliary/apply_fullscreen_auxiliary`）
- 悬浮窗 UI：`src/components/MonitorWindow.tsx`

### I. Codex CLI 会话集成（监听 ~/.codex/sessions）
- 前端：`src/hooks/useCodexSessions.ts`、`src/services/codex.ts`、`src/components/CodexSessionSection.tsx`
- 后端：`src-tauri/src/codex_sessions.rs`（文件监听 + 事件 `codex-sessions-update`）

### J. 更新检查
- GitHub Releases latest 检查：`src/services/update.ts`

### K. 设置（更新/悬浮窗开关/Git 身份/终端渲染）
- UI：`src/components/SettingsModal.tsx`
- 设置模型：`src/models/types.ts`（`AppSettings`）
- 保存入口：`src/App.tsx`（打开/关闭设置弹窗 + 保存设置）与 `src/state/useDevHaven.ts`（`updateSettings` 持久化到 `app_state.json`）
- 终端主题配色（Ghostty 风格 `light:xxx,dark:yyy`）：`src/themes/terminalThemes.ts`、`src/hooks/useSystemColorScheme.ts`、`src/components/terminal/*`

## 3) 回写（维护）AGENTS.md 的逻辑

本文件是“给 LLM/新同学看的项目索引”，要求随代码演进同步更新（回写）。

### 触发回写的场景（满足任一就需要更新本文件）
- 新增/删除/重命名用户可见功能（UI、弹窗、窗口、入口按钮、菜单项等）。
- 新增/删除/重命名 Tauri Command（`src-tauri/src/lib.rs` 的 `#[tauri::command]` 或 `invoke_handler!` 列表变更）。
- 新增/删除/重命名前端 service（`src/services/*` 的 `invoke(...)` 包装、事件名、窗口 label）。
- 变更本地存储结构/文件名/目录（`src-tauri/src/storage.rs`、`~/.devhaven/*`）。
- 变更核心状态模型或持久化字段（`src/models/types.ts`、`src/state/useDevHaven.ts`）。
- 引入新的语言/框架/构建系统/关键依赖（例如新增后端服务、数据库、状态库、路由方案等）。

### 回写原则（怎么写）
- **不修改**受管块：`<!-- OPENSPEC:START --> ... <!-- OPENSPEC:END -->`（只允许在块外补充内容）。
- 以“功能 → 入口/UI → services → Rust 后端/Command”的链路补齐定位信息，至少给出 1 个关键文件路径。
- 新功能优先补到现有 A~K 模块；确实不适配再新增字母段落（保持顺序、命名清晰）。
- 涉及 Tauri 调用时，尽量在描述中点出 command 名称（例如 `collect_git_daily`），便于全局搜索对齐。
- 保持简洁：只写“能快速找到代码”的信息，不写大段实现细节；实现细节在对应源码内补注释/README。

### 快速定位约定（让回写更一致）
- 前端入口通常从 `src/App.tsx`（全局状态/弹窗/窗口联动）和 `src/components/*`（具体 UI）开始找。
- “调用后端”的入口优先在 `src/services/*` 搜 `invoke(` 或事件名，再去 `src-tauri/src/lib.rs` 找同名 command。
- “数据怎么落盘/缓存”优先看 `src-tauri/src/storage.rs`，前端只负责触发（`src/services/appStorage.ts`、`src/services/heatmap.ts`、`src/services/terminalWorkspace.ts` 等）。
