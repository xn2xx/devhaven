# 技术设计：tmux 控制模式终端工作空间

## Context

DevHaven 需要在应用内提供可分屏、可切换窗口且可跨终端恢复的终端工作空间。单一 PTY 会话无法满足 tmux 级别的会话管理与布局能力，因此采用 tmux 控制模式作为终端引擎。目标平台暂定 macOS，使用系统默认 tmux server，以便用户在外部终端恢复同一会话与布局。

**技术栈**：
- 前端：React + TypeScript + xterm.js
- 后端：Tauri (Rust)
- 目标平台：macOS

**约束条件**：
- 依赖系统已安装 tmux
- 使用默认 tmux server（不使用自定义 socket）
- 支持全屏程序（vim/fzf/htop 等）

## Goals / Non-Goals

### Goals
1. 项目级 tmux session 管理（创建/复用/切换/关闭）
2. pane 布局与窗口状态与 tmux 保持一致
3. 提供快捷键操作分屏与窗口切换
4. 外部终端可直接恢复同一 session 与布局
5. 全屏程序交互稳定（输入输出完整）

### Non-Goals
1. 暂不支持非 macOS 平台
2. 不接管用户 tmux 配置文件与全局快捷键
3. 不实现 tmux 之外的自研布局系统

## Decisions

### Decision 1: 终端引擎使用 tmux 控制模式

- 使用 `tmux -CC` 启动控制模式客户端
- 后端解析控制模式输出（`%output`、`%layout-change`、`%window-*` 等）
- 前端通过 Tauri 命令驱动 tmux（split/select/send-keys 等）

**理由**：
- tmux 已解决会话与布局管理问题
- 控制模式提供可解析的事件流，适合 UI 渲染
- 与外部终端共享默认 tmux server，实现恢复

### Decision 2: 项目与会话命名

- 每个项目映射到固定 tmux session
- 会话名使用稳定前缀：`devhaven_<project_id>`（必要时做字符清洗）
- 创建会话使用 `new-session -A -s <session> -c <project_path>`
- 外部终端恢复命令：`tmux attach -t <session>`

### Decision 3: 布局同步策略

- 监听 `%layout-change` / `%window-pane-changed` 事件
- 通过 `list-panes -F "#{pane_id} #{pane_left} #{pane_top} #{pane_width} #{pane_height} #{pane_active}"` 获取 pane 几何信息
- UI 使用绝对布局将 xterm pane 放入对应矩形区域
- 切换窗口时重新请求 pane 列表并更新布局

### Decision 4: 输入输出传输

- `%output` 事件携带 `pane-id`，需要将 `\xxx` 八进制转义还原为字节
- 前端输入数据转为十六进制，使用 `send-keys -H -t <pane-id> <hex...>`
- 粘贴使用 `load-buffer` + `paste-buffer`，避免大文本卡顿

### Decision 5: 快捷键与窗口操作

- 快捷键由前端拦截并转换为 tmux 命令
- 默认快捷键：
  - `Cmd+D` 分屏（左右）
  - `Cmd+Shift+D` 分屏（上下）
  - `Cmd+W` 关闭当前 pane
  - `Cmd+T` 新建窗口
  - `Cmd+[ / Cmd+]` 上一/下一窗口
  - `Cmd+方向键` 切换 pane
  - `Cmd+1..9` 切换窗口

### Decision 6: 尺寸同步

- 前端计算终端列/行后调用 `refresh-client -C <cols>,<rows>`
- tmux 重新计算布局并触发 `%layout-change`

### Decision 7: 切换与恢复

- 切换项目时使用 `switch-client -t <session>` 绑定控制模式客户端
- 切换后调用 `list-windows` 与 `list-panes` 同步 UI
- 需要时使用 `capture-pane -pJ -S -` 拉取历史输出用于重建缓冲

### Decision 8: 窗口列表常驻显示

- 开发模式下始终展示窗口列表
- 窗口列表支持点击切换并高亮当前窗口

## Risks / Trade-offs

- **tmux 版本差异**：控制模式输出可能存在差异，需验证最低版本
- **输出解析复杂度**：必须稳定解析转义与事件流
- **后台输出丢失**：未附着会话期间的输出需用 `capture-pane` 重建

## Migration Plan

1. 替换后端 `terminal.rs` 为 tmux 控制模式管理器
2. 更新 Tauri 命令与事件协议
3. 前端渲染改为多 pane 布局
4. 新增快捷键与窗口切换 UI
5. macOS 端验证（vim/fzf/htop）

## Open Questions

- 无
