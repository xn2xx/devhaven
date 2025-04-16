const net = require('net')
const { dbService } = require("./db.service");
type ReportOpenProjectData = {
  type: 'reportOpenProjects'
  name: string
  projects: {
    name: string
    basePath: string
  }[]
}
type Project = {
  ide: string
  projectName: string
  projectPath: string,
  debHavenProject: any
}
const memoryData: Project[] = []

const getIdeaProjects = (): Promise<Project[]> => {
  return new Promise((resolve) => {

    // 发送socket请求
    const socket = net.createConnection({
      host: 'localhost',
      port: 17335
    })

    socket.on('connect', () => {
      console.log('连接到项目监听服务')
      socket.write('GET_PROJECTS\n')
    })

    socket.on('data', (data: Buffer) => {
      try {

        // 转换Buffer为字符串并解析JSON
        const dataStr = data.toString('utf-8')
        console.log('接收到项目数据:', dataStr)

        const jsonData = JSON.parse(dataStr) as ReportOpenProjectData

        // 更新内存数据
        if (jsonData && jsonData.projects) {
          memoryData.length = 0 // 清空现有数据

          const projects = jsonData.projects.map(project => ({
            ide: "idea",
            projectName: project.name,
            projectPath: project.basePath,
            debHavenProject: dbService.projects.getByPath(project.basePath)
          }))
          memoryData.push(...projects)
        }

        socket.end()
        resolve(memoryData)
      } catch (error) {
        console.error('解析项目数据失败:', error)
        socket.end()
        resolve(memoryData)
      }
    })

    socket.on('error', (error: Error) => {
      console.error('socket连接错误:', error)
      resolve(memoryData)
    })

    socket.on('close', () => {
      console.log('socket连接关闭')
    })
  })
}
/**
 * 获取打开的项目
 * @returns Project[] 打开的项目列表
 */
async function getOpenProjects(): Promise<Project[]> {
  return await getIdeaProjects()
}

module.exports = {
  getOpenProjects
}
