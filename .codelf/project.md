## DevHaven - Project Management Tool / 项目管理工具

> DevHaven is a desktop application designed specifically for developers to help organize and manage project folders scattered in various locations, offering a convenient one-click experience to open projects with your preferred IDE.

> DevHaven是一款专为开发者设计的桌面应用，帮助组织和管理散落在各处的项目文件夹，实现一键用首选IDE打开项目的便捷体验。

> The project aims to solve the pain point of developers having code repositories from multiple companies and projects scattered across different folders, providing a centralized platform that integrates all projects into a single interface for easy finding and access.

> 项目旨在解决开发者在本地有多个公司、多个项目的代码仓库分散在不同文件夹的痛点，提供集中式平台将所有项目整合在一个界面中，方便查找和访问。

> Currently in active development, with complete project management features and IDE plugin support.

> 当前处于积极开发状态，包含完整的项目管理功能和IDE插件支持。

> Personal project

> Tech Stack: Electron, Vue.js 3, TypeScript, Element Plus, UnoCSS, Pinia, SQLite (better-sqlite3)

> 技术栈：Electron, Vue.js 3, TypeScript, Element Plus, UnoCSS, Pinia, SQLite (better-sqlite3)



## Dependencies / 依赖 (来自package.json)

* vue (^3.2.47): Frontend framework / 前端框架
* electron (^22.2.0): Desktop application framework / 桌面应用框架
* element-plus (^2.9.7): UI component library / UI组件库
* pinia (^2.0.30): State management library / 状态管理库
* vue-router (^4.1.6): Route management / 路由管理
* better-sqlite3 (^8.3.0): SQLite database driver / SQLite数据库驱动
* typescript (^5.8.3): Static type checking / 静态类型检查
* unocss (66.1.0-beta.10): Atomic CSS framework / 原子化CSS框架
* electron-store (^8.1.0): Persistent storage / 持久化存储
* @electron/remote (^2.0.9): Electron remote communication / Electron远程通信
* keytar (^7.9.0): System keychain access / 系统密钥链访问


## Development Environment / 开发环境

> Development tools and environment / 开发工具与环境
> - Node.js 14+
> - pnpm (recommended / 推荐) or/或 npm
> - Development command / 开发命令: `pnpm dev` to start development server / 启动开发服务器
> - Build command / 构建命令: `pnpm build` to build for current platform / 构建当前平台版本, also supports specific platform builds / 也支持特定平台构建 like/如 `pnpm build:win`, `pnpm build:mac`, `pnpm build:linux`

## Debugging / 调试

> The project supports TypeScript source code debugging in development mode / 项目支持在开发模式下进行TypeScript源码调试

### VSCode Debugging / VSCode调试
- Press F5 or click the debug button / 按F5或点击调试按钮
- Select "Electron: Main" configuration / 选择"Electron: Main"配置
- Set breakpoints in TypeScript source files / 在TypeScript源文件中设置断点

### Chrome DevTools Debugging / Chrome开发者工具调试
- Run `pnpm dev` to start the application / 运行`pnpm dev`启动应用
- Open Chrome browser and visit `chrome://inspect` / 打开Chrome浏览器并访问`chrome://inspect`
- Find your Electron application under "Remote Target" / 在"Remote Target"下找到你的Electron应用
- Click "inspect" to start debugging / 点击"inspect"开始调试

### Debug Configuration / 调试配置
- Source maps enabled for main and preload processes / 主进程和预加载进程启用源码映射
- Remote debugging port: 9222 / 远程调试端口：9222
- Node inspector port: 5858 / Node检查器端口：5858
- Development debug environment variables / 开发调试环境变量:
  * NODE_ENV=development
  * VITE_DEV_DEBUG=true
  * ELECTRON_ENABLE_SOURCE_MAPS=true


## Structure / 结构 (基于项目目录)

> File structure analysis, focusing on key directories and files / 文件结构解析，重点关注关键目录和文件

```
root
- .cursor                           // Cursor IDE相关配置
    - .DS_Store                     // macOS系统生成的文件，存储自定义文件夹属性
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
        - cursor.png                // Cursor IDE图标
        - intellij-idea.svg         // IntelliJ IDEA图标
        - pycharm.svg               // PyCharm IDE图标
        - vscode.svg                // Visual Studio Code图标
        - webstorm.svg              // WebStorm IDE图标
- scripts                           // 脚本文件目录，用于自动化任务
- src                               // 源代码目录
    - .DS_Store                     // macOS系统生成的文件
    - main                          // 主进程代码
        - db-service.ts             // 数据库服务，处理数据存储和查询
        - file-service.js           // 文件服务，处理文件操作
        - github-service.js         // GitHub相关服务，处理GitHub API交互
        - ide-detector.js           // IDE检测器，识别系统中安装的IDE
        - ide-service.ts            // IDE服务，提供IDE检测、配置和启动功能，采用模块化设计提高可维护性
        - index.ts                  // 主进程入口
        - ipc-handlers.js           // IPC通信处理，主进程与渲染进程之间的通信
        - open-project-service.ts   // 项目打开服务，使用特定IDE打开项目
        - register-ts.js            // TypeScript注册，支持在主进程中使用TypeScript
        - settings-service.js       // 设置服务，处理应用配置
        - window.js                 // 窗口管理
    - preload                       // 预加载脚本
        - index.ts                  // 预加载入口，定义渲染进程与主进程的接口
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
                - index.ts          // 路由定义和管理
            - store                 // 状态管理
                - index.ts          // Pinia存储配置
            - views                 // 视图组件
                - GithubStarView.vue // GitHub星标视图
                - HomeView.vue      // 主页视图，展示项目列表
                - SettingsView.vue  // 设置视图
                - TrayWindow.vue    // 托盘窗口视图
- tsconfig.json                     // TypeScript主配置
- tsconfig.node.json                // Node.js环境TypeScript配置
- tsconfig.web.json                 // Web环境TypeScript配置
```
