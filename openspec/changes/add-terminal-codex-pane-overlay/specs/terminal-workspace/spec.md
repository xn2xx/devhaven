## ADDED Requirements
### Requirement: Show Codex Model And Effort Overlay In Terminal Pane
系统 SHALL 在触发 Codex CLI 的终端 pane 右上角展示会话模型与推理强度信息。

#### Scenario: 在运行中的 Codex pane 显示 model/effort
- **GIVEN** 用户在某个终端 pane 中启动了 Codex CLI
- **WHEN** 系统能够将该 pane 与 Codex 会话精确匹配
- **THEN** 该 pane 右上角显示 Codex 浮层
- **AND** 浮层包含 `model` 与原始 `effort` 字段

#### Scenario: 非 Codex pane 不显示浮层
- **GIVEN** 终端工作区中存在未运行 Codex 的 pane
- **WHEN** 用户查看该 pane
- **THEN** 该 pane 不显示 Codex model/effort 浮层

#### Scenario: Codex 进程结束后浮层消失
- **GIVEN** 某 pane 已显示 Codex 浮层
- **WHEN** 对应 Codex 进程退出或不再与该 pane 匹配
- **THEN** 该 pane 的浮层自动消失
