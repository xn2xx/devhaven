// 全局类型声明文件

// 定义项目相关的命名空间
declare namespace DevHaven {
  // 项目接口定义
  interface Project {
    id: number;
    folder_id: number;
    name: string;
    description: string;
    path: string;
    preferred_ide: string;
    icon: string;
    branch: string;
    created_at: string;
    updated_at: string;
    is_favorite: boolean;
    ide: string;
    projectName: string;
    projectPath: string;
    isFavorite?: boolean;
    debHavenProject?: any;
    editInfo?: EditInfo;
    last_opened_at?: any;
  }
  interface EditInfo {
    filePath?: string;
    line?: number;
    column?: number;
  }
  interface Folder {
    id: number;
    name: string;
    parent_id: number;
    icon: string;
    description: string;
    order_index: number;
  }
  interface IdeConfig {
    id: number;
    name: string;
    display_name: string;
    command: string;
    args: string;
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
      send: (channel: string, ...args: any[]) => void;
    };
  };
}
