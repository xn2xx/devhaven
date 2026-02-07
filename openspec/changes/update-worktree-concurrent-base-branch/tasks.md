## 1. 后端（Rust/Tauri）
- [x] 1.1 扩展 worktree 初始化请求模型：为创建新分支场景增加 `baseBranch` 字段（保持向后兼容）
- [x] 1.2 在 `git_ops` 增加“显式起点”创建能力，使 `git worktree add -b <newBranch> <path> <startPoint>` 成为可选路径
- [x] 1.3 实现基线分支解析策略（远端优先、本地回退、失败报错）并接入 `worktree_init_start`
- [x] 1.4 将同项目创建任务由“互斥拒绝”改为“项目内排队执行”，并保证取消/失败后队列可继续推进
- [x] 1.5 增加测试：覆盖显式基线分支创建、基线不存在时错误、同项目多任务排队顺序
- [x] 1.6 增加本地分支删除能力（`git branch -d`），并暴露 Tauri command 供前端调用

## 2. 前端（React）
- [x] 2.1 更新 `WorktreeCreateDialog`：默认“新建分支”模式，新增基线分支选择器
- [x] 2.2 基线分支默认值策略：优先 `develop`，否则回退仓库默认主分支
- [x] 2.3 更新 `worktreeInitStart` 调用参数与类型定义，透传 `baseBranch`
- [x] 2.4 更新创建中状态文案，明确展示“排队中/执行中”区别
- [x] 2.5 在删除 worktree 成功后，针对“新建分支模式”记录追加删除本地分支，并在失败时提示但不回滚 worktree 删除

## 3. 状态与持久化
- [x] 3.1 扩展 `ProjectWorktree` 模型（可选 `baseBranch`），并保证旧缓存可无缝加载
- [x] 3.2 在创建成功后保存 `baseBranch`，用于后续重试与排障

## 4. 文档与校验
- [x] 4.1 更新根目录 `AGENTS.md` 的 worktree 功能地图（新增基线分支与排队行为说明）
- [x] 4.2 运行 `openspec validate update-worktree-concurrent-base-branch --strict` 并修复全部校验问题
- [x] 4.3 更新变更 spec：补充“受管 worktree 删除需同步删除本地分支”的行为约束
