## 2023-11-15 16:30:00

### 1. 初始化项目框架

**Change Type**: feature

> **Purpose**: 创建基于Electron+Vue3+TypeScript的桌面应用基础架构
> **Detailed Description**: 设置Electron主进程和渲染进程架构，配置Vue3前端框架，添加TypeScript支持
> **Reason for Change**: 项目启动，需要搭建基础开发环境
> **Impact Scope**: 整个项目架构
> **API Changes**: N/A
> **Configuration Changes**: 添加electron.vite.config.ts, tsconfig.json, package.json等配置文件
> **Performance Impact**: 无

   ```
   root
   - electron.vite.config.ts // add 配置Electron和Vite构建选项
   - package.json // add 项目依赖和脚本
   - tsconfig.json // add TypeScript配置
   - src // add 源代码目录
     - main // add 主进程代码
     - preload // add 预加载脚本
     - renderer // add 渲染进程代码
   ```

### 2. 添加数据库功能

**Change Type**: feature

> **Purpose**: 实现项目和公司信息的本地存储
> **Detailed Description**: 使用better-sqlite3集成SQLite数据库，创建数据模型和服务
> **Reason for Change**: 需要本地持久化存储用户项目和公司信息
> **Impact Scope**: 数据管理相关功能
> **API Changes**: 添加数据库CRUD API
> **Configuration Changes**: 数据库初始化和配置
> **Performance Impact**: 低，只在需要时访问数据库

   ```
   root
   - db // add 数据库相关
     - schema.js // add 数据库模式定义
   - src
     - main
       - db.service.js // add 数据库服务
   ```

### 3. 实现IDE集成

**Change Type**: feature

> **Purpose**: 支持用户使用首选IDE打开项目
> **Detailed Description**: 开发IDE检测和启动功能，支持VS Code、WebStorm、PyCharm等常用IDE
> **Reason for Change**: 核心功能，让用户能一键用喜欢的IDE打开项目
> **Impact Scope**: IDE相关功能
> **API Changes**: 添加IDE检测和启动API
> **Configuration Changes**: IDE配置选项
> **Performance Impact**: 中等，需要执行系统命令

   ```
   root
   - resources
     - ide // add IDE图标
       - vscode.svg // add VS Code图标
       - webstorm.svg // add WebStorm图标
       - pycharm.svg // add PyCharm图标
       - intellij-idea.svg // add IntelliJ IDEA图标
       - cursor.png // add Cursor IDE图标
   - src
     - main
       - ide-detector.js // add IDE检测器
       - ide-service.js // add IDE服务
       - open-project-service.ts // add 项目打开服务
   ```

## 2023-12-10 14:45:00

### 1. 用户界面实现

**Change Type**: feature

> **Purpose**: 开发用户友好的项目管理界面
> **Detailed Description**: 使用Vue3和Element Plus构建项目列表、设置界面等UI组件
> **Reason for Change**: 提供用户交互界面
> **Impact Scope**: 前端UI
> **API Changes**: N/A
> **Configuration Changes**: N/A
> **Performance Impact**: 中等，取决于渲染效率

   ```
   root
   - src
     - renderer // refact 渲染进程代码
       - App.vue // add 应用主组件
       - main.js // add 渲染进程入口
       - src
         - components // add UI组件
           - ProjectList.vue // add 项目列表组件
           - ProjectDialog.vue // add 项目对话框
           - CompanyDialog.vue // add 公司对话框
           - Sidebar.vue // add 侧边栏组件
           - RecursiveFolderTree.vue // add 文件树组件
         - views // add 视图组件
           - HomeView.vue // add 主页视图
           - SettingsView.vue // add 设置视图
   ```

## 2024-02-18 09:15:00

### 1. GitHub集成

**Change Type**: feature

> **Purpose**: 添加GitHub仓库管理功能
> **Detailed Description**: 实现GitHub API集成，支持查看和管理用户的GitHub星标项目
> **Reason for Change**: 扩展功能，方便用户管理GitHub项目
> **Impact Scope**: GitHub相关功能
> **API Changes**: 添加GitHub API
> **Configuration Changes**: GitHub认证配置
> **Performance Impact**: 中等，依赖GitHub API响应速度

   ```
   root
   - src
     - main
       - github-service.js // add GitHub服务
     - renderer
       - src
         - views
           - GithubStarView.vue // add GitHub星标视图
   ```

## 2024-05-22 10:30:00

### 1. 系统托盘集成

**Change Type**: improvement

> **Purpose**: 实现系统托盘功能，允许应用在后台运行
> **Detailed Description**: 添加系统托盘图标和菜单，支持快速访问常用功能
> **Reason for Change**: 提升用户体验，方便用户快速访问应用
> **Impact Scope**: 系统集成
> **API Changes**: N/A
> **Configuration Changes**: 托盘配置
> **Performance Impact**: 低，只在系统托盘交互时消耗资源

   ```
   root
   - src
     - main
       - window.js // refact 添加托盘功能
     - renderer
       - src
         - views
           - TrayWindow.vue // add 托盘窗口视图
   ```
