## DevHaven (init from readme/docs)

> DevHaven - 一个专为开发者设计的桌面应用程序，用于组织和管理散落在各个位置的项目文件夹，提供便捷的一键体验，可以使用您首选的 IDE 打开项目。

> 解决开发者项目管理的痛点：多公司、多项目的代码仓库散落在不同文件夹中，查找项目需要记忆路径且耗时，不同项目需要用不同 IDE 打开等问题。通过 DevHaven 提供集中化平台，将所有项目整合到单一界面中，支持一键用对应 IDE 打开项目。

> 状态：活跃开发中，版本 1.0.4

> 开发团队：zxcvbnmzsedr

> 技术栈：Electron + Vue 3 + TypeScript + Element Plus + UnoCSS + SQLite + Pinia + Node.js

## Dependencies (init from programming language specification like package.json, requirements.txt, etc.)

### 主要依赖
* @electron/remote (^2.0.9): Electron 远程模块，用于主进程与渲染进程通信
* @element-plus/icons-vue (^2.3.1): Element Plus 图标库
* @iconify-json/fa-brands (^1.1.8): FontAwesome 品牌图标集
* @iconify-json/fa-solid (^1.2.1): FontAwesome 实心图标集
* @unocss/vite (66.1.0-beta.10): UnoCSS Vite 插件，原子化 CSS 框架
* axios (^1.6.7): HTTP 客户端，用于 API 请求
* better-sqlite3 (^8.3.0): SQLite 数据库驱动，用于本地数据存储
* electron-store (^8.1.0): Electron 应用设置存储
* electron-vite (^3.1.0): Electron + Vite 开发工具链
* element-plus (^2.9.7): Vue 3 UI 组件库
* keytar (^7.9.0): 操作系统凭据存储
* pinia (^2.0.30): Vue 3 状态管理库
* typescript (^5.8.3): TypeScript 编译器
* unocss (66.1.0-beta.10): 原子化 CSS 引擎
* vue (^3.2.47): Vue.js 3 框架
* vue-router (^4.1.6): Vue 3 路由库
* vue-tsc (^2.2.8): Vue TypeScript 类型检查

### 开发依赖
* electron (^22.2.0): Electron 框架
* electron-builder (^23.6.0): Electron 应用打包工具
* @vitejs/plugin-vue (^4.0.0): Vue 3 Vite 插件
* prettier (^3.5.3): 代码格式化工具
* unplugin-auto-import (^19.1.2): 自动导入插件

## Development Environment

> 开发环境要求：Node.js 14+，推荐使用 pnpm 包管理器
> 支持的构建目标：Windows (nsis)、macOS、Linux (AppImage)
> 开发服务器支持热重载，支持源码映射和远程调试 (端口 9222)
> 使用 electron-builder 进行多平台打包

### 可用脚本
* `pnpm dev`: 启动开发服务器
* `pnpm build`: 构建生产版本
* `pnpm build:win/mac/linux`: 平台特定构建
* `pnpm format`: 代码格式化
* `pnpm lint`: ESLint 代码检查
* `pnpm typecheck`: TypeScript 类型检查

## Structure (init from project tree)

> 项目采用 Electron + Vue 3 架构，分为主进程 (main)、预加载 (preload) 和渲染进程 (renderer)。
> 数据库使用 SQLite 存储项目信息，支持数据库迁移。
> 前端使用 Vue 3 Composition API + Element Plus + UnoCSS。

