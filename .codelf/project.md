## DevHaven

> DevHaven是一个项目管理工具，用于跨公司组织和管理项目

> 该工具帮助开发者集中管理和组织各种项目，提供项目分类、收藏和快速启动等功能

> 当前版本：1.0.0

> 开发团队：独立开发

> 使用技术：Electron, Vue.js, TypeScript, SQLite, Element Plus, UnoCSS



## Dependencies (init from programming language specification like package.json, requirements.txt, etc.)

* Electron (22.2.0): 跨平台桌面应用程序框架
* Vue.js (3.2.47): 前端JavaScript框架
* Element Plus (2.9.7): Vue 3的UI组件库
* Pinia (2.0.30): Vue的状态管理库
* better-sqlite3 (8.3.0): Node.js的SQLite客户端
* electron-store (8.1.0): Electron的持久数据存储
* UnoCSS (66.1.0-beta.10): 即时原子CSS引擎


## Development Environment

> 开发环境需要：
> - Node.js 16+
> - npm/pnpm
> - 支持运行在 Windows、macOS 和 Linux 平台上

> 开发命令：
> - `pnpm dev`: 启动开发服务器
> - `pnpm build`: 构建应用
> - `pnpm build:mac/win/linux`: 构建对应平台的应用


## Structure (init from project tree)

```
root
- .cursor                            // Cursor IDE配置目录
    - rules
        - my.mdc                     // Cursor规则配置
- .editorconfig                      // 编辑器配置文件
- .github                            // GitHub配置目录
    - workflows
        - build.yml                  // GitHub Actions构建配置
- .gitignore                         // Git忽略文件配置
- .npmrc                             // npm配置文件
- .prettierignore                    // Prettier忽略文件配置
- .prettierrc.yaml                   // Prettier配置文件
- README.md                          // 项目说明文件
- build                              // 构建资源目录
    - entitlements.mac.plist         // macOS权限配置
    - icon.icns                      // macOS应用图标
    - icon.ico                       // Windows应用图标
    - icon.png                       // 通用应用图标
    - icon.svg                       // 矢量应用图标
- db                                 // 数据库相关目录
    - schema.js                      // 数据库模式定义
- dev-app-update.yml                 // 开发环境应用更新配置
- doc                                // 文档目录
    - image.png                      // 文档图片
    - setting.png                    // 设置页面图片
- electron                           // Electron主进程代码目录
    - main.js                        // Electron主入口文件
    - server.js                      // 内存存储模块，用于管理项目状态
- electron-builder.yml               // electron-builder配置文件
- electron.vite.config.ts            // electron-vite配置文件
- eslint.config.mjs                  // ESLint配置文件
- package.json                       // 项目依赖和脚本配置
- pnpm-lock.yaml                     // pnpm锁定文件
- resources                          // 资源目录
    - icon.png                       // 应用图标
- src                                // 源代码目录
    - App.vue                        // 主应用组件
    - components                     // 通用组件目录
        - CompanyDialog.vue          // 公司对话框组件
        - ProjectDialog.vue          // 项目对话框组件
        - ProjectList.vue            // 项目列表组件
        - RecursiveFolderTree.vue    // 递归文件夹树组件
        - Sidebar.vue                // 侧边栏组件
        - settings                   // 设置相关组件
            - AboutSection.vue       // 关于部分组件
            - DatabaseSettings.vue   // 数据库设置组件
            - GeneralSettings.vue    // 通用设置组件
            - IdeSettings.vue        // IDE设置组件
    - index.html                     // HTML入口文件
    - main                           // 主进程代码目录
        - db.service.js              // 数据库服务
        - file-service.js            // 文件服务
        - float-window.js            // 浮动窗口服务
        - ide-detector.js            // IDE检测工具
        - ide-service.js             // IDE服务
        - index.js                   // 主进程入口
        - ipc-handlers.js            // IPC通信处理程序
        - kotlin                     // Kotlin插件目录
            - com
                - ztianzeng
                    - plugin
                        - listener
                        - service
        - settings-service.js        // 设置服务
        - window.js                  // 窗口管理服务
    - main.js                        // 渲染进程入口
    - preload                        // 预加载脚本目录
        - index.js                   // 预加载脚本
    - renderer                       // 渲染进程目录
        - float.html                 // 浮动窗口HTML
    - router                         // Vue路由目录
        - index.js                   // 路由配置
    - store                          // Pinia状态管理目录
        - index.js                   // 状态存储配置
    - views                          // 视图组件目录
        - HomeView.vue               // 首页视图
        - SettingsView.vue           // 设置视图
- tsconfig.json                      // TypeScript配置
- tsconfig.node.json                 // Node.js TypeScript配置
- tsconfig.web.json                  // Web TypeScript配置
- tsconfig.web.json.bak              // Web TypeScript配置备份
```
