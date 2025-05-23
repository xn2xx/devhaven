# DevHaven - 项目管理工具

[英文版](./README.md)

一款专为开发者设计的桌面应用，帮助您组织和管理散落在各处的项目文件夹，实现一键用首选IDE打开项目的便捷体验。

## 项目痛点与解决方案

### 痛点
- 开发者往往在本地有多个公司、多个项目的代码仓库，分散在不同文件夹
- 寻找特定项目需要记忆或搜索路径，费时费力
- 不同项目可能需要使用不同的IDE打开
- 项目相关信息（如分支、文档等）缺乏集中管理

### 解决方案
DevHaven提供了一个集中式平台，将所有项目整合在一个界面中，方便查找和访问，并支持一键用对应IDE打开项目，大大提高了开发效率。

## 核心功能

- **项目组织**：按公司/文件夹层级组织项目
- **快速访问**：一键使用首选IDE（VS Code、IntelliJ IDEA、WebStorm等）打开项目
- **项目详情**：查看项目路径、Git分支、最后打开时间等信息
- **标签分类**：为项目添加标签和分类
- **数据库位置自定义**：便于备份和同步
- **深色/浅色主题**：支持切换界面主题
- **搜索功能**：快速查找项目
- **跨IDE文件切换**：通过悬浮窗快速在不同IDE之间切换同一文件，无需手动导航即可在不同IDE中编辑同一文件
- **prompt**管理: 管理prompt，然后提供mcp提供给cursor这种ai工具进行访问，灵感来源于：https://github.com/gdli6177/mcp-prompt-server

## mcp配置
在启动应用的时候会将prompt挂载到本地目录之中，在%HOME%/.devhaven/prompt目录之下将mcp环境搭建好

如果没有加载到mcp，也许需要到此目录下执行 npm install 来安装依赖

```json
{
  "prompt-server": {
    "command": "node",
    "args": [
      "~/.devhaven/prompt/index.js"
    ],
    "transport": "stdio"
  }
}

```



## 插件支持
为了提供更流畅的开发体验，DevHaven提供了配套的IDE插件，可自动同步IDE中打开的项目到DevHaven应用：
- [**VS Code插件**](https://github.com/zxcvbnmzsedr/devhaven-vs-plugin) - 自动同步VS Code中打开的项目
- [**IntelliJ IDEA插件**](https://github.com/zxcvbnmzsedr/devhaven-idea-plugin) - 适用于IntelliJ平台的所有IDE（包括WebStorm、PyCharm等）
这些插件可以实现：
- 自动检测IDE中打开的项目
- 将项目信息同步到DevHaven
- 无需手动添加项目，提高工作效率
详细信息请查看[插件目录](./plugin)。

## 技术栈

- **前端**：Vue.js 3（组合式API）、Element Plus
- **样式**：UnoCSS
- **状态管理**：Pinia
- **数据库**：SQLite better-sqlite3
- **桌面集成**：Electron

## 开发指南

### 环境要求

- Node.js 14+
- pnpm（推荐）或npm

### 安装与启动

1. 克隆仓库
2. 安装依赖：

```bash
pnpm install
```

3. 启动开发服务器：

```bash
pnpm dev
```

### 构建应用

构建当前平台版本：

```bash
pnpm build
```

构建特定平台版本：

```bash
# Windows
pnpm build:win

# macOS
pnpm build:mac

# Linux
pnpm build:linux
```

# 预览
## 项目管理
![img](doc/image.png)
![img](doc/setting.png)
![img](doc/switch.png)
## prompt管理
![img](doc/prompt.png)
![img](doc/mcp.png)
![img](doc/mcp_result.png)

