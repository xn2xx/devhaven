# 终端 Worktree 创建链路改造（对齐 Superset）实施文档

## 1. 背景与目标

DevHaven 当前已具备 worktree 的创建/打开/删除能力，但创建流程原本是同步阻塞式（前端等待 `git worktree add` 完成）。

参考 `superset/` 的做法，目标是把“创建工作区”升级为“快速返回 + 后台初始化 + 进度驱动 UI”，并统一创建弹窗的交互心智。

本实施文档覆盖：
- 一期（已落地）：后台初始化主链路 + 状态机 + 重试/取消。
- 二期（规划中）：弹窗与初始化体验进一步对齐 Superset、增强恢复与可观测性。

## 2. Superset 对齐基线（调研结论）

关键参考点：
- `superset/apps/desktop/src/lib/trpc/routers/workspaces/procedures/create.ts`
  - 创建接口快速写入 workspace/worktree 记录并返回 `isInitializing`。
- `superset/apps/desktop/src/main/lib/workspace-init-manager.ts`
  - 内存态 init manager，提供进度事件、取消、项目级互斥锁。
- `superset/apps/desktop/src/lib/trpc/routers/workspaces/utils/workspace-init.ts`
  - 后台初始化分步骤执行（sync / verify / create_worktree / copy_config / finalizing）。
- `superset/apps/desktop/src/renderer/stores/workspace-init.ts`
  - 前端独立 progress store，渲染 pending/failed/ready。

可迁移原则：
1. 创建入口“快返回”，耗时动作放后台。
2. 进度模型标准化（step + message + error）。
3. 失败可重试、进行中可取消。
4. 项目级并发互斥，避免 Git 锁冲突。
5. 重启场景提供恢复策略（至少可判定 ready/failed）。

## 3. DevHaven 全链路架构（目标态）

### 3.1 前端层

- 弹窗提交：`src/components/terminal/WorktreeCreateDialog.tsx`
  - `mode=create`：只发起后台任务，不阻塞等待实际创建。
  - `mode=open-existing`：直接登记为 ready。
- 编排与状态更新：`src/App.tsx`
  - 接收创建请求，写入 `Project.worktrees[]` 的创建态。
  - 监听 `worktree-init-progress` 事件，驱动 creating/failed/ready 变更。
  - 支持重试、取消、删除创建中条目。
- 展示：`src/components/terminal/TerminalWorkspaceWindow.tsx`
  - 子项显示状态（创建中/失败）。
  - creating 禁止打开；failed 提供“重试”。

### 3.2 服务层

- `src/services/worktreeInit.ts`
  - `worktreeInitStart`
  - `worktreeInitCancel`
  - `worktreeInitRetry`
  - `worktreeInitStatus`
  - `listenWorktreeInitProgress`

### 3.3 后端层（Tauri/Rust）

- `src-tauri/src/worktree_init.rs`
  - 内存任务管理器（jobs + 项目级 running 锁）。
  - 任务阶段：`pending -> validating -> checking_branch -> creating_worktree -> syncing -> ready|failed|cancelled`。
  - 提供 start/cancel/retry/status。
- `src-tauri/src/lib.rs`
  - 命令注册：
    - `worktree_init_start`
    - `worktree_init_cancel`
    - `worktree_init_retry`
    - `worktree_init_status`
- `src-tauri/src/git_ops.rs`
  - 抽取 `resolve_worktree_target_path`，复用目标路径计算逻辑。

### 3.4 数据模型与持久化

- `src/models/types.ts`、`src-tauri/src/models.rs`
  - `ProjectWorktree` 扩展字段：
    - `status`
    - `initStep`
    - `initMessage`
    - `initError`
    - `initJobId`
    - `updatedAt`
- `src/state/useDevHaven.ts`
  - `addProjectWorktree/syncProjectWorktrees` 兼容并保留初始化状态字段。

## 4. 端到端时序

### 4.1 新建 worktree（create）

1. 弹窗提交 -> `worktree_init_start`。
2. 前端立即写入 creating 条目（带 `initJobId`）。
3. 后端后台执行 Git 步骤并持续发事件。
4. 前端监听事件并更新状态。
5. 到 ready 后触发同步，按用户选择自动打开。

### 4.2 打开已有 worktree（open-existing）

1. 弹窗选择已有 worktree。
2. 直接写入 ready 条目。
3. 可选立即打开。

### 4.3 失败重试

1. 子项状态为 failed。
2. 点击“重试” -> `worktree_init_retry(oldJobId)`。
3. 返回新 jobId，状态回到 creating。

### 4.4 创建中删除

1. 子项状态为 creating 时点击删除。
2. 弹确认“取消并移除”。
3. 调用 `worktree_init_cancel`，并移除本地条目。

### 4.5 重启恢复

1. 启动后扫描 `status=creating` 条目。
2. 对照 `git worktree list`：
   - 已存在 => 修正为 ready。
   - 不存在 => 修正为 failed（提示可重试）。

## 5. 一期实施范围（已完成）

- 后端新增后台初始化任务与 command 接口。
- 前端改造创建逻辑为“任务化”。
- 终端工作区列表支持创建中/失败状态与失败重试。
- 创建中条目支持取消并移除。
- 重启后 creating 条目恢复判定。
- `AGENTS.md` 功能地图已同步更新。

## 6. 二期实施规划（纳入本方案）

### 6.1 交互与弹窗对齐 Superset

1. 创建弹窗增加“初始化步骤预览区”（步骤文案与状态图标）。
2. 提交后支持在弹窗内显示实时进度（可关闭后在列表继续跟踪）。
3. 统一错误分层：参数错误 / Git 错误 / 环境错误（网络、权限、锁冲突）。
4. 新增“失败后一键复制诊断信息”。

### 6.2 状态持久化与恢复增强

1. 增加 `worktree_init_status` 的前端主动拉取恢复流程（事件补偿）。
2. 增加任务清理策略（如 ready/failed 的 TTL 清理）。
3. 评估将关键状态落盘（可选），降低重启后信息丢失。

### 6.3 初始化步骤扩展

1. 在 `creating_worktree` 后新增可选步骤：
   - `copying_config`（复制项目基础配置）
   - `finalizing`（初始化终端工作区状态）
2. 为每一步增加可观测日志字段（耗时、失败点）。

### 6.4 并发与可用性

1. 项目级互斥升级为“可观测锁队列”（显示前方任务数）。
2. 创建中与删除/关闭动作冲突时，统一策略（先 cancel，再执行后续动作）。

### 6.5 验收与回归

回归用例（一期+二期统一口径）：
- 新建分支创建成功。
- 已有分支创建成功。
- 创建失败后重试成功。
- 创建中取消成功。
- 创建中直接删除（触发取消）成功。
- 重启后 creating 正确恢复 ready/failed。
- 并发创建同一项目时，互斥生效且提示清晰。

## 7. 风险与应对

- 内存态任务在重启后丢失：
  - 一期已通过 Git 实际状态对账兜底；二期补事件补偿 + 可选持久化。
- Git 错误信息不稳定：
  - 后端统一错误归一化；前端分层展示。
- 并发冲突导致锁等待体验差：
  - 二期提供队列可视化与更明确提示。

## 8. 交付物映射

一期代码主文件：
- `src-tauri/src/worktree_init.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/models.rs`
- `src-tauri/src/git_ops.rs`
- `src/services/worktreeInit.ts`
- `src/App.tsx`
- `src/components/terminal/TerminalWorkspaceWindow.tsx`
- `src/models/types.ts`
- `src/state/useDevHaven.ts`
- `AGENTS.md`

二期将在当前文件集上增量演进，不破坏一期协议。
