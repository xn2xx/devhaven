import { dialog, OpenDialogOptions, SaveDialogOptions, shell } from "electron";
import fs from "fs";
import { spawn } from "child_process";
import path from "path";

/**
 * 打开选择数据库路径对话框
 * @param {string} defaultPath 默认路径
 * @returns {Promise<Object>} 对话框结果
 */
async function selectDatabasePath(defaultPath: string): Promise<Electron.SaveDialogReturnValue> {
  return dialog.showSaveDialog({
    title: "选择数据库位置",
    defaultPath: defaultPath,
    filters: [
      { name: "数据库文件", extensions: ["db"] }
    ],
    properties: ["createDirectory"]
  } as SaveDialogOptions);
}

/**
 * 打开选择文件夹对话框
 * @returns {Promise<Object>} 对话框结果
 */
async function selectFolder(): Promise<Electron.OpenDialogReturnValue | { canceled: false; filePath: string; }> {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
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
async function selectExecutable(): Promise<Electron.OpenDialogReturnValue | { canceled: false; filePath: string; }> {
  const options: OpenDialogOptions = {
    title: "选择应用程序",
    properties: ["openFile"]
  };

  // 在Windows上添加可执行文件筛选器
  if (process.platform === "win32") {
    options.filters = [
      { name: "可执行文件", extensions: ["exe", "cmd", "bat"] },
      { name: "所有文件", extensions: ["*"] }
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
async function openFolder(folderPath: string): Promise<boolean> {
  if (fs.existsSync(folderPath)) {
    await shell.openPath(folderPath);
    return true;
  }
  return false;
}

interface ProgressInfo {
  percent: number;
  status: "cloning" | "completed";
}

/**
 * 克隆GitHub仓库
 * @param {string} repoUrl 仓库URL
 * @param {string} targetPath 目标路径
 * @param {function} progressCallback 进度回调函数
 * @returns {Promise<{success: boolean, message: string}>} 克隆结果
 */
async function cloneGitRepository(
  repoUrl: string,
  targetPath: string,
  progressCallback?: (info: ProgressInfo) => void
): Promise<{ success: boolean, message: string }> {
  // 确保目标目录存在
  const dirPath = path.dirname(targetPath);
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (err: any) {
      return {
        success: false,
        message: `创建目录失败: ${err.message}`
      };
    }
  }

  return new Promise((resolve, _) => {
    // 检查目标路径是否已存在并且不为空
    if (fs.existsSync(targetPath) && fs.readdirSync(targetPath).length > 0) {
      return resolve({
        success: false,
        message: "目标目录已存在且不为空"
      });
    }

    // 使用git clone命令克隆仓库
    const gitProcess = spawn("git", ["clone", repoUrl, targetPath]);

    let stdoutData = "";
    let stderrData = "";
    let progressPercent = 0;

    // 从git输出解析进度
    gitProcess.stderr.on("data", (data) => {
      stderrData += data.toString();

      // 尝试从git输出中提取进度信息
      const progressLines = data.toString().split("\n");
      for (const line of progressLines) {
        if (line.includes("Receiving objects:")) {
          const match = line.match(/Receiving objects:\s+(\d+)%/);
          if (match && match[1]) {
            const newPercent = parseInt(match[1], 10);
            if (newPercent > progressPercent) {
              progressPercent = newPercent;
              if (progressCallback) {
                progressCallback({
                  percent: progressPercent,
                  status: "cloning"
                });
              }
            }
          }
        }
      }
    });

    gitProcess.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    gitProcess.on("close", (code) => {
      if (code === 0) {
        if (progressCallback) {
          progressCallback({
            percent: 100,
            status: "completed"
          });
        }
        resolve({
          success: true,
          message: "克隆成功"
        });
      } else {
        resolve({
          success: false,
          message: `克隆失败 (exit code ${code}): ${stderrData}`
        });
      }
    });

    gitProcess.on("error", (err) => {
      resolve({
        success: false,
        message: `克隆出错: ${err.message}`
      });
    });
  });
}

/**
 * 检查路径是否存在
 * @param {string} pathToCheck 要检查的路径
 * @returns {boolean} 路径是否存在
 */
function pathExists(pathToCheck: string): boolean {
  return fs.existsSync(pathToCheck);
}

export {
  selectDatabasePath,
  selectFolder,
  selectExecutable,
  openFolder,
  cloneGitRepository,
  pathExists
};
