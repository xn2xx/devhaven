# 技术设计：集成内置终端工作空间

## Context

DevHaven 当前是一个纯粹的项目管理工具，用户需要通过外部终端应用执行命令。集成内置终端可以减少上下文切换，但需要在架构上引入进程管理、终端协议适配、UI 模式切换等复杂性。

**技术栈**：
- 前端：React + TypeScript
- 后端：Tauri (Rust)
- 目标平台：macOS（主要）、Linux、Windows（次要）

**约束条件**：
- 终端渲染与 PTY 方案需要在 Tauri 约束内实现
- 暂不实现分屏与窗口管理
- Tauri 窗口系统的嵌入能力有限
- 需要保持现有功能的稳定性

## Goals / Non-Goals

### Goals
1. 在 DevHaven 内提供原生终端体验，无需跳转外部应用
2. 每个项目拥有独立的终端会话和工作目录
3. 支持多项目标签页快速切换
4. 保持性能和资源占用在可接受范围

### Non-Goals
1. **不**重新实现终端模拟器（复用 xterm.js 渲染与 PTY 方案）
2. **不**实现内置分屏与窗口管理
3. **不**强制替代用户现有的终端工作流（保持外部终端选项）
4. **不**在初版实现会话持久化（可作为后续迭代）

## Decisions

### Decision 1: 终端集成方案

**决策：使用 xterm.js + PTY 原生会话方案**

采用通用的终端技术栈：
- **前端**：`xterm.js` 提供终端 UI 渲染
- **后端**：Rust `portable-pty` 管理 PTY 进程
- **会话管理**：每个项目维护独立 PTY + shell 会话
- **通信**：Tauri 事件系统（emit/listen）传输终端 I/O

**选择理由**：
1. **可行性高**：Tauri + xterm.js 是成熟的组合，社区有大量参考实现
2. **跨平台**：`portable-pty` 抽象了 Unix/Windows PTY 差异
3. **易于集成**：xterm.js 与 React 集成简单，无需处理原生窗口嵌入
4. **可维护性**：依赖成熟开源库，避免重复造轮子
5. **无额外依赖**：移除 sesh/tmux 依赖，减少环境前置要求
6. **切换简化**：前端切换活跃会话，后端按会话路由输入/尺寸

**关于方案演进**：
- 初版不绑定特定终端模拟器，优先保证可维护性与跨平台一致性
- 未来如出现更合适的嵌入方案，可替换渲染层但不在本次范围

### Decision 2: 模式切换架构

**决策：双模式应用架构（Gallery Mode / Workspace Mode）**

```
App State
├─ gallery-mode (default)
│  └─ 项目列表视图 (当前 UI)
└─ workspace-mode (new)
   ├─ TabBar（横向标签页）
   └─ TerminalPanel（终端区域）
```

**状态管理**：
```typescript
type AppMode = 'gallery' | 'workspace';

interface WorkspaceState {
  mode: AppMode;
  openSessions: TerminalSession[];
  activeSessionId: string | null;
}

interface TerminalSession {
  id: string;
  projectId: string;
  projectName: string;
  workingDir: string;
  createdAt: number;
}
```

**触发条件**：
- 进入 workspace-mode：双击项目卡片 / 点击"开发模式"按钮
- 退出 workspace-mode：点击"返回项目列表"按钮 / 所有标签页关闭时自动返回

### Decision 3: 后端终端会话管理

**架构设计**（多 PTY 会话）：

```rust
// src-tauri/src/terminal.rs

use portable_pty::{native_pty_system, PtySize, CommandBuilder};
use std::collections::HashMap;
use uuid::Uuid;

pub struct TerminalManager {
    sessions: HashMap<String, TerminalSession>,
    active_session_id: Option<String>,
}

pub struct TerminalSession {
    id: String,
    project_id: String,
    project_path: String,
    pty: Option<TerminalSessionPty>,
}

pub struct TerminalSessionPty {
    // master/writer/child + alive 标记
}

impl TerminalManager {
    pub fn create_session(&mut self, project_path: &str) -> Result<String, Error> {
        // 1. 注册会话信息（暂不启动 PTY）
        // 2. 返回 session_id
    }

    pub fn switch_session(&mut self, session_id: &str) -> Result<(), Error> {
        // 1. 若会话尚未启动/已失活，创建 PTY + shell（cwd=project_path）
        // 2. 更新 active_session_id
    }

    pub fn close_session(&mut self, session_id: &str) -> Result<(), Error> {
        // 1. 终止会话子进程
        // 2. 移除会话映射
    }
}
```

