## 1. Backend（Rust/Tauri）
- [x] 1.1 在 `src-tauri/src/git_ops.rs`（或新增 `git_worktree.rs`）实现 `git worktree add` 封装，返回创建后的 worktree 路径或错误信息
- [x] 1.2 在 `src-tauri/src/lib.rs` 增加 `#[tauri::command] git_worktree_add(...)` 并加入 `invoke_handler!`
- [x] 1.3 （可选）为 worktree add 的参数校验与常见错误（分支已被检出/目标目录已存在/非 Git 仓库）提供更友好的错误信息
- [x] 1.4 增加基础测试（在临时目录 init 一个 git repo，验证 worktree 创建成功；或至少覆盖参数校验与错误分支）
- [x] 1.5 在 `src-tauri/src/project_loader.rs` 增加 Git worktree 目录识别（读取 `.git` 文件的 `gitdir:` 指向，判断是否包含 `worktrees`），并在扫描时过滤 worktree 目录，避免作为顶层项目返回
- [x] 1.6 新增 `git_worktree_list`（`git worktree list --porcelain`），用于读取仓库已存在 worktree
- [x] 1.7 新增 `git_worktree_remove`（`git worktree remove`），用于删除 worktree（支持 `--force`），并补充基础测试

## 2. Frontend（React）
- [x] 2.1 新增 service：`src/services/gitWorktree.ts`，封装 `invoke("git_worktree_add")`
- [x] 2.2 新增 UI：`src/components/terminal/WorktreeCreateDialog.tsx`（分支模式、目标路径、选项、loading/error）
- [x] 2.3 在 `src/components/terminal/TerminalWorkspaceWindow.tsx` 为项目行增加「创建 worktree」入口，并展示 worktrees 子列表（缩进/分组）
- [x] 2.4 在 `src/App.tsx`（或终端窗口组件）接入创建逻辑：创建成功后把 worktree 写入源项目的 `worktrees` 并可选打开
- [ ] 2.5（可选）当用户从主界面“直接添加项目路径”选择了 worktree 目录时，前端给出提示并避免将其作为顶层项目加入（建议引导到父项目的 worktree 管理）
- [x] 2.6 支持“打开已有 worktree”：读取仓库 worktree 列表，选择后加入父项目子项并可选直接打开
- [x] 2.7 worktree 子项支持删除：二次确认后删除（必要时先关闭已打开 worktree 终端），失败时支持提示与强制删除/仅移除记录兜底
- [x] 2.8 worktree 列表自动同步：终端工作区展示时从 `git worktree list` 同步父项目 `worktrees` 记录（补录/更新/移除）

## 3. 状态与持久化
- [x] 3.1 扩展 `Project` 模型：新增 `worktrees`（`src/models/types.ts`、`src-tauri/src/models.rs`），并确保 JSON 兼容（默认空数组）
  - 子项 schema 最少包含：`id`、`name`、`path`、`branch`、`inheritConfig`、`created`
  - 约束：以 `path` 作为幂等去重键（同一路径重复创建时更新而非追加）
- [x] 3.2 在 `src-tauri/src/project_loader.rs` 构建项目时复用 `existing.worktrees`（类似 tags/scripts），避免刷新/重建丢失 worktree 列表
- [x] 3.3 在 `src/state/useDevHaven.ts` 增加 action：为指定项目新增/删除 worktree 子项并持久化到 `projects.json`
- [x] 3.4 worktree 子项在终端打开时默认继承源项目的 `tags` 与 `scripts`（本次不做每个 worktree 独立配置）
- [x] 3.5 新增 action：根据 `git_worktree_list` 的结果对指定项目 worktrees 做一次性同步（避免多次写盘）

## 4. 文档回写
- [x] 4.1 更新仓库根 `AGENTS.md`：补充 worktree 功能入口、service 与 Tauri command 定位信息

## 5. 交互默认值（本变更需落地）
- [x] 5.1 创建对话框目录策略改为固定路径：`~/.devhaven/worktrees/<projectName>/<branch>`（无需手填）
- [x] 5.2 新建分支默认基线：使用当前 `HEAD`（与 `git worktree add -b` 默认行为一致）
