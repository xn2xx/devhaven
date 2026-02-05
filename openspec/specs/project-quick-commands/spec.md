# project-quick-commands Specification

## Purpose
定义“项目快捷命令（Project Quick Commands）”能力：允许用户为每个项目配置一组可持久化的快捷命令，并支持在项目详情面板与终端工作区中运行/停止这些命令。
## Requirements
### Requirement: Configure Project Quick Commands
系统 SHALL 允许用户为每个项目配置一组快捷命令（例如：启动、查看日志等），每条命令由名称与启动命令字符串组成，并可持久化保存。

#### Scenario: 新增快捷命令
- **GIVEN** 用户打开某项目的详情面板
- **WHEN** 用户新增一条快捷命令并保存
- **THEN** 该命令出现在项目命令列表中
- **AND** 重启应用后仍然存在

#### Scenario: 编辑与删除快捷命令
- **GIVEN** 某项目已存在快捷命令
- **WHEN** 用户编辑该命令并保存
- **THEN** 列表展示更新后的名称与命令
- **WHEN** 用户删除该命令
- **THEN** 列表不再显示该命令

### Requirement: Run And Stop Quick Commands
系统 SHALL 支持从项目面板运行/停止某条快捷命令。

#### Scenario: 运行命令在终端显示输出
- **GIVEN** 某项目已配置快捷命令
- **WHEN** 用户点击“运行”
- **THEN** 系统打开终端工作区并新建 Tab
- **AND** 在该 Tab 的终端中执行命令并输出日志

#### Scenario: 停止命令强制结束会话
- **GIVEN** 某命令正在运行且绑定了终端会话
- **WHEN** 用户点击“停止”
- **THEN** 系统强制结束该终端会话（kill PTY）
