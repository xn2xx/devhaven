import { dbService } from './db-service'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import os from 'os'

/**
 * 获取prompt模板目录路径
 */
const getPromptTemplateDir = (): string => {
  return path.join(os.homedir(), '.devhaven', 'prompt', 'template')
}

/**
 * 确保prompt模板目录存在
 */
const ensurePromptTemplateDir = (): void => {
  const dir = getPromptTemplateDir()

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * 生成prompt的YAML内容
 */
const generatePromptYaml = (project: DevHaven.Project): string => {
  try {
    const args = typeof project.prompt_arguments === 'string'
      ? JSON.parse(project.prompt_arguments)
      : project.prompt_arguments || [];
    const messages = typeof project.prompt_messages === 'string'
      ? JSON.parse(project.prompt_messages)
      : project.prompt_messages || [];

    let yaml = `name: ${project.name}\n`;
    yaml += `description: ${project.description || ''}\n`;

    if (args.length > 0) {
      yaml += 'arguments:\n';
      args.forEach((arg: any) => {
        yaml += `  - name: ${arg.name}\n`;
        yaml += `    description: ${arg.description}\n`;
        yaml += `    required: ${arg.required}\n`;
      });
    }

    if (messages.length > 0) {
      yaml += 'messages:\n';
      messages.forEach((msg: any) => {
        yaml += `  - role: ${msg.role}\n`;
        yaml += `    content:\n`;
        yaml += `      type: text\n`;
        yaml += `      text: |\n`;
        msg.content.text.split('\n').forEach((line: string) => {
          yaml += `        ${line}\n`;
        });
      });
    }

    return yaml;
  } catch (error) {
    console.error('生成YAML失败:', error);
    return `name: ${project.name}\ndescription: ${project.description || ''}`;
  }
}

/**
 * 同步prompt到文件系统
 */
const syncPromptToFile = (project: DevHaven.Project): void => {
  if (project.type !== 'prompt') return;

  try {
    ensurePromptTemplateDir();
    const filePath = path.join(getPromptTemplateDir(), `${project.id}.yaml`);
    const yamlContent = generatePromptYaml(project);
    fs.writeFileSync(filePath, yamlContent, 'utf8');
    console.log(`Prompt文件已同步: ${filePath}`);
  } catch (error) {
    console.error('同步prompt文件失败:', error);
  }
}

/**
 * 删除prompt文件
 */
const deletePromptFile = (projectId: number): void => {
  try {
    const filePath = path.join(getPromptTemplateDir(), `${projectId}.yaml`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Prompt文件已删除: ${filePath}`);
    }
  } catch (error) {
    console.error('删除prompt文件失败:', error);
  }
}

/**
 * 获取项目列表
 * @param folderId 文件夹id
 * @returns 项目列表
 */
export const getProjects = (folderId: string | null): DevHaven.Project[] => {
  const projects = dbService.projects.getAll(folderId) as DevHaven.Project[]
  // 获取project实际的git_branch
  projects.forEach((project: DevHaven.Project) => {
    project.branch = getProjectBranch(project.path)
    // 获取项目的tags
    project.tags = dbService.projects.getProjectTags(project.id).map((tag: DevHaven.Tag) => tag.name)
  })
  return projects
}

/**
 * 创建项目
 */
export const createProject = (project: DevHaven.Project) => {
  // 创建项目
  const savedProject = dbService.projects.create(project)
  // 保存项目tag
  const tags = project.tags ? JSON.parse(project.tags) : [];
  if (savedProject) {
    saveProjectTag(savedProject.id, tags)
    // 如果是prompt类型，同步到文件系统
    if (savedProject.type === 'prompt') {
      syncPromptToFile(savedProject)
    }
  }
  return savedProject
}

/**
 * 更新项目
 */
export const updateProject = (id: number, project: DevHaven.Project) => {
  // 更新项目
  const savedProject = dbService.projects.update(id, project) as DevHaven.Project
  // 保存项目tag
  const tags = project.tags ? JSON.parse(project.tags) : [];
  if (savedProject) {
    saveProjectTag(id, tags)
    // 如果是prompt类型，同步到文件系统
    if (savedProject.type === 'prompt') {
      syncPromptToFile(savedProject)
    }
  }
  return savedProject
}

/**
 * 删除项目
 */
export const deleteProject = (id: number) => {
  // 先获取项目信息，判断是否为prompt类型
  const project = dbService.projects.getById(id) as DevHaven.Project

  // 删除项目
  const result = dbService.projects.delete(id)

  // 如果删除成功且是prompt类型，删除对应的文件
  if (result && project && project.type === 'prompt') {
    deletePromptFile(id)
  }

  return result
}

const saveProjectTag = (projectId: number, tags: string[] | undefined) => {
  if (tags) {
    const tagList = dbService.tags.getAll() as DevHaven.Tag[]
    const needSaveTags: DevHaven.Tag[] = []
    tags.forEach((tag: string) => {
      const findTag = tagList.find((t: DevHaven.Tag) => t.name === tag)
      if (findTag) {
        needSaveTags.push(findTag)
      } else {
        const insertTag = { name: tag, created_at: new Date().toISOString() } as DevHaven.Tag
        needSaveTags.push(dbService.tags.create(insertTag))
      }
    })
    if (needSaveTags.length > 0) {
      dbService.projects.saveProjectTag(projectId, needSaveTags)
    }
  }
}

/**
 * 获取项目分支
 * @param projectPath 项目路径
 * @returns 项目分支
 */
const getProjectBranch = (projectPath: string) => {
  // 如果项目目录不存在，则返回空字符串
  if (!fs.existsSync(projectPath)) {
    return ''
  }
  try {
    return execSync(`git -C ${projectPath} branch --show-current`).toString().trim()
  } catch (error) {
    console.error(`Error getting project branch for ${projectPath}:`, error)
    return ''
  }
}