**Tauri 命令**：
```rust
#[tauri::command]
async fn create_terminal_session(
    state: State<'_, TerminalManagerState>,
    project_path: String,
) -> Result<String, String> {
    state.manager.lock().unwrap().create_session(&project_path)
}

#[tauri::command]
async fn switch_terminal_session(
    state: State<'_, TerminalManagerState>,
    session_id: String,
) -> Result<(), String> {
    state.manager.lock().unwrap().switch_session(&session_id)
}

#[tauri::command]
async fn write_to_terminal(
    state: State<'_, TerminalManagerState>,
    data: String,
) -> Result<(), String> {
    // 写入用户输入到 PTY
}
```

**终端通信通道**：
- Tauri 内置 WebSocket 支持有限，建议使用事件系统或 HTTP SSE（Server-Sent Events）
- 方案：使用 `tauri::Manager::emit()` 发送终端输出到前端

### Decision 4: 前端终端组件

**依赖**：`xterm` + `xterm-addon-fit` + `xterm-addon-web-links`

**组件结构**（单终端实例）：
```
WorkspaceView
├─ TabBar
│  └─ Tab × N
└─ TerminalPanel
   └─ XtermTerminal (单实例)
```

**说明**：终端切换通过切换活跃会话并绑定对应 PTY，不再使用终端快照恢复历史输出。

**XtermTerminal 组件**：
```typescript
interface XtermTerminalProps {
  activeSessionId: string | null;
}

function XtermTerminal({ activeSessionId }: XtermTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);

  useEffect(() => {
    // 1. 初始化 xterm.js 实例
    const term = new Terminal({ /* config */ });
    term.open(terminalRef.current!);

    // 2. 监听前端输入，发送到后端
    term.onData(data => {
      invoke('write_to_terminal', { data });
    });

    // 3. 监听后端输出，写入 xterm
    const unlisten = listen('terminal-output', (event) => {
      term.write(event.payload as string);
    });

    // 4. 清理
    return () => {
      term.dispose();
      unlisten.then(fn => fn());
    };
  }, []);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }
    invoke('switch_terminal_session', { sessionId: activeSessionId });
  }, [activeSessionId]);

  return <div ref={terminalRef} className="terminal-container" />;
}
```

## Migration Plan

### Phase 1: 最小可行版本（MVP）
- 实现单标签页 + 单终端会话
- 支持基本输入输出
- 测试 macOS 平台

### Phase 2: 多标签页支持
- 实现标签页切换
- 优化会话管理
- 添加标签页关闭确认

### Phase 3: 跨平台与优化
- 测试 Linux/Windows
- 性能优化（减少内存占用）
- 添加终端配置选项（字体、主题）

### 回滚计划
- 如果集成失败，可以回退到仅保留"外部终端打开"功能
- 前端添加 Feature Flag 控制开发模式入口显示

## Risks / Trade-offs

### Risk 1: 依赖兼容性
- **风险**：终端渲染与 PTY 依赖升级可能带来兼容性波动
- **缓解**：锁定依赖版本并在发布前完成回归测试

### Risk 2: 性能问题
- **风险**：多个终端实例占用大量内存
- **缓解**：
  1. 限制最大同时打开标签页数量（如 10 个）
  2. 实现会话休眠机制（长时间未活跃的会话暂停）

### Risk 3: 跨平台兼容性
- **风险**：Windows 平台的 PTY 与 shell 行为差异较大
- **缓解**：
  1. 使用 `portable-pty` 库抽象平台差异
  2. Windows 初版要求 WSL，并在缺失时提示安装

### Risk 4: 用户习惯改变
- **风险**：部分用户可能不适应内置终端
- **缓解**：保留外部终端打开选项，提供设置项切换默认行为

## Open Questions

1. **Q: 是否需要支持多分屏终端？**
   - A: 初版不支持，可以在后续迭代中参考 VSCode 的分屏终端实现

2. **Q: 是否需要持久化终端会话（重启应用后恢复）？**
   - A: 初版不实现，技术复杂度高，用户需求待验证

3. **Q: 如何处理项目切换时的会话状态？**
   - A: 会话保持在后台，标签页切换时仅切换显示，不销毁会话

4. **Q: 是否需要支持自定义 shell（fish、zsh、bash）？**
   - A: 初版使用系统默认 shell，后续在设置中添加自定义选项

5. **Q: 终端主题是否需要与 DevHaven 主题同步？**
   - A: 初版使用 xterm.js 默认主题，后续可以添加主题同步功能
