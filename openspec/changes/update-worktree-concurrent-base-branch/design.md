# Design: worktree 基线分支与项目内排队

## Context
现有流程在创建新分支 worktree 时默认以当前 `HEAD` 为起点，且同项目只允许一个进行中的创建任务。为了支持“从 develop 并行派生多个工作分支”的稳定流程，需要同时改造“创建语义”和“任务调度语义”。

## Goals
- 新建分支 worktree 时可显式指定基线分支，且创建结果与当前 `HEAD` 解耦。
- 同项目支持连续提交多个创建任务，系统自动串行执行。
- UI 默认路径与用户目标一致：优先引导“新建分支 + 基线分支”。
- 删除受管 worktree 时同步清理对应本地分支，避免残留分支造成语义偏差。

## Non-Goals
- 不做多项目全局优先级调度。
- 不改变 Git 对“同一分支只能在一个 worktree 检出”的底层约束。

## API / Model Changes
- `WorktreeInitStartRequest` 新增可选字段：`baseBranch?: string`。
- `ProjectWorktree` 新增可选字段：`baseBranch?: string`（用于复盘与重试）。
- 保持 command 名称不变，新增字段为向后兼容扩展。

## Start Point Resolution
仅在 `createBranch=true` 时生效：
1. 读取 `baseBranch`（空值按 UI 默认策略补齐）。
2. 优先尝试远端引用（如 `origin/<baseBranch>`）。
3. 若远端不可用或不存在，回退本地 `<baseBranch>`。
4. 均不可用时返回结构化错误，提示用户修正基线分支。

创建命令目标形式：
- `git worktree add -b <newBranch> <targetPath> <resolvedStartPoint>`

## Queueing Strategy
- 以 `project_key` 作为队列分片键。
- 每个项目维护一个 FIFO 队列，任意时刻仅有一个 active job。
- `start` 行为：
  - 请求入队并立即返回 jobId 与 `pending` 状态。
  - 若当前无 active job，立刻调度执行。
- `finalize` 行为：
  - 当前 job 完成后自动拉起下一 job。
- `cancel` 行为：
  - 未开始的 queued job：直接标记取消并从队列移除。
  - 正在执行的 job：设置 cancel flag，在步骤边界终止并清理。

## UI Behavior
- 创建弹窗默认切到“新建分支”。
- 基线分支默认规则：
  - 分支列表含 `develop` 时默认 `develop`。
  - 否则使用仓库默认主分支。
- 显示任务状态：
  - 队列中：`排队中`
  - 执行中：`创建中`

## Worktree 删除与分支清理
- 仅当 worktree 记录来源于“新建分支模式”（即存在 `baseBranch` 元数据）时，删除流程追加本地分支删除。
- 删除顺序：
  1. 执行 `git worktree remove`（失败时可按现有流程选择强制删除或仅移除记录）。
  2. 仅在步骤 1 成功后执行 `git branch -d <branch>`。
- 失败策略：
  - `git branch -d` 失败不会回滚 worktree 删除结果。
  - 前端提示“worktree 已删除，但分支删除失败”，并展示原始错误信息。
- 非目标范围：
  - 不自动执行 `git branch -D`。
  - 不删除远端分支。

## Risks & Mitigations
- 风险：字段扩展导致旧缓存解析失败。
  - 规避：全部新增字段设为可选并提供默认值路径。
- 风险：队列与取消并发下状态错乱。
  - 规避：所有队列变更统一在同一把运行时锁内完成，并补单元测试。
