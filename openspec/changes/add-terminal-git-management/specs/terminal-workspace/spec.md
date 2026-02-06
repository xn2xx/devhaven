## ADDED Requirements

### Requirement: Terminal Workspace Should Support Git Management Panel
系统 SHALL 在终端工作区提供一个 Git 管理面板，用于查看与管理当前项目的 Git 变更。

#### Scenario: 打开/关闭 Git 面板并记忆状态
- **GIVEN** 用户在终端工作区打开某项目
- **WHEN** 用户点击顶部栏的「Git」按钮
- **THEN** 系统显示/隐藏 Git 面板
- **AND** 系统记忆该项目的 Git 面板开关状态

#### Scenario: 非 Git 项目不显示 Git 入口
- **GIVEN** 当前项目没有 Git 管理
- **WHEN** 用户查看终端工作区顶部栏
- **THEN** 系统不展示「Git」按钮与 Git 面板相关 UI

### Requirement: Git Panel Should Show Changed Files By Category
系统 SHALL 在 Git 面板内按类别展示变更文件：已暂存（staged）、未暂存（unstaged）、未跟踪（untracked）。

#### Scenario: 展示 staged/unstaged/untracked 列表
- **GIVEN** 当前项目存在 Git 变更
- **WHEN** 用户打开 Git 面板
- **THEN** 系统展示 staged/unstaged/untracked 三类文件列表

### Requirement: Git Panel Should Support Stage/Unstage/Discard
系统 SHALL 支持在 Git 面板内对单文件执行：暂存、取消暂存、丢弃未暂存修改。

#### Scenario: 暂存未暂存文件
- **GIVEN** 某文件存在未暂存改动
- **WHEN** 用户在 Git 面板点击该文件的“暂存”
- **THEN** 系统将该文件加入 staged

#### Scenario: 取消暂存文件
- **GIVEN** 某文件已暂存
- **WHEN** 用户在 Git 面板点击该文件的“取消暂存”
- **THEN** 系统将该文件从 staged 移除

#### Scenario: 丢弃未暂存修改需要确认
- **GIVEN** 某文件存在未暂存改动
- **WHEN** 用户在 Git 面板点击该文件的“丢弃修改”
- **THEN** 系统要求用户二次确认
- **AND** 确认后系统丢弃该文件的未暂存修改

### Requirement: Git Panel Should Support Diff Preview
系统 SHALL 支持在 Git 面板内查看单文件 diff（staged 或 unstaged）。

#### Scenario: 点击文件查看 diff
- **GIVEN** Git 面板展示了变更文件列表
- **WHEN** 用户点击某个变更文件
- **THEN** 系统展示该文件对应类别的 diff 内容

### Requirement: Git Panel Should Support Commit
系统 SHALL 支持在 Git 面板内输入提交信息并提交已暂存改动。

#### Scenario: 提交 staged 改动
- **GIVEN** 当前项目存在 staged 改动
- **WHEN** 用户输入提交信息并点击“提交”
- **THEN** 系统创建一次 Git commit
- **AND** Git 面板刷新并显示最新状态
