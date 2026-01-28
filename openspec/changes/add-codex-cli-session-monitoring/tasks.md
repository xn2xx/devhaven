## 1. Backend (Tauri)
- [x] 1.1 在 src-tauri/src/models.rs 增加 Codex 会话摘要与消息结构
- [x] 1.2 新增 src-tauri/src/codex_sessions.rs，负责扫描 ~/.codex/sessions 并解析 JSONL
- [x] 1.3 在 src-tauri/src/lib.rs 增加 list_codex_sessions 命令并注册
- [x] 1.4 添加解析单测或最小样例测试（覆盖 session_meta 与 event_msg）

## 2. Frontend
- [x] 2.1 新增 src/models/codex.ts 与 src/services/codex.ts
- [x] 2.2 新增 useCodexSessions 轮询 Hook（间隔 2 秒，可配置常量）
- [x] 2.3 新增 CLI 会话面板/弹窗组件并接入样式
- [x] 2.4 在 src/App.tsx 中接入入口按钮与工作区联动

## 3. QA
- [x] 3.1 有会话时可看到实时更新的最近消息与活跃状态
- [x] 3.2 点击会话可切换或创建工作区标签
- [x] 3.3 无会话或目录不存在时显示空状态
