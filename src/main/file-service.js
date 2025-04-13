const { dialog, shell } = require('electron');
const fs = require('fs');

/**
 * 打开选择数据库路径对话框
 * @param {string} defaultPath 默认路径
 * @returns {Promise<Object>} 对话框结果
 */
async function selectDatabasePath(defaultPath) {
  return dialog.showSaveDialog({
    title: '选择数据库位置',
    defaultPath: defaultPath,
    filters: [
      { name: '数据库文件', extensions: ['db'] }
    ],
    properties: ['createDirectory']
  });
}

/**
 * 打开选择文件夹对话框
 * @returns {Promise<Object>} 对话框结果
 */
async function selectFolder() {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return {
      canceled: result.canceled,
      filePath: result.filePaths[0]
    };
  }

  return result;
}

/**
 * 打开可执行文件选择对话框
 * @returns {Promise<Object>} 对话框结果
 */
async function selectExecutable() {
  const options = {
    title: '选择应用程序',
    properties: ['openFile']
  };

  // 在Windows上添加可执行文件筛选器
  if (process.platform === 'win32') {
    options.filters = [
      { name: '可执行文件', extensions: ['exe', 'cmd', 'bat'] },
      { name: '所有文件', extensions: ['*'] }
    ];
  }

  const result = await dialog.showOpenDialog(options);

  if (!result.canceled && result.filePaths.length > 0) {
    return {
      canceled: result.canceled,
      filePath: result.filePaths[0]
    };
  }

  return result;
}

/**
 * 打开文件夹
 * @param {string} folderPath 文件夹路径
 * @returns {Promise<boolean>} 是否成功
 */
async function openFolder(folderPath) {
  if (fs.existsSync(folderPath)) {
    await shell.openPath(folderPath);
    return true;
  }
  return false;
}

module.exports = {
  selectDatabasePath,
  selectFolder,
  selectExecutable,
  openFolder
};
