## 1. Implementation
- [x] 1.1 扩展项目模型（ProjectScript + Project.scripts），保证旧数据兼容
- [x] 1.2 扩展项目构建逻辑（保留已有 scripts）
- [x] 1.3 增加状态管理接口：updateProjectScripts
- [x] 1.4 详情面板新增脚本管理区（列表 + 运行/停止 + 编辑/删除/排序）
- [x] 1.5 项目卡片添加脚本快捷启动按钮
- [x] 1.6 执行/停止逻辑：自动进入工作区、记录 pane、发送命令/中断
- [x] 1.7 样式与文案调整（VSCode 任务风格）

## 2. Verification
- [ ] 2.1 旧数据无 scripts 时正常加载
- [ ] 2.2 新增/编辑/删除脚本可持久化
- [ ] 2.3 快捷启动与停止在内置终端生效
