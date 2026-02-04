## 1. Implementation
- [x] 后端：在 `src-tauri/src/storage.rs` 增加 `delete_terminal_workspace(app, project_path)`（删除 key 并保存 `terminal_workspaces.json`）。
- [x] 后端：在 `src-tauri/src/lib.rs` 增加 `#[tauri::command] delete_terminal_workspace` 并加入 `invoke_handler!`。
- [x] 前端：在 `src/services/terminalWorkspace.ts` 增加 `deleteTerminalWorkspace(projectPath)` 封装 `invoke("delete_terminal_workspace", ...)`。
- [x] 前端：在 `src/components/terminal/TerminalWorkspaceWindow.tsx` 的“已打开项目”列表项增加关闭按钮，并透传 `onCloseProject(projectId)` 回调。
- [x] 前端：在 `src/App.tsx` 增加关闭逻辑（移除 `terminalOpenProjects`、必要时更新 `terminalActiveProjectId`、当列表为空时自动退出终端工作区遮罩），并触发 `deleteTerminalWorkspace(project.path)` 删除持久化 workspace。

## 2. Verification
- [ ] 手动验证：打开 2 个项目 → 关闭其中 1 个 → 该项目从“已打开项目”消失，另一项目仍可使用。
- [ ] 手动验证：关闭项目后重新打开同一路径项目 → 终端工作区恢复为默认布局（证明持久化已删除）。
- [ ] 手动验证：关闭激活项目时，激活项自动切换到剩余项目；关闭最后一个项目时自动退出终端工作区遮罩。

## 3. Docs
- [x] 更新根目录 `AGENTS.md`：补充“关闭项目/清理终端会话”入口与新增 command / service 的定位信息（不修改 OPENSPEC 受管块）。
