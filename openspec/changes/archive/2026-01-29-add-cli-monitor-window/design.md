## Context
需要独立悬浮窗口展示 CLI 监控，但不允许输入。窗口需由设置开关控制，并允许在悬浮窗内单独切换置顶状态。

## Goals / Non-Goals
- Goals:
  - 只读展示 tmux 会话列表与终端输出
  - 设置中开关控制悬浮窗显示/隐藏
  - 悬浮窗内置置顶切换
  - 悬浮窗无边框且可调整大小
- Non-Goals:
  - 在悬浮窗里进行终端输入/分屏/关闭会话
  - 与主窗口共享复杂路由或状态管理重构

## Decisions
- Decision: 使用 `WebviewWindow` 创建独立窗口，并通过查询参数区分悬浮窗视图。
  - 方案：`new WebviewWindow("cli-monitor", { url: "index.html?view=monitor", ... })`
  - 逻辑：在 `App` 根组件识别 `view=monitor` 并渲染 `MonitorWindow` 视图。
- Decision: 在终端面板提供 `readOnly` 模式。
  - 禁用 `terminal.onData` 发送输入
  - 禁用工作区快捷键与关闭/返回按钮
- Decision: 设置保存后立刻同步窗口状态。
  - `showMonitorWindow=true` 时创建或聚焦悬浮窗
  - `showMonitorWindow=false` 时关闭悬浮窗
- Decision: 手动关闭悬浮窗不反向修改设置开关。
- Decision: 悬浮窗置顶状态仅作用于该窗口，默认关闭。
  - `getCurrentWindow().setAlwaysOnTop(...)`
- Decision: 悬浮窗为无边框、可调整大小窗口。
  - `decorations: false`，`resizable: true`

## Risks / Trade-offs
- 读取会话列表与输出需复用 tmux 控制模式，窗口数量增多可能带来轻微资源占用。

## Migration Plan
- 增加 `AppSettings.showMonitorWindow`（默认 false）
- 保持旧版本状态兼容，缺失字段时使用默认值
