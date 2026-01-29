## MODIFIED Requirements

### Requirement: 实时对话刷新

系统应当(SHALL)在检测到会话文件变更时即时刷新会话状态与最近对话内容，并保留低频轮询作为兜底。

#### Scenario: 会话文件发生变更
- **WHEN** 监听到 ~/.codex/sessions 下的 JSONL 文件新增、修改或删除
- **THEN** 系统应当在短时间内推送最新会话摘要到 UI
- **AND** UI 应当更新最近消息与最后活动时间

#### Scenario: 文件监听异常
- **WHEN** 文件监听不可用或启动失败
- **THEN** 系统应当继续以固定间隔轮询刷新会话状态
