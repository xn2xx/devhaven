# Change: 设置项新增 WebGL 渲染开关（xterm）

## Why

当前终端默认启用 WebGL，但缺少可控入口，遇到驱动兼容或性能问题时无法快速切换到传统渲染。

## What Changes

- 新增设置开关：用于启用/停用 xterm WebGL 渲染
- 默认保持启用，并在切换后立即生效
- 设置持久化到应用状态文件

## Impact

### 影响的能力规范
- 更新：terminal-workspace - 增加渲染模式切换能力

### 影响的代码模块
- src/models/types.ts - 增加设置字段
- src-tauri/src/models.rs - 同步设置字段与默认值
- src/components/SettingsModal.tsx - 增加 UI 开关
- src/hooks/useTmuxWorkspace.ts - 根据设置加载/卸载 WebGL 渲染器
