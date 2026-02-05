## ADDED Requirements

### Requirement: Show Codex Running Status In Terminal Workspace
系统 SHALL 在终端工作区中对每个已打开项目展示 Codex CLI 的运行状态。

#### Scenario: 项目存在运行中会话时显示标识
- **GIVEN** 终端工作区中已打开某项目
- **AND** 该项目路径下存在运行中的 Codex 会话（session.isRunning=true 且 session.cwd 归属到该项目）
- **WHEN** 用户查看终端工作区
- **THEN** 顶部栏显示 “Codex 运行中” 标识
- **AND** 左侧“已打开项目”列表该项目行显示 Codex 标识

#### Scenario: 会话结束后标识消失
- **GIVEN** 之前该项目存在运行中的 Codex 会话
- **WHEN** 会话不再活跃并被系统判定为非运行中
- **THEN** 顶部与列表的 Codex 标识不再显示

