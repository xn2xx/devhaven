# terminal-workspace Specification

## Purpose
定义终端工作区（Terminal Workspace）中“已打开项目”的管理行为：关闭项目、激活项目切换，以及关闭时清理该项目的终端工作区持久化数据（tabs/panes/sessions）。
## Requirements
### Requirement: Close Open Project In Terminal Workspace
系统 SHALL 支持在终端工作区的“已打开项目”列表中关闭某个项目。

#### Scenario: 关闭非激活项目
- **GIVEN** 终端工作区中已打开多个项目
- **WHEN** 用户在“已打开项目”列表中点击某项目的关闭按钮
- **THEN** 该项目从列表中移除
- **AND** 其他项目保持可用

#### Scenario: 关闭激活项目
- **GIVEN** 终端工作区中已打开多个项目且其中一个为激活项目
- **WHEN** 用户关闭当前激活项目
- **THEN** 系统切换到剩余项目中的一个作为新的激活项目

### Requirement: Delete Terminal Workspace Session Data On Close
系统 SHALL 在关闭项目时删除该项目的终端工作区持久化数据（tabs/panes/sessions）。

#### Scenario: 关闭后不再恢复旧会话
- **GIVEN** 某项目存在已保存的终端工作区数据
- **WHEN** 用户关闭该项目
- **THEN** 系统删除该项目对应的终端工作区持久化记录
- **AND** 用户重新打开该项目时使用默认工作区布局

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

### Requirement: Terminal Workspace Should Support Quick Commands Panel
系统 SHALL 在终端工作区提供一个右侧快捷命令悬浮窗，展示当前项目的快捷命令列表，并支持运行/停止。

#### Scenario: 右侧悬浮窗运行命令
- **GIVEN** 终端工作区已打开某项目且该项目配置了快捷命令
- **WHEN** 用户在右侧悬浮窗点击某命令“运行”
- **THEN** 系统新建 Tab 并在终端执行该命令

#### Scenario: 悬浮窗可拖拽并记忆位置
- **GIVEN** 终端工作区右侧快捷命令悬浮窗已显示
- **WHEN** 用户拖拽悬浮窗到新位置并关闭/切换项目
- **THEN** 系统记住该项目的悬浮窗位置与开关状态

