## 2024-12-19 15:30:00

### 1. DevHaven 项目初始化和核心架构搭建

**Change Type**: feature

> **Purpose**: 建立 DevHaven 桌面应用的基础架构，实现项目管理的核心功能
> **Detailed Description**: 搭建基于 Electron + Vue 3 + TypeScript 的桌面应用框架，实现项目组织、IDE 集成、GitHub 集成等核心功能
> **Reason for Change**: 解决开发者多项目管理痛点，提供统一的项目访问入口
> **Impact Scope**: 整个应用架构，包括主进程服务、渲染进程 UI、数据库设计
> **API Changes**: 定义了完整的 IPC 通信接口，包括项目管理、设置配置、IDE 操作等
> **Configuration Changes**:
>   - 配置 electron-builder 支持多平台打包
>   - 设置 UnoCSS 原子化 CSS 框架
>   - 配置 TypeScript 严格模式
>   - 集成 Element Plus UI 组件库
> **Performance Impact**:
>   - 使用 SQLite 本地数据库提升数据访问速度
>   - Vue 3 Composition API 提升组件性能
>   - UnoCSS 减少 CSS 包大小

   ```
   root
   - src/main/                  // add - Electron 主进程
     - db-service.ts           // add - SQLite 数据库服务
     - project-service.ts      // add - 项目管理核心业务逻辑
     - ide-service.ts          // add - IDE 集成服务
     - github-service.ts       // add - GitHub OAuth 和 API 集成
     - settings-service.ts     // add - 应用配置管理
     - window.ts              // add - 窗口管理（主窗口和托盘窗口）
     - migrations/            // add - 数据库迁移系统
   - src/renderer/             // add - Vue 3 渲染进程
     - src/views/home/        // add - 主页模块（项目管理界面）
     - src/views/settings/    // add - 设置模块
     - src/components/        // add - 可复用组件库
     - src/router/           // add - Vue Router 路由配置
     - src/store/            // add - Pinia 状态管理
   - build/                   // add - 应用图标和构建资源
   - plugin/                  // add - IDE 插件文档
   ```

### 2. 项目管理和文件夹组织功能

**Change Type**: feature

> **Purpose**: 实现按公司/文件夹层级组织项目的核心功能
> **Detailed Description**:
>   - 递归文件夹树组件支持无限层级展示
>   - 项目 CRUD 操作和数据持久化
>   - 侧边栏导航和项目列表展示
>   - 项目搜索和过滤功能
> **Reason for Change**: 解决开发者项目散落各处难以管理的问题
> **Impact Scope**: 影响数据库设计、主页 UI 组件、项目服务层
> **API Changes**: 新增项目管理相关 IPC 接口：
>   - `project:getAll` - 获取所有项目
>   - `project:create` - 创建新项目
>   - `project:update` - 更新项目信息
>   - `project:delete` - 删除项目
> **Configuration Changes**: 无
> **Performance Impact**: SQLite 索引优化，支持快速项目查询

   ```
   root
   - src/renderer/src/views/home/
     - components/
       - ProjectList.vue           // add - 项目列表组件，支持搜索过滤
       - ProjectDialog.vue         // add - 项目添加/编辑对话框
       - RecursiveFolderTree.vue   // add - 递归文件夹树组件
       - Sidebar.vue               // add - 侧边栏导航组件
   ```

### 3. IDE 集成和自动检测功能

**Change Type**: feature

> **Purpose**: 实现一键打开项目到指定 IDE 的功能
> **Detailed Description**:
>   - 自动检测系统已安装的 IDE（VS Code、WebStorm、IntelliJ IDEA 等）
>   - 支持为不同项目配置首选 IDE
>   - 提供 IDE 切换快捷操作
>   - 托盘窗口快速访问功能
> **Reason for Change**: 提升开发效率，减少手动打开项目的时间成本
> **Impact Scope**: 影响 IDE 检测服务、设置页面、托盘功能
> **API Changes**: 新增 IDE 相关 IPC 接口：
>   - `ide:detect` - 检测已安装 IDE
>   - `ide:openProject` - 使用指定 IDE 打开项目
>   - `ide:getConfigs` - 获取 IDE 配置
> **Configuration Changes**: 添加 IDE 配置存储，支持自定义 IDE 路径
> **Performance Impact**: IDE 检测采用缓存机制，避免重复扫描

   ```
   root
   - src/main/
     - ide-detector.ts          // add - IDE 自动检测服务
     - ide-service.ts           // add - IDE 操作服务
   - src/renderer/src/views/
     - TrayWindow.vue           // add - 系统托盘悬浮窗
     - settings/components/
       - IdeSettings.vue        // add - IDE 设置配置页面
   - resources/ide/             // add - IDE 图标资源
   ```

### 4. GitHub 集成和项目同步

**Change Type**: feature

> **Purpose**: 集成 GitHub API，支持 OAuth 认证和星标项目导入
> **Detailed Description**:
>   - GitHub OAuth 2.0 认证流程
>   - 获取用户星标仓库并导入为项目
>   - 支持手动刷新和自动同步
>   - 安全的 Token 存储（使用 keytar）
> **Reason for Change**: 简化项目添加流程，自动发现感兴趣的项目
> **Impact Scope**: 新增 GitHub 服务、认证流程、星标项目页面
> **API Changes**: 新增 GitHub 相关 IPC 接口：
>   - `github:auth` - 启动 OAuth 认证
>   - `github:getStars` - 获取星标仓库
>   - `github:importProjects` - 导入项目到本地
> **Configuration Changes**:
>   - 添加 GitHub 应用配置
>   - 设置自定义协议处理 `devhaven://`
> **Performance Impact**: 使用分页 API 避免一次性加载过多数据

   ```
   root
   - src/main/
     - github-service.ts        // add - GitHub API 集成服务
   - src/renderer/src/views/
     - GithubStarView.vue       // add - GitHub 星标项目管理页面
   ```

## 模板格式说明

### 1. {功能简单描述}

**Change Type**: {类型: feature/fix/improvement/refactor/docs/test/build}

> **Purpose**: {功能目的}
> **Detailed Description**: {功能详细描述}
> **Reason for Change**: {为什么需要这个改变}
> **Impact Scope**: {这个改变可能影响的其他模块或功能}
> **API Changes**: {如果有API变化，详细说明新旧API}
> **Configuration Changes**: {环境变量、配置文件等的变化}
> **Performance Impact**: {改变对系统性能的影响}

   ```
   root
   - pkg    // {类型: add/del/refact/-} {文件夹的作用}
    - utils // {类型: add/del/refact} {文件的功能}
   - xxx    // {类型: add/del/refact} {文件的功能}
   ```
