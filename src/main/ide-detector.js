const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { app } = require('electron');
const os = require("node:os");

/**
 * IDE检测器 - 扫描系统检测安装的开发工具
 */
class IdeDetector {
  constructor() {
    this.ideDefinitions = [
      // VS Code
      {
        name: 'vscode',
        display_name: 'Visual Studio Code',
        icon: 'code',
        paths: {
          darwin: [
            '/Applications/Visual Studio Code.app',
            '/Applications/Visual Studio Code - Insiders.app'
          ],
          win32: [
            'C:\\Program Files\\Microsoft VS Code\\Code.exe',
            'C:\\Program Files (x86)\\Microsoft VS Code\\Code.exe',
            '%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\Code.exe'
          ],
          linux: [
            '/usr/bin/code',
            '/usr/local/bin/code',
            '/snap/bin/code'
          ]
        },
        command: {
          darwin: '',
          win32: 'code.cmd',
          linux: 'code'
        },
        args: '{projectPath}',
        detectCommand: {
          darwin: 'which code',
          win32: 'where code 2>nul',
          linux: 'which code'
        }
      },
      // IntelliJ IDEA
      {
        name: 'idea',
        display_name: 'IntelliJ IDEA',
        icon: 'java',
        paths: {
          darwin: [
            '/Applications/IDEA.app',
            '/Applications/IntelliJ IDEA.app',
            '/Applications/IntelliJ IDEA CE.app',
            '/Applications/IntelliJ IDEA Ultimate.app',
            '/Applications/IntelliJ IDEA Community Edition.app',
            `${os.homedir()}/Applications/IDEA.app`,
            `${os.homedir()}/Applications/IntelliJ IDEA.app`,
            `${os.homedir()}/Applications/IntelliJ IDEA CE.app`,
            `${os.homedir()}/Applications/IntelliJ IDEA Ultimate.app`,
            `${os.homedir()}/Applications/IntelliJ IDEA Community Edition.app`,
          ],
          win32: [
            'C:\\Program Files\\JetBrains\\IntelliJ IDEA*\\bin\\idea64.exe',
            'C:\\Program Files (x86)\\JetBrains\\IntelliJ IDEA*\\bin\\idea.exe'
          ],
          linux: [
            '/usr/bin/intellij-idea-ultimate',
            '/usr/bin/intellij-idea-community',
            '/opt/intellij-idea/bin/idea.sh',
            '/snap/bin/intellij-idea-community',
            '/snap/bin/intellij-idea-ultimate'
          ]
        },
        command: {
          darwin: 'idea',
          win32: 'C:\\Program Files\\JetBrains\\IntelliJ IDEA*\\bin\\idea64.exe',
          linux: 'idea'
        },
        args: 'idea://open?file={projectPath}'
      },
      // WebStorm
      {
        name: 'webstorm',
        display_name: 'WebStorm',
        icon: 'js',
        paths: {
          darwin: [
            '/Applications/WebStorm.app',
            `${os.homedir()}/Applications/WebStorm.app`,
          ],
          win32: [
            'C:\\Program Files\\JetBrains\\WebStorm*\\bin\\webstorm64.exe',
            'C:\\Program Files (x86)\\JetBrains\\WebStorm*\\bin\\webstorm.exe'
          ],
          linux: [
            '/usr/bin/webstorm',
            '/opt/webstorm/bin/webstorm.sh',
            '/snap/bin/webstorm'
          ]
        },
        command: {
          darwin: 'webstorm',
          win32: 'C:\\Program Files\\JetBrains\\WebStorm*\\bin\\webstorm64.exe',
          linux: 'webstorm'
        },
        args: 'idea://open?file={projectPath}'
      },
      // PyCharm
      {
        name: 'pycharm',
        display_name: 'PyCharm',
        icon: 'python',
        paths: {
          darwin: [
            '/Applications/PyCharm.app',
            '/Applications/PyCharm CE.app',
            '/Applications/PyCharm Professional Edition.app',
            `${os.homedir()}/Applications/PyCharm.app`,
            `${os.homedir()}/Applications/PyCharm CE IDEA.app`,
            `${os.homedir()}/Applications/PyCharm Professional Edition.app`,
          ],
          win32: [
            'C:\\Program Files\\JetBrains\\PyCharm*\\bin\\pycharm64.exe',
            'C:\\Program Files (x86)\\JetBrains\\PyCharm*\\bin\\pycharm.exe'
          ],
          linux: [
            '/usr/bin/pycharm',
            '/opt/pycharm/bin/pycharm.sh',
            '/snap/bin/pycharm-professional',
            '/snap/bin/pycharm-community'
          ]
        },
        command: {
          darwin: 'pycharm',
          win32: 'C:\\Program Files\\JetBrains\\PyCharm*\\bin\\pycharm64.exe',
          linux: 'pycharm'
        },
        args: 'idea://open?file={projectPath}'
      },
      // Android Studio
      {
        name: 'android-studio',
        display_name: 'Android Studio',
        icon: 'android',
        paths: {
          darwin: [
            '/Applications/Android Studio.app'
          ],
          win32: [
            'C:\\Program Files\\Android\\Android Studio\\bin\\studio64.exe',
            'C:\\Program Files (x86)\\Android\\Android Studio\\bin\\studio.exe'
          ],
          linux: [
            '/usr/bin/android-studio',
            '/opt/android-studio/bin/studio.sh',
            '/snap/bin/android-studio'
          ]
        },
        command: {
          darwin: 'studio',
          win32: 'C:\\Program Files\\Android\\Android Studio\\bin\\studio64.exe',
          linux: 'studio'
        },
        args: '{projectPath}'
      },
      // Xcode (仅macOS)
      {
        name: 'xcode',
        display_name: 'Xcode',
        icon: 'apple',
        paths: {
          darwin: [
            '/Applications/Xcode.app'
          ],
          win32: [],
          linux: []
        },
        command: {
          darwin: 'open',
          win32: '',
          linux: ''
        },
        args: '-a Xcode {projectPath}'
      }
    ];
  }

