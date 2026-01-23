# Change: 集成 tmux 控制模式的终端工作空间

## Why

当前的内置终端以单一 PTY 会话为核心，虽然能提供基础命令行体验，但存在关键缺口：

1. **缺少分屏与窗口管理**：多任务开发时需要快速拆分 pane 与切换窗口
2. **会话恢复割裂**：希望在 DevHaven 与外部终端之间无缝恢复同一布局
3. **全屏程序体验不足**：vim/fzf/htop 等需要稳定的终端状态管理

引入 tmux 控制模式后，tmux 负责会话与布局的真实状态，DevHaven 负责 UI 渲染与快捷操作，可以同时满足分屏、窗口切换和跨终端恢复的需求。

## What Changes

- **终端引擎切换**：使用 tmux 控制模式（`tmux -CC`）替代直接 PTY + shell
- **项目即会话**：每个项目对应一个 tmux session，复用共享默认 tmux server
- **布局同步**：UI 按 tmux pane 布局渲染，布局变化实时同步
- **快捷键支持**：提供分屏、窗口切换、pane 切换等默认快捷键
- **会话恢复**：外部终端可直接 `tmux attach -t <session>` 恢复
- **平台范围**：目标仅限 macOS，非 macOS 给出不支持提示

## Impact

### 影响的能力规范
- **更新**：`terminal-workspace` - 终端会话从 PTY 迁移到 tmux 控制模式
- **沿用**：`project-interaction` - 项目卡片进入开发模式
- **沿用**：`ui-layout` - 双模式布局（gallery/workspace）

### 影响的代码模块
- **前端**：
  - `src/hooks/useTerminalSession.ts` - 由单终端切换为 pane 布局驱动
  - `src/components/` - 新增 pane 容器与窗口切换 UI
  - `src/services/terminal.ts` - 调整为 tmux 控制命令接口
- **后端**：
  - `src-tauri/src/terminal.rs` - 重写为 tmux 控制模式管理器
  - `src-tauri/src/lib.rs` - 更新 Tauri 命令集合

### 风险评估
- **依赖外部 tmux**：需要用户系统已安装 tmux
- **解析复杂度**：控制模式输出解析与布局同步需保持稳定
- **兼容性**：仅支持 macOS，需明确提示并阻断非目标平台
