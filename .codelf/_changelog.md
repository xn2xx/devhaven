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
       - db-service.ts // add 数据库服务
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

## 2024-07-09 11:00:00

### 1. 修复IDE服务的TypeScript类型错误

**Change Type**: fix

> **Purpose**: 修复IDE服务中的TypeScript类型错误
> **Detailed Description**: 为ide-service.ts添加完整类型定义，解决类型不兼容问题
> **Reason for Change**: 提高代码质量和类型安全性，消除编译警告
> **Impact Scope**: IDE相关功能
> **API Changes**: 无
> **Configuration Changes**: 无
> **Performance Impact**: 无

   ```
   root
   - src
     - main
       - ide-service.ts // update 添加完整的TypeScript类型声明
   ```

## 2024-07-09 11:30:00

### 1. 修复index.ts的TypeScript类型错误

**Change Type**: fix

> **Purpose**: 修复主进程入口文件中的TypeScript类型错误
> **Detailed Description**: 为index.ts添加明确的类型定义，解决隐式any类型错误
> **Reason for Change**: 提高代码质量和类型安全性，消除编译警告
> **Impact Scope**: 主进程入口文件
> **API Changes**: 无
> **Configuration Changes**: 无
> **Performance Impact**: 无

   ```
   root
   - src
     - main
       - index.ts // update 添加完整的TypeScript类型声明
   ```

## 2024-07-10 15:30:00

### 1. 优化IDE服务代码架构

**Change Type**: improvement

> **Purpose**: 重构IDE服务以提高可维护性、性能和代码质量
> **Detailed Description**: 采用更好的模块化设计重构ide-service.ts，拆分复杂函数，改进类型定义，使用常量管理IDE类型，并优化Promise处理
> **Reason for Change**: 提高代码可维护性和性能，遵循TypeScript最佳实践
> **Impact Scope**: IDE服务功能
> **API Changes**: 无接口变更，内部实现优化
> **Configuration Changes**: 无
> **Performance Impact**: 优化批量处理IDE配置的性能，通过Promise.all提高并行处理能力

   ```
   root
   - src
     - main
       - ide-service.ts // update 重构代码架构，拆分复杂函数，优化类型定义和性能
   ```

### 2. 增强IDE服务的错误处理能力

**Change Type**: improvement

> **Purpose**: 改进IDE服务的错误处理和日志记录
> **Detailed Description**: 优化错误处理逻辑，提供更明确的错误消息，使用常量避免硬编码字符串
> **Reason for Change**: 提高程序稳定性和问题排查效率
> **Impact Scope**: IDE服务的错误处理
> **API Changes**: 无
> **Configuration Changes**: 无
> **Performance Impact**: 无显著影响，但提高了错误情况下的稳定性

   ```
   root
   - src
     - main
       - ide-service.ts // update 改进错误处理和日志记录
   ```

## 2024-07-10 16:00:00

### 1. 优化GitHub仓库同步逻辑

**Change Type**: improvement

> **Purpose**: 优化GitHub仓库同步功能的可靠性和性能
> **Detailed Description**: 重构数据库同步逻辑，添加事务支持，改进错误处理，优化SQL查询
> **Reason for Change**: 提高数据同步的可靠性，避免数据不一致问题
> **Impact Scope**: GitHub仓库同步功能
> **API Changes**: 添加同步操作结果返回值
> **Configuration Changes**: 无
> **Performance Impact**: 提升数据同步的可靠性和性能

   ```
   root
   - src
     - main
       - db-service.ts // update GitHub仓库同步逻辑
         - 添加事务支持
         - 优化SQL查询
         - 改进错误处理
         - 添加操作结果返回
   ```

## 2024-07-10 16:30:00

### 1. 优化GitHub仓库同步批处理

**Change Type**: fix

> **Purpose**: 修复GitHub仓库同步时的参数数量限制问题
> **Detailed Description**: 实现批处理机制，解决SQLite参数数量限制导致的同步失败问题
> **Reason for Change**: 修复大量仓库同步时的错误，提高同步可靠性
> **Impact Scope**: GitHub仓库同步功能
> **API Changes**: 无
> **Configuration Changes**: 无
> **Performance Impact**: 优化大量数据处理性能，减少内存使用

   ```
   root
   - src
     - main
       - db-service.ts // update GitHub仓库同步逻辑
         - 添加批处理机制
         - 优化内存使用
         - 改进错误日志
   ```

## 2024-07-18 18:00:00

### 1. 更新项目README，添加英文版本

**Change Type**: enhancement

> **Purpose**: 提供双语版本的项目说明文档，以支持更广泛的用户群体
> **Detailed Description**: 将原有的中文README改为双语版本（英文和中文），并将英文版设为默认版本（置于文档顶部）
> **Reason for Change**: 提升项目的国际化程度，方便非中文用户浏览和使用
> **Impact Scope**: 项目文档
> **API Changes**: 无
> **Configuration Changes**: 无
> **Performance Impact**: 无

   ```
   root
   - README.md // update 添加英文版项目说明并设为默认版本
   ```

## 2024-07-19 10:30:00

### 1. 添加跨IDE文件切换功能

**Change Type**: feature

> **Purpose**: 实现在不同IDE之间快速切换同一文件的功能
> **Detailed Description**: 添加悬浮窗功能，允许用户在编辑文件时快速切换到其他IDE打开同一文件，无需手动导航
> **Reason for Change**: 提升开发效率，满足开发者在不同IDE间无缝切换的需求
> **Impact Scope**: 核心功能
> **API Changes**: 添加跨IDE文件切换API
> **Configuration Changes**: 无
> **Performance Impact**: 低，仅在用户请求切换时执行

   ```
   root
   - README.md // update 添加跨IDE文件切换功能描述
   - README_zh.md // update 添加跨IDE文件切换功能描述
   - src
     - main
       - open-project-service.ts // update 添加文件级别的IDE打开支持
       - ipc-handlers.js // update 添加跨IDE文件切换的IPC处理
     - renderer
       - src
         - components
           - FloatingIdeSelector.vue // add 悬浮IDE选择器组件
   ```
