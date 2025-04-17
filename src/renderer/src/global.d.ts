// 全局类型声明文件

// 定义项目相关的命名空间
declare namespace DevHaven {
  // 项目接口定义
  interface Project {
    ide: string;
    projectName: string;
    projectPath: string;
    isFavorite?: boolean;
    debHavenProject?: any;
    editInfo?: EditInfo;
  }
  interface EditInfo {
    filePath?: string;
    line?: number;
    column?: number;
  }

}

// 扩展Window接口，添加api属性
interface Window {
  api: {
    getOpenProjects: () => Promise<DevHaven.Project[]>;
    resumeIde: (project: DevHaven.Project) => Promise<void>;
    ipcRenderer: {
      on: (channel: string, listener: (...args: any[]) => void) => void;
      removeListener: (channel: string, listener: (...args: any[]) => void) => void;
    };
  };
}
