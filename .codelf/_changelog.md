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