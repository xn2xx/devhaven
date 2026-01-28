## Context

- Codex CLI 会话文件存放在 ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl。
- 每个 JSONL 文件首行是 session_meta，包含会话 id、cwd、cli_version 等信息。
- 对话内容与状态以 event_msg 记录，常见类型包括 user_message 与 agent_message，并携带 timestamp。

## Goals / Non-Goals

### Goals
- 解析 Codex 会话文件并生成可展示的会话摘要。
- 在 UI 中近实时刷新会话状态与最近对话。
- 点击会话时可切换到已有工作区标签，或自动创建新的工作区会话。

### Non-Goals
- Claude Code 或其他 CLI 的解析与展示。
- 会话内容的全文索引与搜索。
- 对会话文件进行写入或修改。

## Decisions

- 采用前端轮询方式获取会话列表，默认刷新间隔 2 秒，避免引入文件监听依赖。
- 仅解析 session_meta 与 event_msg 的必要字段，保持解析成本可控。
- 运行态判定使用最后活动时间窗口（默认 15 秒），以最近一次事件时间为准。
- 只展示运行中会话，且仅扫描当日/昨日目录并跳过最近 5 分钟外的会话文件。

## Data Model

CodexSessionSummary 建议包含：
- id
- cwd
- startedAt
- lastActivityAt
- isRunning
- lastUserMessage
- lastAgentMessage
- messageCounts（user/agent）

## Parsing Strategy

- 会话发现：从用户主目录定位 ~/.codex/sessions，递归扫描 rollout-*.jsonl。
- 元数据：读取首行 session_meta，获取 id、cwd、cli_version 等。
- 最近活动：读取文件末尾最近 N 行（建议 200 行），解析 timestamp 与 event_msg。
- 消息预览：只保留最近一条 user_message 与 agent_message。
- 容错：解析失败的行跳过，不阻断整体列表输出。

## Project Mapping

- 使用 cwd 与项目路径匹配：优先选择路径前缀匹配且最长的项目。
- 未匹配时标记为未关联，并在 UI 中禁用跳转按钮或提示。

## UI

- 在侧栏新增常驻 CLI 会话区块，仅展示运行中会话与状态。
- 会话列表展示：状态、项目名、cwd、最近消息、最后活动时间。
- 点击会话：若匹配项目则调用现有工作区进入逻辑，若工作区已存在则切换激活。

## Refresh Strategy

- UI 使用轮询调用 list_codex_sessions。
- 若列表为空或目录不存在，显示空状态与引导提示。

## Risks / Trade-offs

- 轮询在会话文件较多时可能产生 IO 压力，需要控制扫描范围与尾部读取行数。
- 运行态判定为时间窗启发式，可能出现短暂误判。

## Migration Plan

- 无需迁移数据，功能上线即生效。

## Open Questions

- 活跃时间窗是否需要放入设置，默认 15 秒是否合适。
