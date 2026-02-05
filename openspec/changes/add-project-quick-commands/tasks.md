## 1. Spec
- [x] 新增 `project-quick-commands` capability delta spec
- [x] 补充 `terminal-workspace` capability delta spec（右侧悬浮窗、运行/停止行为）

## 2. Frontend
- [x] DevHaven store 增加项目脚本 CRUD（持久化 projects.json）
- [x] DetailPanel 增加“快捷命令”配置/删除/运行/停止 UI
- [x] 运行命令：向终端工作区发起 run request，自动新开 Tab 并下发命令
- [x] 停止命令：强制 kill 对应 PTY 会话
- [x] 终端工作区右侧悬浮窗：展示脚本列表、运行/停止、可拖拽、按项目持久化位置与开关

## 3. Docs
- [x] 更新根 `AGENTS.md` 功能地图

