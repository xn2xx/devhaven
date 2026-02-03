## Context
终端模块涉及前端 UI、路由入口、项目交互与后端 tmux 适配。需求为整体移除该模块，且不清理现有数据。

## Goals / Non-Goals
- Goals:
  - 完全移除终端模块/页面与入口
  - 双击项目不再打开终端
  - 任务完成不再跳转终端
- Non-Goals:
  - 不迁移或清理历史数据与配置
  - 不保留任何 tmux 控制模式能力

## Decisions
- Decision: 直接删除终端模块相关 UI、路由与后端 tmux 实现，避免保留死代码。
- Alternatives considered: 将终端入口隐藏但保留实现；因维护成本高而放弃。

## Risks / Trade-offs
- 终端相关功能不可用 → 通过移除入口与提示文档降低误用

## Migration Plan
1. 删除终端模块与入口
2. 移除项目双击与任务完成跳转逻辑
3. 清理后端 tmux 相关代码

## Open Questions
- 是否需要在 UI 中增加“终端功能已移除”的提示（待确认）
