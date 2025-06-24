
import fs from 'fs';
import os from 'os'
import path from 'path'
import { dbService } from './db-service'
const memoryData: DevHaven.OpenProject[] = []

/**
 * 获取打开的项目
 * @returns Promise<OpenProject[]> 打开的项目列表
 */
async function getOpenProjects(): Promise<DevHaven.OpenProject[]> {
  try {
    // 查询%HOME/.debhaven/projects的文件列表
    const filePath = path.join(os.homedir(), '.devhaven/projects')

    // 检查目录是否存在
    if (!fs.existsSync(filePath)) {
      await fs.promises.mkdir(filePath, { recursive: true });
      return [];
    }

    // 使用异步读取文件列表
    const files = await fs.promises.readdir(filePath);

    // 处理文件并获取项目信息
    const projects: DevHaven.OpenProject[] = [];

    for (const file of files) {
      try {
        // 检查文件名格式是否正确
        const parts = file.split('-');
        if (parts.length !== 2) continue;

        const [ide, base64Path] = parts;
        const projectPath = Buffer.from(base64Path, 'base64').toString('utf-8');

        // 获取项目信息
        const project = dbService.projects.getByPath(projectPath) as DevHaven.Project;
        // 查看文件内容
        const fileContent = fs.readFileSync(path.join(filePath, file), 'utf-8');
        const projectInfo = JSON.parse(fileContent);

        if (!project) {
          console.warn(`未找到路径为 ${projectPath} 的项目信息`);
          continue;
        }

        const folder_id = project.folder_id
        // 查询文件夹的名称
        const folder = dbService.folders.getById(folder_id)
        projects.push({
          ide,
          projectName: projectInfo.name,
          projectPath,
          debHavenProject: project,
          folderName: folder ? folder.name : undefined
        } as DevHaven.OpenProject);

      } catch (fileError) {
        console.error(`处理文件 ${file} 时出错:`, fileError);
        // 继续处理下一个文件

      }
    }

    // 更新内存缓存
    memoryData.splice(0, memoryData.length, ...projects);

    return projects;
  } catch (error) {
    console.error('获取打开的项目时出错:', error);
    return [];
  }
}

async function getCurrentEditFile(projectPath: string) {
  const base64Path = Buffer.from(projectPath).toString('base64');
  const filePath = path.join(os.homedir(), '.devhaven/projects', `EDIT-FILE-${base64Path}`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(fileContent);
}

export {
  getOpenProjects,
  getCurrentEditFile
}
