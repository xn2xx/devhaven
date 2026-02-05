# terminal-workspace (Delta Spec)

## MODIFIED Requirements

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