  /**
   * 扫描系统安装的IDE
   * @returns {Array} 检测到的IDE列表
   */
  async detectIdes() {
    const platform = process.platform;
    const detectedIdes = [];

    for (const ide of this.ideDefinitions) {
      try {
        // 跳过不支持当前平台的IDE
        if (!ide.paths[platform] || ide.paths[platform].length === 0) {
          continue;
        }

        // 尝试检测IDE是否存在
        const detected = await this.detectIde(ide, platform);
        if (detected) {
          detectedIdes.push(detected);
        }
      } catch (error) {
        console.error(`检测IDE ${ide.name} 失败:`, error);
      }
    }

    return detectedIdes;
  }

  /**
   * 检测单个IDE
   * @param {Object} ide IDE定义
   * @param {string} platform 平台
   * @returns {Object|null} 检测到的IDE配置
   */
  async detectIde(ide, platform) {
    // 1. 尝试通过路径检测
    for (const testPath of ide.paths[platform]) {
      try {
        // 处理环境变量
        const resolvedPath = this.resolveEnvVars(testPath);

        // 处理通配符
        const matchingPaths = this.findMatchingPaths(resolvedPath);

        for (const filePath of matchingPaths) {
          if (fs.existsSync(filePath)) {
            // 特殊处理VSCode在macOS上的命令
            let command = filePath;
            let effectiveArgs = ide.args;

            if (platform === 'darwin') {
              if (ide.name === 'vscode' && filePath.endsWith('.app')) {
                // 对于VSCode，使用其内部的命令行工具
                command = path.join(filePath, 'Contents/Resources/app/bin/code');
              } else if (filePath.endsWith('.app')) {
                // 对于其他macOS应用，我们返回应用程序路径
                command = filePath;
              }
            }

            return {
              name: ide.name,
              display_name: ide.display_name,
              command: command,
              args: effectiveArgs,
              icon: ide.icon
            };
          }
        }
      } catch (error) {
        console.log(`检测路径 ${testPath} 失败:`, error);
      }
    }

    // 2. 尝试通过命令检测
    if (ide.detectCommand && ide.detectCommand[platform]) {
      try {
        const result = execSync(ide.detectCommand[platform], { encoding: 'utf8' }).trim();
        if (result && result.length > 0) {
          return {
            name: ide.name,
            display_name: ide.display_name,
            command: result,
            args: ide.args,
            icon: ide.icon
          };
        }
      } catch (error) {
        // 命令未找到，忽略错误
      }
    }

    // 3. 使用默认命令
    return null;
  }

  /**
   * 解析环境变量
   * @param {string} pathWithEnv 包含环境变量的路径
   * @returns {string} 解析后的路径
   */
  resolveEnvVars(pathWithEnv) {
    // 匹配 %VAR% 形式的环境变量
    if (process.platform === 'win32') {
      return pathWithEnv.replace(/%([^%]+)%/g, (_, varName) => {
        return process.env[varName] || '';
      });
    }
    // 匹配 $VAR 形式的环境变量
    return pathWithEnv.replace(/\$([A-Za-z0-9_]+)/g, (_, varName) => {
      return process.env[varName] || '';
    });
  }

  /**
   * 查找匹配通配符的路径
   * @param {string} pathWithWildcard 包含通配符的路径
   * @returns {Array} 匹配的路径列表
   */
  findMatchingPaths(pathWithWildcard) {
    if (!pathWithWildcard.includes('*')) {
      return [pathWithWildcard];
    }

    const dirPath = path.dirname(pathWithWildcard);
    const baseName = path.basename(pathWithWildcard);
    const regexPattern = baseName.replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);

    try {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        return files
          .filter(file => regex.test(file))
          .map(file => path.join(dirPath, file));
      }
    } catch (error) {
      console.error(`读取目录 ${dirPath} 失败:`, error);
    }

    return [];
  }
}

module.exports = new IdeDetector();
