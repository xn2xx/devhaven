## 1. Implementation
- [x] 1.1 在后端新增控制模式命令封装：refresh-client -f/-A/-B（含控制通道与 fallback）
- [x] 1.2 新增 Tauri 命令与前端服务/模型定义（flags、流控、订阅）
- [x] 1.3 控制模式初始化时设置默认 flags（pause-after）并注册默认订阅（如有）
- [x] 1.4 处理 %pause/%continue：维护 pane 级暂停状态并自动发送 continue
- [x] 1.5 处理 %subscription-changed：事件透传到前端并可被 workspace 状态消费
- [x] 1.6 更新测试或补充手工验证步骤
