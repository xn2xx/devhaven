// 全局类型声明文件

// 定义项目相关的命名空间
declare namespace DevHaven {
  // 项目接口定义
  interface Project {
    id: number
    folder_id: number
    name: string
    description: string
    path: string
    preferred_ide: string
    icon: string
    branch: string
    created_at: string
    updated_at: string
    is_favorite: boolean
    ide: string
    projectName: string
    projectPath: string
    isFavorite?: boolean
    debHavenProject?: any
    editInfo?: EditInfo
    last_opened_at?: any
  }

  interface EditInfo {
    filePath?: string
    line?: number
    column?: number
  }

  interface Folder {
    id: number
    name: string
    parent_id: number
    icon: string
    description: string
    order_index: number
  }

  interface IdeConfig {
    id: number
    name: string
    display_name: string
    command: string
    args: string
  }
}
declare namespace GitHub {
  interface GitHubUser {
    login: string;
    id: number;
    avatar_url: string;
    name?: string;
    email?: string;

    [key: string]: any;
  }

  interface AuthStatus {
    isAuthenticated: boolean;
    user?: GitHubUser;
  }

  interface AuthResult {
    success: boolean;
    user?: GitHubUser;
    error?: string;
  }

  interface Repository {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    description: string | null;

    [key: string]: any;
  }
}
