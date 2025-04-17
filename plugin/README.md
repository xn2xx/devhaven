# DevHaven 插件

DevHaven提供了多个IDE插件，帮助自动同步各种IDE中打开的项目到DevHaven应用，实现无缝集成体验。

## 可用插件

### [VS Code 插件](https://github.com/zxcvbnmzsedr/devhaven-vs-plugin)

为Visual Studio Code设计的插件，可自动同步VS Code中打开的项目信息到DevHaven。

[详细信息](./vs-code-plugin.md)

### [IntelliJ IDEA 插件](https://github.com/zxcvbnmzsedr/devhaven-idea-plugin)

为JetBrains全系列IDE（包括IDEA、WebStorm、PyCharm等）设计的插件，可自动同步IDE中打开的项目信息到DevHaven。

[详细信息](./intellij-idea-plugin.md)

## 工作原理

DevHaven插件会在用户的主目录下创建一个`.devhaven/projects`文件夹，当IDE中打开或关闭项目时，插件自动更新项目信息到此目录。DevHaven应用定期扫描该目录，同步最新的项目列表。


如果您希望为DevHaven开发新的IDE插件，欢迎参与贡献！
