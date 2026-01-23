## ADDED Requirements

### Requirement: 终端会话管理

系统应当(SHALL)为每个项目提供独立的终端会话，并且每个项目仅对应一个 PTY + shell 会话。

#### Scenario: 创建终端会话
- **WHEN** 用户首次打开某个项目的开发模式
- **THEN** 系统应当创建一个新的终端会话
- **AND** 自动切换工作目录到项目路径
- **AND** 使用系统默认 shell（bash/zsh 或 WSL 默认 shell）
- **AND** 在项目路径启动 PTY + shell 进程
- **AND** 返回唯一的会话 ID

#### Scenario: 复用已存在的会话
- **WHEN** 用户打开已有活跃会话的项目
- **THEN** 系统应当复用现有会话
- **AND** 不创建新的终端进程
- **AND** 复用已创建的 PTY 会话

#### Scenario: 关闭终端会话
- **WHEN** 用户关闭项目标签页
- **THEN** 系统应当请求对应终端进程优雅退出
- **AND** 必要时按平台强制终止进程
- **AND** 关闭对应的终端进程
- **AND** 清理会话资源
- **AND** 从活跃会话列表中移除

#### Scenario: 限制最大会话数量
- **WHEN** 已打开 10 个终端会话（默认上限）
- **AND** 用户尝试打开第 11 个项目
- **THEN** 系统应当显示警告提示
- **AND** 要求用户关闭至少一个现有会话后再继续

### Requirement: 工作空间 UI 布局

系统应当(SHALL)在开发模式下提供标签页 + 终端的布局。

#### Scenario: 显示标签页栏
- **WHEN** 应用处于开发模式
- **THEN** 界面上方应当显示横向标签页栏
- **AND** 每个标签显示项目名称
- **AND** 活跃标签高亮显示

#### Scenario: 显示终端面板
- **WHEN** 应用处于开发模式
- **THEN** 界面下方应当显示终端容器
- **AND** 显示当前活跃标签对应的终端实例
- **AND** 终端占据剩余可用空间

#### Scenario: 标签页切换
- **WHEN** 用户点击非活跃标签
- **THEN** 系统应当切换到对应的终端会话
- **AND** 更新活跃标签高亮状态
- **AND** 终端面板显示切换后的会话输出
- **AND** 终端应当切换到对应的会话并绑定其输入输出

### Requirement: 标签页操作

系统应当(SHALL)支持标签页关闭操作。

#### Scenario: 关闭标签页
- **WHEN** 用户点击标签页的关闭按钮（×）
- **THEN** 系统应当判断该会话是否存在未退出的前台进程（无法判断时视为无运行）
- **AND** 若存在运行中的前台进程，系统应当显示确认对话框
- **AND** 用户确认后关闭对应的终端会话
- **AND** 从标签页栏移除该标签

#### Scenario: 最后一个标签页关闭时返回项目列表
- **WHEN** 用户关闭最后一个打开的标签页
- **THEN** 系统应当自动退出开发模式
- **AND** 返回到项目列表视图（gallery-mode）

### Requirement: 终端输入输出

系统应当(SHALL)正确处理终端的输入输出。

#### Scenario: 用户输入命令
- **WHEN** 用户在终端中输入字符
- **THEN** 系统应当将输入发送到后端 PTY 进程
- **AND** 终端显示用户输入的回显

#### Scenario: 终端输出内容
- **WHEN** shell 进程产生输出（stdout/stderr）
- **THEN** 系统应当实时捕获输出
- **AND** 将输出发送到前端 xterm.js 实例
- **AND** 终端界面实时显示输出内容

#### Scenario: 支持 ANSI 转义序列
- **WHEN** shell 输出包含颜色、格式控制等 ANSI 代码
- **THEN** 终端应当正确渲染这些控制序列
- **AND** 显示彩色输出、粗体、下划线等格式

### Requirement: 跨平台支持

系统应当(SHALL)在主流操作系统上提供终端功能。

#### Scenario: macOS 平台
- **WHEN** 应用运行在 macOS 上
- **THEN** 终端应当使用用户默认 shell（通常是 zsh 或 bash）
- **AND** 支持完整的 Unix 命令
- **AND** 使用用户默认 shell

#### Scenario: Linux 平台
- **WHEN** 应用运行在 Linux 上
- **THEN** 终端应当使用 /bin/bash 或用户配置的 shell
- **AND** 支持完整的 Linux 命令
- **AND** 使用用户默认 shell

#### Scenario: Windows 平台
- **WHEN** 应用运行在 Windows 上
- **THEN** 系统应当使用 Windows 可用的默认 shell（如 PowerShell 或 WSL shell）

### Requirement: 错误处理

系统应当(SHALL)优雅地处理终端相关的错误。

#### Scenario: 创建会话失败
- **WHEN** 系统无法创建 PTY 进程（权限问题、系统限制等）
- **THEN** 应当显示错误提示
- **AND** 建议用户检查系统权限或重启应用

#### Scenario: shell 不可用
- **WHEN** 系统无法定位默认 shell
- **THEN** 应当提示用户检查 SHELL/COMSPEC 配置
- **AND** 给出平台相关的说明

#### Scenario: 会话未初始化
- **WHEN** 前端请求写入或调整尺寸，但会话尚未启动
- **THEN** 应当返回明确错误信息
- **AND** 提示用户重新进入工作空间或重启会话

#### Scenario: 进程异常退出
- **WHEN** shell 进程意外崩溃或被杀死
- **THEN** 终端应当显示"进程已退出（退出码 X）"
- **AND** 提供"重新启动"按钮

#### Scenario: 终端通信通道中断
- **WHEN** 前后端终端通信通道中断
- **THEN** 终端应当显示"连接已断开"警告
- **AND** 尝试自动重连
- **AND** 重连成功后恢复正常输出

### Requirement: 性能与资源管理

系统应当(SHALL)有效管理终端会话的资源占用。

#### Scenario: 内存占用监控
- **WHEN** 单个终端会话内存占用超过 100MB
- **THEN** 系统应当记录警告日志
- **AND** （可选）提示用户该会话可能有内存泄漏

#### Scenario: 输出缓冲限制
- **WHEN** 终端输出速度过快（如 `cat` 大文件）
- **THEN** xterm.js 应当启用输出节流
- **AND** 避免前端界面卡顿

#### Scenario: 会话清理
- **WHEN** 应用退出时仍有活跃会话
- **THEN** 系统应当向所有终端进程发起优雅终止请求
- **AND** 等待最多 3 秒后按平台强制终止仍未退出的进程
- **AND** 确保所有资源被释放