```
root
- .cursor                                    // Cursor IDE 配置目录
    - .DS_Store                             // macOS 系统文件
    - rules
        - my.mdc                            // Cursor 自定义规则配置
- .editorconfig                             // 编辑器配置统一标准
- .github                                   // GitHub 工作流配置
    - workflows
        - build.yml                         // CI/CD 构建配置
- .gitignore                                // Git 忽略文件规则
- .npmrc                                    // npm 配置文件
- .prettierignore                           // Prettier 忽略文件
- .prettierrc.yaml                          // Prettier 代码格式化配置
- README.md                                 // 项目说明文档 (英文)
- README_zh.md                              // 项目说明文档 (中文)
- build                                     // 构建相关资源
    - entitlements.mac.plist                // macOS 应用权限配置
    - icon.icns                             // macOS 应用图标
    - icon.ico                              // Windows 应用图标
    - icon.png                              // 通用PNG图标
    - icon.svg                              // 矢量图标
- dev-app-update.yml                        // 开发环境应用更新配置
- doc                                       // 文档目录
    - image.png                             // 应用截图
    - setting.png                           // 设置界面截图
    - switch.png                            // 切换功能截图
- electron-builder.yml                      // Electron Builder 打包配置
- electron.vite.config.ts                   // Electron + Vite 配置文件，定义构建规则
- eslint.config.mjs                         // ESLint 代码规范配置
- package.json                              // 项目依赖和脚本配置
- plugin                                    // IDE 插件相关文档
    - README.md                             // 插件总体说明
    - intellij-idea-plugin.md               // IntelliJ IDEA 插件说明
    - vs-code-plugin.md                     // VS Code 插件说明
- pnpm-lock.yaml                            // pnpm 锁定文件
- resources                                 // 应用资源文件
    - icon.png                              // 应用图标
    - ide                                   // IDE 图标资源
        - cursor.png                        // Cursor IDE 图标
        - intellij-idea.svg                 // IntelliJ IDEA 图标
        - pycharm.svg                       // PyCharm 图标
        - vscode.svg                        // VS Code 图标
        - webstorm.svg                      // WebStorm 图标
- src                                       // 源代码目录
    - .DS_Store                             // macOS 系统文件
    - main                                  // Electron 主进程代码
        - db-service.ts                     // 数据库服务，SQLite 操作封装
        - file-service.ts                   // 文件系统操作服务
        - github-service.ts                 // GitHub API 集成服务，OAuth 认证
        - ide-detector.ts                   // IDE 检测服务，自动识别系统已安装 IDE
        - ide-service.ts                    // IDE 操作服务，打开项目功能
        - index.ts                          // 主进程入口文件，应用生命周期管理
        - ipc-handlers.ts                   // IPC 通信处理器，主进程与渲染进程通信
        - migrations                        // 数据库迁移目录
            - migration-service.ts          // 数据库迁移服务
            - sql                           // SQL 迁移脚本
                - V001__initial_db_structure.sql     // 初始数据库结构
                - V002__add_color_to_folders.sql     // 添加文件夹颜色字段
                - V003__add_project_path_index.sql   // 添加项目路径索引
        - open-project-service.ts           // 项目打开服务，核心业务逻辑
        - project-service.ts                // 项目管理服务，CRUD 操作
        - settings-service.ts               // 应用设置服务，配置管理
        - window.ts                         // 窗口管理服务，主窗口和托盘窗口
    - preload                               // 预加载脚本
        - index.ts                          // 预加载脚本入口，安全的 API 暴露
    - renderer                              // 渲染进程 (Vue 应用)
        - App.vue                           // 主应用组件，支持透明背景切换
        - index.html                        // HTML 入口文件
        - main.js                           // 渲染进程入口 JS
        - src                               // Vue 应用源码
            - global.d.ts                   // 全局类型定义
            - router                        // Vue Router 路由配置
                - index.js                  // 路由定义，包含主页/设置/托盘/GitHub星标页面
            - store                         // Pinia 状态管理
                - index.js                  // 状态管理入口
            - views                         // 页面组件
                - GithubStarView.vue        // GitHub 星标项目管理页面
                - TrayWindow.vue            // 系统托盘悬浮窗口组件
                - home                      // 主页模块
                    - components            // 主页组件
                        - ProjectDialog.vue         // 项目对话框组件，添加/编辑项目
                        - ProjectList.vue           // 项目列表组件，项目展示和操作
                        - RecursiveFolderTree.vue   // 递归文件夹树组件，文件夹层级展示
                        - Sidebar.vue               // 侧边栏组件，公司/文件夹导航
                    - index.vue             // 主页入口组件
                - settings                  // 设置页面模块
                    - components            // 设置页面组件
                        - AboutSection.vue          // 关于页面组件
                        - DatabaseSettings.vue      // 数据库设置组件
                        - GeneralSettings.vue       // 通用设置组件
                        - IdeSettings.vue           // IDE 设置组件
                    - index.vue             // 设置页面入口组件
- tsconfig.json                             // TypeScript 主配置文件
- tsconfig.node.json                        // Node.js 环境 TypeScript 配置
- tsconfig.web.json                         // Web 环境 TypeScript 配置
```
