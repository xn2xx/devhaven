## {Project Name} (init from readme/docs)

> {Project Description}

> {Project Purpose}

> {Project Status}

> {Project Team}

> {Framework/language/other(you think it is important to know)}



## Dependencies (init from programming language specification like package.json, requirements.txt, etc.)

* package1 (version): simple description
* package2 (version): simple description


## Development Environment

> include all the tools and environments needed to run the project
> makefile introduction (if exists)


## Structrue (init from project tree)

> It is essential to consistently refine the analysis down to the file level — this level of granularity is of utmost importance.

> If the number of files is too large, you should at least list all the directories, and provide comments for the parts you consider particularly important.

> In the code block below, add comments to the directories/files to explain their functionality and usage scenarios.

> if you think the directory/file is not important, you can not skip it, just add a simple comment to it.

> but if you think the directory/file is important, you should read the files and add more detail comments on it (e.g. add comments on the functions, classes, and variables. explain the functionality and usage scenarios. write the importance of the directory/file).
```
root
- .cursor
    - rules
        - my.mdc
- .editorconfig
- .github
    - workflows
        - build.yml
- .gitignore
- .npmrc
- .prettierignore
- .prettierrc.yaml
- README.md
- build
    - entitlements.mac.plist
    - icon.icns
    - icon.ico
    - icon.png
    - icon.svg
- db
    - schema.js
- dev-app-update.yml
- doc
    - image.png
    - setting.png
- electron
    - main.js
    - server.js
- electron-builder.yml
- electron.vite.config.ts
- eslint.config.mjs
- package.json
- pnpm-lock.yaml
- resources
    - icon.png
- src
    - .DS_Store
    - App.vue
    - components
        - CompanyDialog.vue
        - ProjectDialog.vue
        - ProjectList.vue
        - RecursiveFolderTree.vue
        - Sidebar.vue
        - settings
            - AboutSection.vue
            - DatabaseSettings.vue
            - GeneralSettings.vue
            - IdeSettings.vue
    - index.html
    - main
        - db.service.js
        - file-service.js
        - float-window.js
        - ide-detector.js
        - ide-service.js
        - index.js
        - ipc-handlers.js
        - kotlin
            - com
                - ztianzeng
                    - plugin
                        - listener
                        - service
        - settings-service.js
        - window.js
    - main.js
    - preload
        - index.js
    - renderer
        - float.html
    - router
        - index.js
    - store
        - index.js
    - views
        - HomeView.vue
        - SettingsView.vue
- tsconfig.json
- tsconfig.node.json
- tsconfig.web.json
- tsconfig.web.json.bak
```
