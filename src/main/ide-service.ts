import { spawn } from 'child_process'
import fs from 'fs'
import * as ideDetector from './ide-detector'
import { dbService } from './db-service'
import { getCurrentEditFile, getOpenProjects } from './open-project-service'

// 类型定义
interface ErrorResponse {
  success: false
  error: string
}

interface SuccessResponse {
  success: true
}

type OperationResult = ErrorResponse | SuccessResponse

// IDE类型常量映射
const IDE_TYPES = {
  WEBSTORM: 'webstorm',
  IDEA: 'idea',
  PYCHARM: 'pycharm',
  CURSOR: 'cursor',
  VSCODE: 'vscode'
} as const

/**
 * 检测并初始化IDE配置
 * @returns {Promise<DevHaven.IdeConfig[]>} 已配置的IDE列表
 */
async function initIdeConfigs(): Promise<DevHaven.IdeConfig[]> {
  try {
    console.log('开始检测系统已安装的IDE...')

    // 获取当前已配置的IDE
    const existingIdes = dbService.ideConfigs.getAll() as DevHaven.IdeConfig[]
    // 检测系统安装的IDE
    const detectedIdes = await ideDetector.detectIdes()
    console.log(`检测到 ${detectedIdes.length} 个IDE`)

    // 使用Promise.all批量处理IDE配置更新
    await Promise.all(
      detectedIdes.map(async (ide) => {
        try {
          const existingIde = existingIdes.find((existing) => existing.name === ide.name)

          if (existingIde) {
            // 只在命令发生变化时更新
            if (existingIde.command !== ide.command) {
              console.log(`更新IDE配置: ${ide.name} (${ide.command})`)
              await dbService.ideConfigs.update(existingIde.id, {
                ...ide,
                id: existingIde.id,
                display_name: ide.display_name || existingIde.display_name
              } as DevHaven.IdeConfig)
            }
          } else {
            // 添加新检测到的IDE
            console.log(`添加新检测到的IDE: ${ide.name} (${ide.command})`)
            await dbService.ideConfigs.create({
              id: 0, // 数据库会自动生成ID
              name: ide.name,
              display_name: ide.display_name,
              command: ide.command,
              args: ide.args
            } as DevHaven.IdeConfig)
          }
        } catch (error: any) {
          console.error(`处理IDE ${ide.name} 配置失败:`, error)
        }
      })
    )

    console.log('IDE配置初始化完成')
    return dbService.ideConfigs.getAll() as DevHaven.IdeConfig[]
  } catch (error: any) {
    console.error('IDE配置初始化失败:', error)
    throw error
  }
}

/**
 * 使用指定IDE打开项目
 * @param {string} projectPath 项目路径
 * @param {string} ideName IDE名称
 * @returns {Promise<OperationResult>} 操作结果
 */
