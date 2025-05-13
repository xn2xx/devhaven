import { dbService } from './db-service'
import { execSync } from 'child_process'
import fs from 'fs'

export const getProjects = (folderId: string | null): DevHaven.Project[] => {
  const projects = dbService.projects.getAll(folderId) as DevHaven.Project[]
  // 获取project实际的git_branch
  projects.forEach((project: DevHaven.Project) => {
    project.branch = getProjectBranch(project.path)
  })
  return projects
}

// 从当前项目目录获取git_branch
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
