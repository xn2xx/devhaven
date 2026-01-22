# DevHaven

![version](https://img.shields.io/badge/version-0.1.0-blue)

DevHaven 是一个基于 Tauri + React 的桌面应用，用于扫描本地工作目录并汇总项目状态、Git 活跃度和备注，帮助开发者快速整理与管理日常项目。

## 项目做什么
- 扫描工作目录及其子目录，构建项目清单（支持直接导入单个项目）
- 读取 Git 提交统计，生成每日热力图与仪表盘指标
- 通过标签、目录、关键字、时间范围、Git 状态快速筛选
- 项目详情面板支持备注、分支列表与快捷操作

## 为什么有用
- 让多项目管理更直观：标签 + 搜索 + Git 活跃度一眼看清
- 减少上下文切换：一处完成打开目录、终端、复制路径等操作
- Git 统计可视化：帮助评估项目活跃度与节奏

## 快速开始
### 环境要求
- Node.js（建议 LTS）
- Rust（stable）与系统构建工具
- Git（本项目读取提交统计与分支信息；当前实现使用 `"/usr/bin/git"`）
- macOS 推荐（文件管理器/终端集成依赖 `"/usr/bin/open"` 与 `"/usr/bin/osascript"`）

### 安装依赖
```bash
npm install
```

### 运行开发模式
```bash
npm run tauri dev
```

### 构建桌面包
```bash
npm run tauri build
```

### 使用示例
1. 左侧「目录」中添加工作目录或直接导入项目，支持拖拽目录到侧边栏。
2. 通过「标签」管理项目分类，颜色可自定义，支持隐藏标签。
3. 点击项目卡片查看详情，查看分支并记录 `"PROJECT_NOTES.md"` 备注。
4. 打开「仪表盘」查看 Git 提交热力图与活跃统计。

## 获取帮助
- 仓库 Issue 跟踪器（提交问题与需求）
- Tauri 文档：https://tauri.app/
- React 文档：https://react.dev/
- Vite 文档：https://vite.dev/
- Git 文档：https://git-scm.com/docs
