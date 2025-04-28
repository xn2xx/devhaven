## 开发指南

### 框架和语言
> 本项目基于Electron+Vue3+TypeScript构建，遵循现代前端开发最佳实践。

**框架注意事项:**
- 版本兼容性: 确保所有依赖与Electron v22和Vue v3.2兼容
- 功能使用: 充分利用Vue3的Composition API和Element Plus组件库的功能
- 性能模式: 遵循Vue3推荐的响应式设计模式和Electron主进程/渲染进程分离模式
- 升级策略: 保持依赖更新但需谨慎评估主要版本升级的影响
- 重要事项:
	* 使用TypeScript进行类型检查，确保代码质量
	* 使用Electron-Vite配置进行构建
	* 使用Pinia进行状态管理

**语言最佳实践:**
- 类型安全: 使用TypeScript接口和类型定义，避免any类型
- 现代特性: 使用ES6+特性如箭头函数、解构赋值、Promise、async/await等
- 一致性: 应用全项目一致的代码风格和命名约定
- 文档: 为复杂功能和API添加必要的注释和文档

### 代码抽象和可重用性
> 开发过程中应优先考虑代码模块化和组件化，确保功能可重用并遵循DRY原则。
> 下面列出了项目中常用组件、工具函数和API封装的目录结构。

**模块化设计原则:**
- 单一职责: 每个模块只负责一项功能，如数据库服务、文件服务、IDE服务等
- 高内聚低耦合: 相关功能集中在一起，减少模块间依赖
- 稳定接口: 对外暴露稳定接口，内部实现可变
- 功能拆分: 将复杂功能拆分为更小的函数，每个函数专注于单一任务（参考ide-service.ts的实现）

**可重用组件库:**
```
root
- src
    - main
        - services // 主进程服务
            - db-service.ts // 数据库相关操作
            - ide-service.ts // IDE检测、配置和启动功能
            - file-service.js // 文件系统相关操作
    - renderer
        - src
            - components // 可重用的UI组件
                - ProjectDialog.vue // 项目对话框
                - ProjectList.vue // 项目列表
                - RecursiveFolderTree.vue // 文件树组件
```

### 编码标准和工具
**代码格式化工具:**
- [ESLint (eslint.config.mjs)](#) // JavaScript/TypeScript代码检查
- [Prettier (.prettierrc.yaml)](#) // 代码格式化
- [EditorConfig (.editorconfig)](#) // 编辑器配置

**命名和结构约定:**
- 语义化命名: 变量/函数名应清晰表达其用途
- 一致的命名风格:
  * 组件使用PascalCase (如ProjectList.vue)
  * 函数和变量使用camelCase
  * CSS使用kebab-case
- 目录结构按功能职责划分:
  * main - 主进程代码
  * renderer - 渲染进程代码
  * components - UI组件
  * views - 页面视图
  * store - 状态管理

### 前后端协作标准
**API设计和文档:**
- IPC通信模式
	* 使用Electron的ipcMain和ipcRenderer进行主进程和渲染进程通信
	* 在preload中定义API接口，确保渲染进程安全访问主进程功能
- 数据库访问
	* 主进程中处理数据库操作，渲染进程通过IPC调用

**数据流:**
- 清晰的前端状态管理
	* 使用Pinia管理应用状态
	* 将业务逻辑与UI展示分离
- 标准化的异步操作处理
	* 使用Promise和async/await处理异步操作
	* 统一错误处理模式

### 性能和安全
**性能优化重点:**
- 资源加载优化
	* 使用Electron-Vite优化构建过程
	* 实现懒加载和代码分割
- 渲染性能优化
	* 避免不必要的渲染
	* 使用Vue的虚拟DOM和响应式系统
- 缓存策略
	* 合理使用本地存储和内存缓存

**安全措施:**
- 输入验证和过滤
	* 验证用户输入数据
	* 防止XSS和注入攻击
- 敏感信息保护
	* 使用keytar安全存储敏感信息
	* 避免在代码中硬编码密钥和凭证
- 文件系统安全
	* 限制文件操作权限
	* 验证文件路径防止目录遍历
