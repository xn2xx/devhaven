## ADDED Requirements

### Requirement: Worktree Creation Should Support Explicit Base Branch For New Branch Mode
系统 SHALL 在“新建分支”创建 worktree 时支持显式基线分支，并基于该基线创建目标分支。

#### Scenario: 从 develop 派生多个新分支
- **GIVEN** 源仓库存在 `develop` 分支
- **WHEN** 用户连续创建 `feature/a` 与 `feature/b` 两个新分支 worktree，并将基线分支设为 `develop`
- **THEN** 系统分别创建两个 worktree
- **AND** 两个目标分支都以 `develop` 作为创建起点

#### Scenario: 基线分支不可用时阻止创建
- **GIVEN** 用户在“新建分支”中指定了不存在的基线分支
- **WHEN** 系统执行创建前校验
- **THEN** 系统阻止创建并返回“基线分支不可用”的错误提示

### Requirement: Worktree Init Jobs Should Queue Per Project
系统 SHALL 支持同一项目内多个 worktree 创建任务排队，并按提交顺序执行。

#### Scenario: 同项目连续提交多个创建请求
- **GIVEN** 用户在同一项目内先后提交多个 worktree 创建请求
- **WHEN** 第一个请求正在执行
- **THEN** 后续请求进入队列而非直接失败
- **AND** 当前任务完成后系统自动执行下一任务

#### Scenario: 排队任务可取消
- **GIVEN** 某创建请求处于排队状态且尚未执行
- **WHEN** 用户取消该请求
- **THEN** 系统将该请求从队列移除
- **AND** 不影响其他排队任务继续执行

### Requirement: Worktree Create Dialog Should Default To Parallel Branch Workflow
系统 SHALL 在创建对话框中默认引导“新建分支 + 基线分支”的并行开发流程。

#### Scenario: 默认值优先 develop
- **GIVEN** 源仓库分支列表包含 `develop`
- **WHEN** 用户打开创建 worktree 对话框
- **THEN** 对话框默认模式为“新建分支”
- **AND** 基线分支默认选中 `develop`

#### Scenario: develop 不存在时回退默认主分支
- **GIVEN** 源仓库分支列表不包含 `develop`
- **WHEN** 用户打开创建 worktree 对话框
- **THEN** 对话框将基线分支默认设置为仓库默认主分支

### Requirement: Managed Worktree Removal Should Also Delete Local Branch
系统 SHALL 在删除“新建分支模式”创建的 worktree 时，一并删除对应本地分支，避免分支残留。

#### Scenario: 删除受管 worktree 时同步删除分支
- **GIVEN** 某 worktree 由“新建分支 + 基线分支”流程创建
- **WHEN** 用户在终端工作区删除该 worktree
- **THEN** 系统先执行 `git worktree remove`
- **AND** 成功后继续执行本地 `git branch -d <branch>`

#### Scenario: 分支删除失败时保留 worktree 删除结果
- **GIVEN** worktree 删除成功但分支删除失败（例如分支仍被占用）
- **WHEN** 系统完成删除流程
- **THEN** 系统仍保留“worktree 已删除”的结果
- **AND** 向用户提示分支删除失败原因
