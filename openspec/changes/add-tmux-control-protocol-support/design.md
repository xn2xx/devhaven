## Context
tmux 控制模式协议支持 refresh-client -f/-A/-B，用于流控与订阅。当前实现仅支持 -C，同步尺寸但无法处理输出暂停和订阅。

## Goals / Non-Goals
- Goals:
  - 补齐控制模式协议的流控与订阅能力（-f/-A/-B）。
  - 在收到 %pause 时可恢复输出，避免控制通道卡死。
  - 将 %subscription-changed 透传给前端，便于后续功能接入。
- Non-Goals:
  - 不新增复杂 UI，仅提供 API 与运行时默认行为。
  - 不引入新外部依赖。

## Decisions
- 使用 refresh-client -f 设置控制模式 flags，默认启用 pause-after（数值在实现阶段确认）。
- 使用 refresh-client -A 控制 pane 输出状态；收到 %pause 后自动发送 continue。
- 使用 refresh-client -B 管理订阅；仅做通用 API 与事件透传，默认订阅可保持最小化。
- 所有控制命令优先走控制通道，失败时 fallback 到普通 tmux 命令执行。

## Risks / Trade-offs
- 过小的 pause-after 可能导致频繁暂停 → 通过可配置值与合理默认缓解。
- 控制命令超时会影响输出恢复 → 失败时自动 fallback 并标记控制通道健康度。

## Migration Plan
- 无数据迁移。
- 发布后自动生效，仅影响控制模式会话。

## Open Questions
- pause-after 的默认值是否使用 1s 还是更高？
- 是否需要预置订阅（例如 pane_current_path / pane_title）？
