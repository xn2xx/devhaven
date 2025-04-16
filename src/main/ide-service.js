const { execFile, exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ideDetector = require('./ide-detector');
const { dbService } = require('./db.service');

/**
 * 检测并初始化IDE配置
 * @returns {Promise<Array>} 已配置的IDE列表
 */
async function initIdeConfigs() {
  try {
    console.log('开始检测系统已安装的IDE...');

    // 获取当前已配置的IDE
    const existingIdes = await dbService.ideConfigs.getAll();
    // 检测系统安装的IDE
    const detectedIdes = await ideDetector.detectIdes();
    console.log(`检测到 ${detectedIdes.length} 个IDE`);

    // 更新或添加检测到的IDE配置
    for (const ide of detectedIdes) {
      try {
        // 检查IDE是否已存在
        const existingIde = existingIdes.find(existing => existing.name === ide.name);

        if (existingIde) {
          // 如果命令不同，则更新现有IDE
          if (existingIde.command !== ide.command) {
            console.log(`更新IDE配置: ${ide.name} (${ide.command})`);
            await dbService.ideConfigs.update(existingIde.id, ide);
          }
        } else {
          // 添加新检测到的IDE
          console.log(`添加新检测到的IDE: ${ide.name} (${ide.command})`);
          await dbService.ideConfigs.create(ide);
        }
      } catch (error) {
        console.error(`处理IDE ${ide.name} 配置失败:`, error);
      }
    }

    console.log('IDE配置初始化完成');
    return dbService.ideConfigs.getAll();
  } catch (error) {
    console.error('IDE配置初始化失败:', error);
    throw error;
  }
}

/**
 * 使用指定IDE打开项目
 * @param {string} projectPath 项目路径
 * @param {string} ideName IDE名称
 * @returns {Promise<Object>} 操作结果
 */
async function openWithIde(projectPath, ideName) {
  if (!fs.existsSync(projectPath)) {
    return { success: false, error: '项目路径不存在' };
  }

  try {
    // 获取IDE配置
    const ideConfig = await dbService.ideConfigs.getByName(ideName);

    if (!ideConfig) {
      return { success: false, error: `未找到IDE配置 "${ideName}"` };
    }

    // 执行脚本类型的IDE
    if (ideConfig.is_script) {
      if (!ideConfig.script_content) {
        return { success: false, error: '脚本内容为空' };
      }

      // 替换脚本中的占位符
      const scriptContent = ideConfig.script_content.replace(/{projectPath}/g, projectPath);

      // 执行脚本
      exec(scriptContent, (error, stdout, stderr) => {
        if (error) {
          console.error(`脚本执行错误: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`脚本错误输出: ${stderr}`);
        }
        console.log(`脚本标准输出: ${stdout}`);
      });

      return { success: true };
    }
    // 执行应用程序类型的IDE
    else {
      if (!ideConfig.command) {
        return { success: false, error: '命令为空' };
      }

      // 处理命令参数
      let args = [];
      if (ideConfig.args) {
        // 替换参数中的占位符
        const processedArgs = ideConfig.args.replace(/{projectPath}/g, projectPath);
        args = processedArgs.split(' ').filter(arg => arg.trim());
      } else {
        args = [projectPath];
      }

      console.log(`使用IDE打开: ${ideConfig.command} ${args.join(' ')}`);

      // 处理macOS上特殊的情况
      if (process.platform === 'darwin' && ideConfig.command.endsWith('.app')) {
        // 处理.app应用程序
        let command;
        if (ideConfig.command.includes('Visual Studio Code.app')) {
          // 对于VS Code，使用内部可执行文件
          command = path.join(ideConfig.command, 'Contents/Resources/app/bin/code');
        } else if (ideConfig.command.includes('Xcode.app')) {
          // 对于Xcode，使用open命令
          return openWithMacCommand('open', ['-a', 'Xcode', projectPath]);
        } else {
          // 其他.app应用使用open命令
          return openWithMacCommand('open', ['-a', ideConfig.command, ...args]);
        }

        return openWithMacCommand(command, args);
      } else {
        // 其他平台或常规命令
        const child = spawn(ideConfig.command, args, {
          detached: true,
          stdio: 'ignore'
        });

        child.on('error', (error) => {
          console.error('打开IDE失败:', error);
        });

        child.unref();
        return { success: true };
      }
    }
  } catch (error) {
    console.error('使用IDE打开时出错:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 使用macOS命令打开应用
 * @param {string} command 命令
 * @param {Array} args 命令参数
 * @returns {Object} 操作结果
 */
function openWithMacCommand(command, args) {
  console.log(`使用macOS命令打开应用: ${command} ${args.join(' ')}`);
  try {
    // 确保文件有执行权限
    if (command.startsWith('/') && fs.existsSync(command)) {
      try {
        fs.chmodSync(command, '755');
      } catch (error) {
        console.warn(`无法修改文件权限: ${error.message}`);
      }
    }

    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore'
    });

    child.on('error', (error) => {
      console.error('打开应用失败:', error);
    });

    child.unref();
    return { success: true };
  } catch (error) {
    console.error('使用macOS命令打开应用时出错:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  initIdeConfigs,
  openWithIde
};
