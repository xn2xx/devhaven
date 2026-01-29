## ADDED Requirements
### Requirement: 终端渲染模式开关
系统 MUST 提供设置项以启用或停用 xterm 的 WebGL 渲染模式，并在切换后立即生效。

#### Scenario: 默认启用 WebGL 渲染
- **WHEN** 用户尚未配置该设置
- **THEN** 终端使用 WebGL 渲染器

#### Scenario: 手动关闭 WebGL 渲染
- **WHEN** 用户在设置中关闭 WebGL 渲染
- **THEN** 终端切换为传统渲染器并立即生效

#### Scenario: 手动开启 WebGL 渲染
- **WHEN** 用户在设置中开启 WebGL 渲染
- **THEN** 终端切换为 WebGL 渲染器并立即生效
