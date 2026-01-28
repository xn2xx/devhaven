# Change: Codex CLI 会话监控与工作区联动

## Why

DevHaven 目前只能看到 tmux 工作区，无法了解 Codex CLI 的会话是否在运行、正在对话什么。通过读取 Codex CLI session 文件，本小姐可以在应用内实时展示会话状态，并且一键跳转到对应项目的工作区标签页，减少上下文切换。（￣▽￣）

## What Changes

- 读取 ~/.codex/sessions 下的 Codex JSONL 会话文件并解析
- 基于最后活动时间判断会话是否正在运行
- 新增侧栏常驻 CLI 会话面板，仅展示运行中会话，展示活跃状态与最近消息
- 点击会话时，若存在对应工作区标签页则切换，否则自动创建
- 首期仅支持 Codex CLI（Claude Code 后续扩展）

## Impact

### 影响的能力规范
- **新增**：cli-session-monitoring - CLI 会话监控与工作区联动

### 影响的代码模块
- **前端**：
  - src/models/ 新增 Codex 会话模型
  - src/services/ 新增 Codex 会话读取接口
  - src/hooks/ 新增会话轮询与状态管理
  - src/components/ 新增 CLI 会话面板/弹窗
  - src/App.tsx 负责入口与工作区联动
- **后端**：
  - src-tauri/src/ 新增 Codex 会话解析模块
  - src-tauri/src/lib.rs 新增 Tauri 命令

### 风险评估
- **IO 成本**：会话文件较大，需限制读取范围
- **路径映射**：cwd 与项目路径不一致时无法自动关联
- **活跃判定**：基于时间窗的启发式可能存在误判
