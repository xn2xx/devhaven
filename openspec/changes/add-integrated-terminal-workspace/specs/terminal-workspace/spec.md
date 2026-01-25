## ADDED Requirements

### Requirement: 项目 tmux 会话管理

系统应当(SHALL)使用共享默认 tmux server，并为每个项目创建或复用一个 tmux session。

#### Scenario: 创建或复用项目会话
- **WHEN** 用户进入某项目的开发模式
- **THEN** 系统应当创建或附加名为 `devhaven_<project_id>` 的 session
- **AND** 该 session 的工作目录应当为项目路径
- **AND** 控制模式客户端应当附着到该 session

#### Scenario: 外部终端恢复
- **WHEN** 用户在外部终端执行 `tmux attach -t <session>`
- **THEN** 应当看到与 DevHaven 相同的窗口与 pane 布局
- **AND** DevHaven 仍可继续操作该 session

#### Scenario: 关闭标签页不销毁会话
- **WHEN** 用户关闭项目标签页
- **THEN** 系统应当仅断开显示/控制
- **AND** 不应当销毁对应 tmux session

### Requirement: 控制模式连接与错误提示

系统应当(SHALL)通过 tmux 控制模式连接并解析事件流。

#### Scenario: tmux 可用时连接成功
- **WHEN** 系统检测到 tmux 可用
- **THEN** 应当启动 `tmux -CC` 控制模式客户端
- **AND** 正常接收 `%output` 与 `%layout-change` 等通知

#### Scenario: tmux 不可用
- **WHEN** 系统无法找到 tmux 或启动失败
- **THEN** 应当提示用户安装/修复 tmux
- **AND** 禁用开发模式入口

### Requirement: pane 布局同步

系统应当(SHALL)在 UI 中严格同步 tmux 的 pane 布局。

#### Scenario: 布局变化同步
- **WHEN** tmux 触发 `%layout-change`
- **THEN** UI 应当重新计算 pane 几何信息
- **AND** 每个 pane 的位置与大小应当与 tmux 一致

#### Scenario: 窗口切换同步
- **WHEN** 用户切换到另一个 tmux window
- **THEN** UI 应当更新为该 window 的 pane 布局

### Requirement: pane 输入输出

系统应当(SHALL)将输入输出正确路由到对应 pane。

#### Scenario: 发送输入到目标 pane
- **WHEN** 用户在某 pane 中输入内容
- **THEN** 系统应当将字节流发送到该 pane
- **AND** vim/fzf/htop 等全屏程序应当稳定工作

#### Scenario: 接收并渲染输出
- **WHEN** tmux 发送 `%output <pane-id> <data>`
- **THEN** 系统应当将输出渲染到对应 pane 的终端实例

### Requirement: 分屏与窗口操作

系统应当(SHALL)支持 tmux 的分屏与窗口管理操作。

#### Scenario: 创建左右分屏
- **WHEN** 用户触发左右分屏操作
- **THEN** tmux 应当创建新的 pane
- **AND** UI 应当显示新的 pane

#### Scenario: 创建上下分屏
- **WHEN** 用户触发上下分屏操作
- **THEN** tmux 应当创建新的 pane
- **AND** UI 应当显示新的 pane

#### Scenario: 切换窗口
- **WHEN** 用户触发窗口切换操作
- **THEN** 系统应当切换到目标 window
- **AND** UI 更新为该 window 的 pane 布局

#### Scenario: 关闭 pane
- **WHEN** 用户关闭当前 pane
- **THEN** tmux 应当关闭该 pane
- **AND** UI 移除对应 pane

### Requirement: 窗口列表常驻显示

系统应当(SHALL)在开发模式下常驻显示当前 session 的窗口列表。

#### Scenario: 展示窗口列表
- **WHEN** 用户进入开发模式
- **THEN** 应当显示窗口列表
- **AND** 列表应当标识当前活跃窗口

#### Scenario: 点击窗口切换
- **WHEN** 用户点击窗口列表中的某个窗口
- **THEN** 系统应当切换到该窗口
- **AND** UI 更新为该窗口的 pane 布局

### Requirement: 快捷键

系统应当(SHALL)提供默认快捷键以操作 tmux。

#### Scenario: 分屏快捷键
- **WHEN** 用户按下 `Cmd+D`
- **THEN** 系统应当创建左右分屏
- **AND** 用户按下 `Cmd+Shift+D` 应当创建上下分屏

#### Scenario: 窗口与 pane 切换快捷键
- **WHEN** 用户按下 `Cmd+[ / Cmd+]`
- **THEN** 系统应当切换到上一/下一窗口
- **AND** 用户按下 `Cmd+方向键` 应当切换 pane
- **AND** 用户按下 `Cmd+1..9` 应当切换到对应窗口

#### Scenario: 关闭与新建快捷键
- **WHEN** 用户按下 `Cmd+W`
- **THEN** 系统应当关闭当前 pane
- **AND** 用户按下 `Cmd+T` 应当新建窗口

### Requirement: macOS 平台限制

系统应当(SHALL)仅在 macOS 启用 tmux 工作空间。

#### Scenario: 非 macOS 平台
- **WHEN** 应用运行在非 macOS 平台
- **THEN** 开发模式入口应当不可用
- **AND** 提示该功能仅支持 macOS
