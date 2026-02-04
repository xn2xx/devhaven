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
