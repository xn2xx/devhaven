## Development Guidelines

### Framework and Language
> 基于Electron + Vue 3 + TypeScript技术栈，遵循现代化前端和桌面应用开发最佳实践。

**Framework Considerations:**
- Version Compatibility: Electron 22.2.0 + Vue 3.2.47，确保所有依赖兼容性
- Feature Usage:
  * 使用 Vue 3 Composition API 和 script setup 语法
  * 利用 Electron IPC 进行主进程与渲染进程通信
  * 使用 better-sqlite3 进行本地数据存储
- Performance Patterns:
  * 使用 UnoCSS 原子化 CSS 提升样式性能
  * 利用 Pinia 进行状态管理
  * 采用 lazy loading 和组件懒加载
- Upgrade Strategy: 定期更新依赖，保持与最新版本同步，使用 electron-builder 进行多平台打包
- Importance Notes for Framework:
	* Electron 安全策略：禁用 node integration，使用 preload 脚本暴露安全 API
	* Vue 3 响应式系统：优先使用 ref/reactive，避免直接操作 DOM
	* TypeScript 严格模式：确保类型安全，使用接口定义数据结构

**Language Best Practices:**
- Type Safety: 使用 TypeScript 严格模式，定义清晰的接口和类型
- Modern Features: 使用 ES2020+ 特性，async/await 异步处理
- Consistency: 统一的命名规范（camelCase）和代码格式（Prettier）
- Documentation: 详细的 JSDoc 注释，特别是公共 API 和复杂逻辑

### Code Abstraction and Reusability
> 项目采用模块化设计，主进程服务层、渲染进程组件化，确保代码复用性和可维护性。

**Modular Design Principles:**
- Single Responsibility: 每个服务类专注单一功能（如 project-service、ide-service）
- High Cohesion, Low Coupling: 服务间通过 IPC 通信，减少直接依赖
- Stable Interfaces: 通过 preload 脚本暴露稳定的 API 接口

**Reusable Component Library:**
```
src
- main                           // 主进程服务层
    - services
        - db-service            // 数据库操作抽象
        - project-service       // 项目管理业务逻辑
        - ide-service          // IDE 集成服务
        - github-service       // GitHub API 集成
        - settings-service     // 配置管理
        - file-service         // 文件系统操作
- renderer/src
    - components               // 可复用组件
        - ProjectDialog        // 项目对话框
        - ProjectList          // 项目列表
        - RecursiveFolderTree  // 文件夹树组件
    - views                    // 页面组件
        - home                 // 主页模块
        - settings             // 设置模块
    - store                    // Pinia 状态管理
    - router                   // Vue Router 路由配置
```

### Coding Standards and Tools
**Code Formatting Tools:**
- [ESLint (latest)](https://eslint.org/) // TypeScript/JavaScript 代码检查
- [Prettier (^3.5.3)](https://prettier.io/) // 代码格式化
- [UnoCSS (66.1.0-beta.10)](https://unocss.dev/) // 原子化 CSS 引擎

**Naming and Structure Conventions:**
- Semantic Naming: 变量/函数名称清晰表达用途
- Consistent Naming Style:
  * TypeScript: camelCase (变量、函数)、PascalCase (类、接口、组件)
  * CSS: kebab-case 类名
  * 文件名: kebab-case
- Directory Structure: 按功能职责划分，遵循 Electron + Vue 3 最佳实践

### Frontend-Backend Collaboration Standards
**IPC API Design and Documentation:**
- 使用 Electron IPC 进行主进程与渲染进程通信
	* 通过 ipcMain.handle 和 ipcRenderer.invoke 实现请求-响应模式
	* 所有 API 通过 preload 脚本安全暴露
- 及时接口文档更新
	* 在 ipc-handlers.ts 中统一管理所有 IPC 处理器
	* 使用 TypeScript 接口定义数据结构
- 统一错误处理规范
	* 主进程异常通过 try-catch 捕获并返回错误信息
	* 渲染进程统一处理 IPC 调用异常

**Data Flow:**
- 清晰的前端状态管理
	* 使用 Pinia 进行全局状态管理
	* 组件内部状态使用 Vue 3 响应式系统
- 前后端数据验证
	* 主进程进行数据库操作前验证
	* 渲染进程表单验证使用 Element Plus 内置验证
- 标准化异步操作处理
	* 统一使用 async/await 模式
	* IPC 调用错误处理使用统一的错误边界

### Performance and Security
**Performance Optimization Focus:**
- 资源加载优化
	* 使用 Vite 构建优化，支持代码分割
	* 静态资源压缩和缓存策略
- 渲染性能优化
	* Vue 3 虚拟列表处理大量项目数据
	* 使用 v-memo 缓存复杂计算结果
- 合理使用缓存
	* SQLite 查询结果缓存
	* Element Plus 组件懒加载

**Security Measures:**
- 输入验证和过滤
	* 所有用户输入在主进程进行验证
	* 文件路径安全检查，防止路径遍历攻击
- 敏感信息保护
	* 使用 keytar 安全存储 GitHub Token
	* 数据库文件加密存储（如需要）
- 访问控制机制
	* Electron 安全策略：禁用 nodeIntegration
	* 通过 preload 脚本限制 API 访问范围
