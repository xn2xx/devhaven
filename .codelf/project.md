## DevHaven - 项目管理工具

> DevHaven是一款专为开发者设计的桌面应用，帮助组织和管理散落在各处的项目文件夹，实现一键用首选IDE打开项目的便捷体验。

> 项目旨在解决开发者在本地有多个公司、多个项目的代码仓库分散在不同文件夹的痛点，提供集中式平台将所有项目整合在一个界面中，方便查找和访问。

> 当前处于积极开发状态，包含完整的项目管理功能和IDE插件支持。

> 个人项目

> 技术栈：Electron, Vue.js 3, TypeScript, Element Plus, UnoCSS, Pinia, SQLite (better-sqlite3)


## 依赖 (来自package.json)

* vue (^3.2.47): 前端框架
* electron (^22.2.0): 桌面应用框架
* element-plus (^2.9.7): UI组件库
* pinia (^2.0.30): 状态管理库
* vue-router (^4.1.6): 路由管理
* better-sqlite3 (^8.3.0): SQLite数据库驱动
* typescript (^5.8.3): 静态类型检查
* unocss (66.1.0-beta.10): 原子化CSS框架
* electron-store (^8.1.0): 持久化存储
* @electron/remote (^2.0.9): Electron远程通信
* keytar (^7.9.0): 系统密钥链访问


## 开发环境

> 开发工具与环境
> - Node.js 14+
> - pnpm (推荐) 或 npm
> - 开发命令: `pnpm dev` 启动开发服务器
> - 构建命令: `pnpm build` 构建当前平台版本，也支持特定平台构建如 `pnpm build:win`、`pnpm build:mac`、`pnpm build:linux`


## 结构 (基于项目目录)

> 文件结构解析，重点关注关键目录和文件

```
root
- .cursor                           // Cursor IDE相关配置
    - .DS_Store
    - rules
        - my.mdc                    // Cursor规则文件，定义代码风格和项目规范
- .editorconfig                     // 编辑器配置文件，保持不同IDE下的统一代码格式
- .github                           // GitHub相关配置
    - workflows
        - build.yml                 // GitHub Actions自动化构建配置
- .gitignore                        // Git忽略文件列表
- .npmrc                            // npm配置文件
- .prettierignore                   // Prettier忽略文件配置
- .prettierrc.yaml                  // Prettier代码格式化配置
- README.md                         // 项目说明文档，包含项目概述、功能说明和开发指南
- build                             // 构建相关资源
    - entitlements.mac.plist        // macOS应用权限配置
    - icon.icns                     // macOS应用图标
    - icon.ico                      // Windows应用图标
    - icon.png                      // 通用应用图标
    - icon.svg                      // 矢量应用图标
- db                                // 数据库相关
    - schema.js                     // 数据库模式定义，包含表结构和关系
- dev-app-update.yml                // 应用更新配置
- doc                               // 文档资源
    - image.png                     // 应用截图
    - setting.png                   // 设置界面截图
- electron                          // Electron主进程相关
    - main.js                       // Electron入口文件
- electron-builder.yml              // Electron打包配置
- electron.vite.config.ts           // Electron-Vite配置文件，定义构建和开发设置
- eslint.config.mjs                 // ESLint配置
- package.json                      // 项目配置和依赖定义
- plugin                            // IDE插件相关文档
    - README.md                     // 插件总体说明
    - intellij-idea-plugin.md       // IntelliJ平台插件说明
    - vs-code-plugin.md             // VS Code插件说明
- pnpm-lock.yaml                    // pnpm依赖锁定文件
- resources                         // 资源文件
    - icon.png                      // 应用图标
    - ide                           // 各IDE图标
        - cursor.png
        - intellij-idea.svg
        - pycharm.svg
        - vscode.svg
        - webstorm.svg
- scripts                           // 脚本文件目录
- src                               // 源代码目录
    - .DS_Store
    - main                          // 主进程代码
        - db.service.js             // 数据库服务，处理数据存储和查询
        - file-service.js           // 文件服务，处理文件操作
        - github-service.js         // GitHub相关服务，处理GitHub API交互
        - ide-detector.js           // IDE检测器，识别系统中安装的IDE
        - ide-service.js            // IDE服务，处理IDE相关操作
        - index.js                  // 主进程入口
        - ipc-handlers.js           // IPC通信处理，主进程与渲染进程之间的通信
        - open-project-service.ts   // 项目打开服务，使用特定IDE打开项目
        - register-ts.js            // TypeScript注册，支持在主进程中使用TypeScript
        - settings-service.js       // 设置服务，处理应用配置
        - window.js                 // 窗口管理
    - preload                       // 预加载脚本
        - index.js                  // 预加载入口，定义渲染进程与主进程的接口
    - renderer                      // 渲染进程代码
        - App.vue                   // 应用主组件
        - index.html                // HTML入口
        - main.js                   // 渲染进程入口
        - src                       // 前端源码
            - components            // 组件目录
                - CompanyDialog.vue // 公司对话框组件
                - ProjectDialog.vue // 项目对话框组件
                - ProjectList.vue   // 项目列表组件，显示项目列表
                - RecursiveFolderTree.vue // 递归文件夹树组件，用于浏览文件结构
                - Sidebar.vue       // 侧边栏组件
                - settings          // 设置相关组件
                    - AboutSection.vue    // 关于部分
                    - DatabaseSettings.vue // 数据库设置组件
                    - GeneralSettings.vue  // 通用设置组件
                    - IdeSettings.vue      // IDE设置组件
            - global.d.ts           // 全局类型声明
            - router                // 路由配置
                - index.js          // 路由定义和管理
            - store                 // 状态管理
                - index.js          // Pinia存储配置
            - views                 // 视图组件
                - GithubStarView.vue // GitHub星标视图
                - HomeView.vue      // 主页视图，展示项目列表
                - SettingsView.vue  // 设置视图
                - TrayWindow.vue    // 托盘窗口视图
- tsconfig.json                     // TypeScript主配置
- tsconfig.node.json                // Node.js环境TypeScript配置
- tsconfig.web.json                 // Web环境TypeScript配置
```
