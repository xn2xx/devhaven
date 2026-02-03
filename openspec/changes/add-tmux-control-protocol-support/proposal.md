# Change: Add tmux control mode protocol support

## Why
当前 tmux 控制模式只覆盖基础通知与输出解析，缺少流控与订阅能力，导致输出暂停后无法恢复、以及无法获得订阅格式变更通知。
需要补齐 refresh-client -f/-A/-B 的能力，确保控制模式协议完整可用。

## What Changes
- 新增控制模式客户端 flags 配置（refresh-client -f），默认启用 pause-after 以支持流控。
- 新增每个 pane 的流控动作（refresh-client -A），并在收到 %pause 后自动恢复输出。
- 新增订阅管理（refresh-client -B），支持添加/移除订阅并转发 %subscription-changed。
- 暴露新的前端 API 以配置 flags、流控与订阅。
- 控制模式初始化时自动设置默认 flags 并注册必要订阅（如有）。

## Impact
- Affected specs: terminal-control-mode
- Affected code: src-tauri/src/terminal.rs, src-tauri/src/lib.rs, src/models/terminal.ts, src/services/terminal.ts, src/hooks/useTmuxWorkspace.ts