async function openWithIde(projectPath: string, ideName: string): Promise<OperationResult> {
  // 验证项目路径
  if (!fs.existsSync(projectPath)) {
    return { success: false, error: '项目路径不存在' }
  }

  try {
    // 获取IDE配置
    const ideConfig = (await dbService.ideConfigs.getByName(ideName)) as DevHaven.IdeConfig
    if (!ideConfig) {
      return { success: false, error: `未找到IDE配置 "${ideName}"` }
    }

    if (!ideConfig.command) {
      return { success: false, error: '命令为空' }
    }

    // 获取当前编辑文件信息
    let currentEditFile = await getCurrentEditFileInfo(projectPath)
    const openProjects = await getOpenProjects()
    // 查询是否使用idea进行打开了
    const find = openProjects.find((project) => project.ide.toLowerCase() === ideName)
    // 如果没有打开, 则编辑文件为空，使用传统的打开方式
    if (!find) {
      currentEditFile = undefined
    }

    // 处理打开项目或文件的命令参数
    const { command, args } = await prepareCommandAndArgs(ideConfig, projectPath, currentEditFile)

    // 执行命令打开IDE
    return executeCommand(command, args)
  } catch (error: any) {
    console.error('使用IDE打开时出错:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 获取当前编辑文件信息
 * @param {string} projectPath 项目路径
 * @returns {Promise<any>} 当前编辑文件信息或null
 */
async function getCurrentEditFileInfo(projectPath: string): Promise<any> {
  // 判断是否已经打开了项目
  const openProjects = await getOpenProjects()
  const openProject = openProjects.find((project) => project.projectPath === projectPath)

  if (!openProject) {
    return null
  }

  const currentEditFile = await getCurrentEditFile(projectPath)

  // 验证文件是否存在
  if (currentEditFile?.filePath && !fs.existsSync(currentEditFile.filePath)) {
    return null
  }

  return currentEditFile
}

/**
 * 准备命令和参数
 * @param {DevHaven.IdeConfig} ideConfig IDE配置
 * @param {string} projectPath 项目路径
 * @param {any} currentEditFile 当前编辑文件信息
 * @returns {Promise<{command: string, args: string[]}>} 命令和参数
 */
async function prepareCommandAndArgs(
  ideConfig: DevHaven.IdeConfig,
  projectPath: string,
  currentEditFile: any
): Promise<{ command: string; args: string[] }> {
  // 处理命令参数
  let args: string[]
  if (ideConfig.args) {
    // 替换参数中的占位符
    const processedArgs = ideConfig.args.replace(/{projectPath}/g, projectPath)
    args = processedArgs.split(' ').filter((arg: string) => arg.trim())
  } else {
    args = [projectPath]
  }

  console.log(`使用IDE打开: ${ideConfig.command} ${args.join(' ')}`)

  // 处理macOS上特殊的情况
  if (process.platform === 'darwin' && ideConfig.command.endsWith('.app')) {
    return prepareMacCommand(ideConfig, projectPath, currentEditFile)
  }

  // 其他平台或常规命令
  return { command: ideConfig.command, args }
}

/**
 * 为macOS准备命令和参数
 * @param {DevHaven.IdeConfig} ideConfig IDE配置
 * @param {string} projectPath 项目路径
 * @param {any} currentEditFile 当前编辑文件信息
 * @returns {{command: string, args: string[]}} 命令和参数
 */
function prepareMacCommand(
  ideConfig: DevHaven.IdeConfig,
  projectPath: string,
  currentEditFile: any
): { command: string; args: string[] } {
  const command = 'open'

  // VS Code或Cursor
  if (ideConfig.name.includes('vscode') || ideConfig.name.includes('cursor')) {
    if (currentEditFile?.filePath) {
      return {
        command,
        args: [
          '-a',
          ideConfig.command,
          `cursor://file${currentEditFile.filePath}:${currentEditFile.line}:${currentEditFile.column}`
        ]
      }
    } else {
      return {
        command,
        args: ['-a', ideConfig.command, `cursor://file${projectPath}?windowId=_blank`]
      }
    }
  }

  // Xcode
  if (ideConfig.command.includes('Xcode.app')) {
    return {
      command,
      args: ['-a', 'Xcode', projectPath]
    }
  }

  // JetBrains IDEs (IntelliJ IDEA, WebStorm, PyCharm)
  if (
    ideConfig.name.includes('idea') ||
    ideConfig.name.includes('webstorm') ||
    ideConfig.name.includes('pycharm')
  ) {
    if (currentEditFile?.filePath) {
      return {
        command,
        args: [
          '-a',
          ideConfig.command,
          `idea://open?file=${currentEditFile.filePath}&line=${currentEditFile.line}&column=${currentEditFile.column}`
        ]
      }
    } else {
      return {
        command,
        args: ['-a', ideConfig.command, `idea://open?file=${projectPath}`]
      }
    }
  }

  // 其他.app应用
  return {
    command,
    args: ['-a', ideConfig.command, projectPath]
  }
}

/**
 * 执行命令
 * @param {string} command 命令
 * @param {string[]} args 命令参数
 * @returns {OperationResult} 操作结果
 */
function executeCommand(command: string, args: string[]): OperationResult {
  console.log(`执行命令: ${command} ${args.join(' ')}`)

  try {
    // 确保文件有执行权限
    if (command.startsWith('/') && fs.existsSync(command)) {
      try {
        fs.chmodSync(command, '755')
      } catch (error: any) {
        console.warn(`无法修改文件权限: ${error.message}`)
      }
    }

    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore'
    })

    child.on('error', (error) => {
      console.error('执行命令失败:', error)
    })

    child.unref()
    return { success: true }
  } catch (error: any) {
    console.error('执行命令时出错:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 恢复IDE
 * @param {DevHaven.Project} project 项目对象
 * @returns {Promise<OperationResult>} 操作结果
 */
async function resumeIde(project: DevHaven.Project): Promise<OperationResult> {
  // 获取IDE类型
  const ideType = getIdeType(project.ide)

  if (!ideType) {
    console.error('未找到IDE类型', project.ide)
    return { success: false, error: '未找到IDE类型' }
  }

  // 获取IDE配置
  const ideConfig = (await dbService.ideConfigs.getByName(ideType)) as DevHaven.IdeConfig
  if (!ideConfig) {
    console.error('未找到IDE配置', ideType)
    return { success: false, error: '未找到IDE配置' }
  }

  // 打开IDE
  return openWithIde(project.projectPath, ideConfig.name)
}

/**
 * 获取IDE类型
 * @param {string} ide IDE字符串
 * @returns {string|null} IDE类型
 */
const getIdeType = (ide: string): string | null => {
  ide = ide.toLowerCase()

  if (ide.includes('webstorm')) {
    return IDE_TYPES.WEBSTORM
  } else if (ide.includes('idea')) {
    return IDE_TYPES.IDEA
  } else if (ide.includes('pycharm')) {
    return IDE_TYPES.PYCHARM
  } else if (ide.includes('cursor')) {
    return IDE_TYPES.CURSOR
  } else if (ide.includes('visual')) {
    return IDE_TYPES.VSCODE
  }

  return null
}

// 导出API
export { initIdeConfigs, openWithIde, resumeIde }
