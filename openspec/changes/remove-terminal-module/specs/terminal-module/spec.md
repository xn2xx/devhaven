## REMOVED Requirements
### Requirement: Terminal module UI
**Reason**: 终端模块整体下线。
**Migration**: 移除 UI 页面、路由与入口，不提供替代功能。

#### Scenario: Terminal module is no longer accessible
- **WHEN** 用户尝试打开终端模块
- **THEN** 应用不再提供终端页面或入口

### Requirement: Project double-click opens terminal
**Reason**: 终端模块下线。
**Migration**: 双击项目不再触发终端相关行为。

#### Scenario: Double-click does nothing terminal-related
- **WHEN** 用户双击项目
- **THEN** 不会打开终端模块或切换到终端页面

### Requirement: Task completion navigates to terminal
**Reason**: 终端模块下线。
**Migration**: 任务完成后不再跳转终端。

#### Scenario: Task completion does not navigate
- **WHEN** 任务完成
- **THEN** 应用不会自动跳转到终端页面
