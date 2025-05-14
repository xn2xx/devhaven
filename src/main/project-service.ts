import { dbService } from './db-service'
import { execSync } from 'child_process'
import fs from 'fs'

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
  }
}
/**
 * 更新项目
 */
export const updateProject = (id: number, project: DevHaven.Project) => {
  // 更新项目
  const savedProject = dbService.projects.update(id, project)
  // 保存项目tag
  const tags = project.tags ? JSON.parse(project.tags) : [];
  if (savedProject) {
    saveProjectTag(id, tags)
  }
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
