## ADDED Requirements
### Requirement: Terminal module removed
The system SHALL NOT provide any terminal module UI, routes, or entry points.

#### Scenario: Terminal module is unavailable
- **WHEN** 用户尝试打开终端模块
- **THEN** 应用不再提供终端页面或入口

### Requirement: Project double-click does not open terminal
The system SHALL NOT open a terminal view when a project card is double-clicked.

#### Scenario: Double-click does nothing terminal-related
- **WHEN** 用户双击项目
- **THEN** 不会打开终端模块或切换到终端页面

### Requirement: Task completion does not navigate to terminal
The system SHALL NOT navigate to a terminal view when tasks complete.

#### Scenario: Task completion does not navigate
- **WHEN** 任务完成
- **THEN** 应用不会自动跳转到终端页面
