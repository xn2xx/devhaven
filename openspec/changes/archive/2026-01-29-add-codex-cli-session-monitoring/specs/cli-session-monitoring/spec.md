## ADDED Requirements

### Requirement: Codex 会话发现与解析

系统应当(SHALL)扫描用户主目录下的 ~/.codex/sessions，并解析 rollout-*.jsonl 生成会话摘要。

#### Scenario: 会话文件存在
- **WHEN** 用户打开 CLI 会话面板
- **THEN** 系统应当扫描 ~/.codex/sessions 中的 JSONL 会话文件
- **AND** 每个会话应当解析出 id、cwd、开始时间与最后活动时间
- **AND** 最近消息应当来自 event_msg 的 user_message 与 agent_message

#### Scenario: 无会话文件
- **WHEN** 会话目录不存在或为空
- **THEN** 系统应当显示空状态并提示未发现 Codex 会话

### Requirement: 会话运行态判定

系统应当(SHALL)基于会话文件中的最后活动时间判定运行态。

#### Scenario: 活跃会话
- **WHEN** 会话最后活动时间距当前不超过 15 秒
- **THEN** 系统应当将该会话标记为运行中

#### Scenario: 非活跃会话
- **WHEN** 会话最后活动时间距当前超过 15 秒
- **THEN** 系统应当将该会话标记为已空闲

### Requirement: 实时对话刷新

系统应当(SHALL)以固定间隔刷新会话状态与最近对话内容。

#### Scenario: 对话有新消息
- **WHEN** 会话文件新增 user_message 或 agent_message
- **THEN** UI 应当在下一次刷新时展示最新消息摘要
- **AND** 最后活动时间应当同步更新

### Requirement: 仅展示运行会话

系统应当(SHALL)仅展示运行中的 Codex 会话。

#### Scenario: 会话运行中
- **WHEN** 会话被判定为运行中
- **THEN** 会话应当出现在侧栏会话列表中

#### Scenario: 会话已空闲
- **WHEN** 会话被判定为空闲
- **THEN** 会话不应当出现在侧栏会话列表中

### Requirement: 工作区标签联动

系统应当(SHALL)允许用户从会话列表跳转到对应项目的工作区标签。

#### Scenario: 工作区已存在
- **WHEN** 用户点击一个已关联项目的会话
- **THEN** 系统应当切换到该项目的工作区标签

#### Scenario: 工作区不存在
- **WHEN** 用户点击一个已关联项目但尚未打开工作区的会话
- **THEN** 系统应当自动创建该项目的工作区会话并激活
