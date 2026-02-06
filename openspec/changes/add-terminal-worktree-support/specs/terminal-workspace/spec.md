## ADDED Requirements

### Requirement: Terminal Workspace Should Support Creating Git Worktree For Open Project
系统 SHALL 允许用户在终端工作区左侧「已打开项目」列表中，为某个项目创建新的 Git worktree，并将其作为该项目的子项展示与持久化。

#### Scenario: 打开创建 worktree 对话框
- **GIVEN** 终端工作区已打开至少一个项目
- **WHEN** 用户在某项目行选择“创建 worktree”
- **THEN** 系统展示创建 worktree 的对话框
- **AND** 对话框展示源项目路径与分支选择，并提示固定目录策略

#### Scenario: 创建成功后加入项目并可选打开
- **GIVEN** 用户在对话框中选择或填写了合法的分支
- **WHEN** 用户确认创建且 `git worktree add` 执行成功
- **THEN** 系统将新 worktree 路径记录为该项目的 worktree 子项并持久化
- **AND** 若用户勾选“创建后打开”，系统在终端工作区打开该 worktree 并设为激活

#### Scenario: 非 Git 项目不可创建 worktree
- **GIVEN** 用户选择的源项目不是 Git 仓库
- **WHEN** 用户尝试创建 worktree
- **THEN** 系统阻止该操作并提示原因

### Requirement: Worktree Should Not Appear As Top-Level Project
系统 SHALL 不在主项目列表中展示 Git worktree 目录（worktree 仅作为父项目的子项呈现）。

#### Scenario: 扫描项目时过滤 worktree 目录
- **GIVEN** 用户的工作目录扫描范围内包含 Git worktree 目录
- **WHEN** 系统扫描并构建项目列表
- **THEN** 系统不将该 worktree 目录作为顶层项目展示

### Requirement: Worktree Creation Should Support Existing Or New Branch
系统 SHALL 支持以“已有分支”或“新建分支”的方式创建 worktree。

#### Scenario: 使用已有分支创建 worktree
- **GIVEN** 源项目为 Git 仓库且存在目标分支
- **WHEN** 用户选择“已有分支”并指定分支名创建 worktree
- **THEN** 系统创建 worktree 并检出该分支

#### Scenario: 新建分支创建 worktree
- **GIVEN** 源项目为 Git 仓库
- **WHEN** 用户选择“新建分支”并输入新分支名创建 worktree
- **THEN** 系统创建 worktree 并创建/检出该新分支

### Requirement: Worktree Target Path Should Use Fixed Strategy
系统 SHALL 使用固定目录策略创建 worktree 路径，规则为 `~/.devhaven/worktrees/<projectName>/<branch>`。

#### Scenario: 目标路径由系统自动计算
- **GIVEN** 用户在创建 worktree 对话框中确认分支
- **WHEN** 系统发起 worktree 创建
- **THEN** 系统自动计算目标路径，无需用户输入父目录或目录名
- **AND** 若目标父目录不存在，系统自动创建必要目录

### Requirement: Terminal Workspace Should Support Opening Existing Worktree
系统 SHALL 支持在终端工作区读取仓库已存在的 worktree，并将其加入父项目子项后可选打开。

#### Scenario: 选择并打开已有 worktree
- **GIVEN** 该 Git 仓库已经存在至少一个非主仓库 worktree
- **WHEN** 用户在弹窗切换到“打开已有 worktree”并确认
- **THEN** 系统展示可选 worktree 列表并允许选择
- **AND** 系统将选中的 worktree 记录到父项目 `worktrees` 子项（按 `path` 幂等）
- **AND** 若用户勾选“完成后打开”，系统在终端工作区直接打开该 worktree

### Requirement: Worktree Child Should Inherit Source Project Config
系统 SHALL 在终端打开 worktree 时默认继承源项目的标签与快捷命令。

#### Scenario: 打开 worktree 时复用父项目 tags/scripts
- **GIVEN** 用户已成功创建并打开某个 worktree
- **WHEN** 终端工作区初始化该 worktree
- **THEN** 系统使用父项目的 `tags` 与 `scripts` 作为默认配置

### Requirement: Worktree Metadata Should Persist With Stable Minimal Schema
系统 SHALL 以稳定且可兼容的最小元数据结构持久化 worktree 子项，确保刷新、重启与重建项目列表后不丢失。

#### Scenario: 创建成功后写入最小字段
- **GIVEN** 用户成功创建了一个 worktree
- **WHEN** 系统将该 worktree 作为父项目子项落盘到 `projects.json`
- **THEN** 子项至少包含 `id`、`name`、`path`、`branch`、`inheritConfig`、`created`
- **AND** 若同一路径重复写入，系统按 `path` 幂等更新而非重复追加

#### Scenario: 旧缓存缺失 worktrees 字段时兼容加载
- **GIVEN** 用户本地 `projects.json` 为旧版本且项目对象没有 `worktrees` 字段
- **WHEN** 系统读取并构建项目列表
- **THEN** 系统按空列表处理并继续正常运行
