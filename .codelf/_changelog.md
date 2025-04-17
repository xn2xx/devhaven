## 2023-09-18 14:30:00

### 1. 移除Express和Koa相关依赖和代码

**Change Type**: refactor

> **Purpose**: 简化项目架构，移除不必要的Web服务器依赖
> **Detailed Description**: 删除了项目中的Express和Koa相关代码，通过内存存储替代了服务器功能
> **Reason for Change**: 项目实际上不需要完整的Web服务器，使用简单的内存存储机制即可满足需求
> **Impact Scope**: 影响项目启动过程和IPC通信机制
> **API Changes**:
>   - 原API: HTTP接口 `http://localhost:17334/openProjects`
>   - 新API: IPC通信 `get-open-projects`
> **Configuration Changes**: 已从package.json中移除相关依赖
> **Performance Impact**: 减少了不必要的服务启动，提高了应用启动速度

   ```
   root
   - electron
       - server.js                  // refact 将Koa服务器改为简单的内存存储模块
   - src
       - main
           - index.js               // refact 移除Express服务器启动逻辑
           - ipc-handlers.js        // add 添加获取打开项目的IPC处理程序
       - renderer
           - components
               - TrayWindow.vue     // refact 修改获取项目列表的方法，使用IPC替代HTTP
   - package.json                   // refact 移除Express和Koa相关依赖
   ```

## 2023-09-24 16:45:00

### 1. 优化系统托盘窗口UI

**Change Type**: improvement

> **Purpose**: 提升系统托盘窗口的用户体验和视觉效果
> **Detailed Description**: 重新设计TrayWindow.vue组件UI，添加项目图标、更清晰的项目信息展示和交互功能
> **Reason for Change**: 原有UI过于简单，不够美观和用户友好，缺乏必要的视觉层次和交互功能
> **Impact Scope**: 仅影响系统托盘窗口的显示效果，不影响其他功能
> **API Changes**: 无API变更
> **Configuration Changes**: 无配置变更
> **Performance Impact**: 引入了更多的UI元素，但对性能影响较小

   ```
   root
   - src
       - renderer
           - components
               - TrayWindow.vue     // refact 重新设计系统托盘窗口UI，添加项目图标、编辑器标识和收藏功能
   ```

## 2023-09-25 10:30:00

### 1. 添加空项目列表提示

**Change Type**: improvement

> **Purpose**: 增强用户体验，提供更友好的空状态提示
> **Detailed Description**: 在系统托盘窗口中当没有打开的项目时添加提示信息，让用户了解当前状态
> **Reason for Change**: 原有实现在没有项目时会显示空白界面，缺乏必要的反馈，容易让用户困惑
> **Impact Scope**: 仅影响系统托盘窗口的显示效果，不影响其他功能
> **API Changes**: 无API变更
> **Configuration Changes**: 无配置变更
> **Performance Impact**: 几乎不影响性能

   ```
   root
   - src
       - renderer
           - components
               - TrayWindow.vue     // improvement 添加空项目列表状态的视觉提示
   ```

## 2023-09-25 14:00:00

### 1. 抽取接口到全局类型声明文件

**Change Type**: refactor

> **Purpose**: 改善代码结构和类型管理
> **Detailed Description**: 创建global.d.ts全局类型声明文件，将组件中的接口定义移至全局空间
> **Reason for Change**: 统一管理类型定义，避免重复定义，提高代码可维护性
> **Impact Scope**: 影响TypeScript类型系统和组件中的类型引用
> **API Changes**: 无API变更，仅为内部类型定义重构
> **Configuration Changes**: 无配置变更
> **Performance Impact**: 无性能影响，仅为代码组织优化

   ```
   root
   - src
       - global.d.ts               // add 添加全局类型声明文件
       - renderer
           - components
               - TrayWindow.vue     // refact 移除本地类型声明，改用全局类型
   ```

## {datetime: YYYY-MM-DD HH:mm:ss}

### 1. {function simple description}

**Change Type**: {type: feature/fix/improvement/refactor/docs/test/build}

> **Purpose**: {function purpose}
> **Detailed Description**: {function detailed description}
> **Reason for Change**: {why this change is needed}
> **Impact Scope**: {other modules or functions that may be affected by this change}
> **API Changes**: {if there are API changes, detail the old and new APIs}
> **Configuration Changes**: {changes to environment variables, config files, etc.}
> **Performance Impact**: {impact of the change on system performance}

   ```
   root
   - pkg    // {type: add/del/refact/-} {The role of a folder}
    - utils // {type: add/del/refact} {The function of the file}
   - xxx    // {type: add/del/refact} {The function of the file}
   ```

### 2. {function simple description}

**Change Type**: {type: feature/fix/improvement/refactor/docs/test/build}

> **Purpose**: {function purpose}
> **Detailed Description**: {function detailed description}
> **Reason for Change**: {why this change is needed}
> **Impact Scope**: {other modules or functions that may be affected by this change}
> **API Changes**: {if there are API changes, detail the old and new APIs}
> **Configuration Changes**: {changes to environment variables, config files, etc.}
> **Performance Impact**: {impact of the change on system performance}

   ```
   root
   - pkg    // {type: add/del/refact/-} {The role of a folder}
    - utils // {type: add/del/refact} {The function of the file}
   - xxx    // {type: add/del/refact} {The function of the file}
   ```

...
