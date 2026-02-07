# Change: 优化终端 worktree 并行开发流程（基线分支 + 任务排队）

## Why
当前终端 worktree 创建流程在“并行从 develop 派生多个分支”场景下存在四个问题：

1. 缺少显式“基线分支”概念，新建分支默认以当前 `HEAD` 为起点，无法稳定表达“统一从 develop 派生”。
2. 同一项目一次只能启动一个创建任务，后续请求会直接失败，批量并行准备分支的操作成本较高。
3. 创建入口默认偏向“已有分支”，容易误操作为直接检出 `develop`，触发 Git 的“同一分支不可在多个 worktree 同时检出”限制。
4. 删除 worktree 后默认不会清理对应本地分支，导致“受管创建”的生命周期不闭环。

上述问题会导致用户需要频繁手动回退到外部终端处理分支基线与任务顺序，影响并行开发效率。

## What Changes
- 在 worktree 创建链路中引入 `baseBranch`（基线分支）参数：
  - 创建新分支时，系统显式从 `baseBranch` 解析起点并创建 worktree。
  - 基线分支支持远端优先、本地回退的解析策略，并提供可读错误信息。
- 将同一项目的 worktree 初始化从“有任务即拒绝”改为“按项目排队执行”：
  - 多次创建请求可连续提交。
  - 同一项目内任务按提交顺序串行执行，避免 Git 锁冲突。
- 优化创建对话框交互，默认引导“新建分支 + 基线分支”：
  - 默认模式改为“新建分支”。
  - 增加基线分支选择（优先 `develop`，不存在时回退仓库默认主分支）。
  - “已有分支”保留在高级模式中。
- 扩展 worktree 创建与状态元数据，确保字段可持久化且兼容旧数据。
- 补齐删除流程闭环：对“新建分支模式”创建的 worktree，删除成功后追加本地 `git branch -d`。

## Out of Scope
- 自动合并回 `develop`、自动 PR 创建、自动冲突解决。
- 跨仓库级别的全局并发调度（本次仅限“同项目”排队）。
- 变更现有 `git_worktree_add/git_worktree_list/git_worktree_remove` command 名称。
- 自动强删本地分支（`git branch -D`）或删除远端分支。

## Impact
- Affected specs: `terminal-workspace`
- Affected backend files:
  - `src-tauri/src/models.rs`
  - `src-tauri/src/worktree_init.rs`
  - `src-tauri/src/git_ops.rs`
  - `src-tauri/src/lib.rs`
- Affected frontend files:
  - `src/components/terminal/WorktreeCreateDialog.tsx`
  - `src/services/gitWorktree.ts`
  - `src/services/worktreeInit.ts`
  - `src/App.tsx`
  - `src/models/types.ts`
- Storage impact:
  - `projects.json` 中 `Project.worktrees[*]` 可能新增 `baseBranch` 字段（可选，向后兼容）
- Verification impact:
  - 需补充 Rust 单元测试覆盖“显式基线分支创建”与“同项目任务排队”。
