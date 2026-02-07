## Context
DevHaven 通过 Tauri Commands 调用本地能力。终端工作区已具备“已打开项目列表”的 UI 与项目持久化（`projects.json`），并已有 Git 能力（`list_branches`、`git_is_repo`、Git 面板 commands）。

本变更需要在“终端工作区已打开项目”场景里，提供创建 Git worktree 的能力，并保证创建后的 worktree 作为源项目的子项被记录与持久化。

## Goals / Non-Goals
- Goals:
  - 在终端工作区对已打开项目提供创建 worktree 的入口与对话框。
  - 支持选择已有分支/新建分支创建 worktree。
  - 创建成功后将 worktree 作为源项目的子项持久化，并可选在终端内打开验证。
  - worktree 作为子项不污染主项目列表：扫描/构建项目列表时过滤 worktree 目录，且主列表 UI 不展示 worktree。
- Non-Goals:
  - 完整 worktree 生命周期管理（list/remove/prune/lock）。
  - 自动处理 dev server 端口冲突。

## Decisions
- Decision: worktree 作为 Project 的子项持久化（`Project.worktrees`）
  - Why: worktree 在 Git 语义上是同一仓库的另一份工作目录，用户更希望“主项目 + 子 worktree”结构，避免主列表膨胀；同时可复用源项目的 tags/scripts。
- Decision: 终端工作区“打开 worktree”使用虚拟条目（不要求 worktree 出现在全局 projects 列表）
  - Why: 终端工作区渲染与 workspace 持久化以 `projectPath` 为核心；worktree 只要有 path/name/scripts 即可运行，没必要强制成为顶层 Project。
- Decision: worktree 打开时默认继承父项目的 tags/scripts
  - Why: worktree 用于同仓并行开发，默认复用命令和标签符合心智，且可减少额外配置项。
- Decision: worktree 目标路径采用固定目录策略
  - Why: 避免“创建新工程”的感知，统一目录结构并减少路径输入出错。
  - Details: 后端自动计算路径 `~/.devhaven/worktrees/<projectName>/<branch>`；若父目录不存在自动创建。
- Decision: 支持读取并打开已存在 worktree（非新建）
  - Why: 用户可能已在外部创建过 worktree，应用应支持“导入并直接打开”而非强制重复创建。
  - Details: 后端通过 `git worktree list --porcelain` 返回可用 worktree，前端选择后写入 `Project.worktrees` 并可选自动打开。
- Decision: 新建分支模式默认以当前 `HEAD` 为起点
  - Why: `git worktree add -b <new-branch>` 的默认语义就是从当前检出提交创建分支，符合 Git 原生行为且避免额外推断 main/master。
  - Details: 不额外要求用户选择 base branch；若后续有需求，再扩展“从指定基线创建”。
- Decision: `Project.worktrees` 采用稳定最小 schema，便于兼容与去重
  - Why: 该字段会落盘到 `projects.json` 并被前后端共同读写，需要明确最小字段，避免实现阶段出现不一致。
  - Details: 子项结构最少包含 `id/name/path/branch/inheritConfig/created`；以 `path` 作为幂等去重键。

## Risks / Trade-offs
- 风险：目标目录已存在、分支已被其他 worktree 检出等错误信息偏技术化
  - Mitigation：后端对常见错误做 message 归一化；前端在对话框中展示可读提示并保持可重试。
- 风险：worktree 项目增多导致项目列表冗余
  - Mitigation：worktree 作为子项展示，并在终端工作区按父项目分组；后续可扩展更完整的管理能力（本次不做）。

## Migration Plan
无数据迁移：为 `Project` 增加可选 `worktrees` 字段（`serde(default)`），旧数据自动兼容。worktree 目录不再作为顶层项目出现在扫描结果中。

## Open Questions
当前无阻塞开发的开放问题。
