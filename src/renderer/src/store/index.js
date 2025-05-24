import { defineStore } from "pinia";

// 获取正确的API接口 - 适应纯客户端环境
const getAPI = () => {
  // 尝试不同的API访问方式，按优先级排序
  if (typeof electronAPI !== "undefined") {
    return electronAPI;
  } else if (typeof window !== "undefined" && window.electronAPI) {
    return window.electronAPI;
  } else if (typeof window !== "undefined" && window.api) {
    return window.api;
  }

  console.error("无法访问Electron API接口");
  return null;
};

export const useAppStore = defineStore("app", {
  state: () => ({
    // Database state
    dbInitialized: false,
    dbPath: "",

    // Theme state
    theme: "light",

    // Settings
    settings: {
      dbPath: "",
      theme: "light",
      githubProjectsPath: ""
    },

    // Folders and projects
    folders: [],
    currentFolder: null,
    lastCreatedFolderId: null,
    folderToEdit: null,

    // Projects
    projects: [],
    currentProject: null,
    // Search state
    searchQuery: "",

    // UI state
    loading: false,
    error: null,

    // Favorite status - 用于追踪收藏状态的变化
    favoriteStatus: 0,
    openProjects: []
  }),

  getters: {
    // 构建文件夹树
    folderTree: (state) => {
      if (!state.folders || !state.folders.length) {
        return [];
      }

      // 将文件夹数组转换为树形结构
      const buildTree = (parentId = null) => {
        return state.folders
          .filter(folder => folder.parent_id === parentId)
          .map(folder => ({
            ...folder,
            children: buildTree(folder.id)
          }))
          .sort((a, b) => a.order_index > b.order_index);
      };

      return buildTree(null);
    },
    getAPI: () => {
      return getAPI();
    },
    getLastCreatedFolderId: (state) => {
      return state.lastCreatedFolderId;
    },
    getOpenProjects: (state) => {
      return state.openProjects;
    }
  },

  actions: {
    async initializeApp() {
      this.loading = true;
      try {
        const api = getAPI();
        // Get settings from electron store
        const settings = await api.getAppSettings();
        this.dbPath = settings.dbPath;
        this.theme = settings.theme;
        this.settings = settings;
        // Load initial data
        await this.loadFolders();

        document.documentElement.setAttribute("data-theme", this.theme);
        document.documentElement.classList.toggle("dark", this.theme === "dark");

        this.loading = false;
      } catch (error) {
        this.error = error.message;
        this.loading = false;
        console.error("Failed to initialize app:", error);
      }
    },

    async loadFolders() {
      try {
        const api = getAPI();
        this.folders = await api.getFolders();
      } catch (error) {
        console.error("Failed to load folders:", error);
        this.error = "Failed to load folders";
      }
    },

    async loadProjects(folderId = null) {
      try {
        const api = getAPI();
        this.projects = await api.getProjects(folderId);
        return this.projects;
      } catch (error) {
        console.error("Failed to load projects:", error);
        this.error = "Failed to load projects";
      }
    },

    async createFolder(folder) {
      try {
        const api = getAPI();
        if (!api) throw new Error("API未初始化");

        const newFolder = await api.createFolder(folder);
        this.lastCreatedFolderId = newFolder.id;
        await this.loadFolders();
        return newFolder;
      } catch (error) {
        console.error("Failed to create folder:", error);
        this.error = "Failed to create folder";
        throw error;
      }
    },

    async createProject(project) {
      try {
        const api = getAPI();
        // 处理preferred_ide，确保它是JSON字符串
        const projectToCreate = { ...project };
        if (Array.isArray(projectToCreate.preferred_ide)) {
          projectToCreate.preferred_ide = JSON.stringify(projectToCreate.preferred_ide);
        }

        // 确保tag数组也是JSON字符串
        if (Array.isArray(projectToCreate.tags)) {
          projectToCreate.tags = JSON.stringify(projectToCreate.tags);
        }
        if (projectToCreate.prompt_arguments) {
          projectToCreate.prompt_arguments = JSON.stringify(projectToCreate.prompt_arguments);
        }
        if (projectToCreate.prompt_messages) {
          projectToCreate.prompt_messages = JSON.stringify(projectToCreate.prompt_messages);
        }
        const newProject = await api.createProject(projectToCreate);
        await this.loadProjects(project.folder_id);
        return newProject;
      } catch (error) {
        console.error("Failed to create project:", error);
        this.error = "Failed to create project";
        throw error;
      }
    },

    async updateFolder(folder) {
      try {
        console.log("开始更新文件夹:", JSON.stringify(folder));

        const api = getAPI();
        if (!api) throw new Error("API未初始化");

        // 确保parent_id字段正确处理
        if (folder.parent_id === undefined) {
          console.warn("更新文件夹时parent_id未定义，将使用原始值");
        } else if (folder.parent_id === null) {
          console.log("更新文件夹为根级文件夹 (parent_id = null)");
        }

        // 确保order字段正确处理
        if (folder.order !== undefined) {
          console.log("处理文件夹顺序值:", folder.order);
          // order字段在数据库中是order_index
          folder.order_index = folder.order;
          delete folder.order;
        }

        // 打印完整的更新数据
        console.log("发送到后端的完整更新数据:", JSON.stringify(folder));

        const updatedFolder = await api.updateFolder(folder.id, folder);
        console.log("文件夹更新成功:", updatedFolder.id,
          "新parent_id =", updatedFolder.parent_id,
          "新order_index =", updatedFolder.order_index);

        // 强制重新加载文件夹以确保UI更新
        await this.loadFolders();
        return updatedFolder;
      } catch (error) {
        console.error("更新文件夹失败:", error, "文件夹数据:", folder);
        this.error = "更新文件夹失败: " + error.message;
        throw error;
      }
    },

    async updateProject(id, data) {
      try {
        const api = getAPI();
        // 处理preferred_ide，确保它是JSON字符串
        const dataToUpdate = { ...data };

        // 确保preferred_ide是JSON字符串
        if (Array.isArray(dataToUpdate.preferred_ide)) {
          dataToUpdate.preferred_ide = JSON.stringify(dataToUpdate.preferred_ide);
        }

        // 确保tag数组也是JSON字符串
        if (Array.isArray(dataToUpdate.tags)) {
          dataToUpdate.tags = JSON.stringify(dataToUpdate.tags);
        }
        // 确保日期字段是ISO字符串
        if (dataToUpdate.last_opened_at instanceof Date) {
          dataToUpdate.last_opened_at = dataToUpdate.last_opened_at.toISOString();
        }

        const project = await api.updateProject(id, dataToUpdate);
        await this.loadProjects(data.folder_id);
        return project;
      } catch (error) {
        console.error("Failed to update project:", error);
        this.error = "Failed to update project";
        throw error;
      }
    },

    async deleteFolder(folder) {
      try {
        const api = getAPI();
        await api.deleteFolder(folder.id);
        await this.loadFolders();
        return true;
      } catch (error) {
        console.error("Failed to delete folder:", error);
        this.error = "Failed to delete folder";
        throw error;
      }
    },

    async deleteProject(id) {
      try {
        // Get the folder ID before deleting
        const project = this.projects.find(p => p.id === id);
        const folderId = project ? project.folder_id : null;

        const api = getAPI();
        if (!api) throw new Error("API未初始化");
        await api.deleteProject(id);
        if (folderId) {
          await this.loadProjects(folderId);
        } else {
          await this.loadProjects();
        }
        return true;
      } catch (error) {
        console.error("Failed to delete project:", error);
        this.error = "Failed to delete project";
        throw error;
      }
    },

    async openProjectWithIDE(project, specificIde = null) {
      try {
        const api = getAPI();
        if (!api) throw new Error("API未初始化");

        // 处理preferred_ide，确保它是数组格式
        let preferredIdes = [];
        if (specificIde) {
          // 如果指定了特定IDE，直接使用
          preferredIdes = [specificIde];
        } else if (project.preferred_ide) {
          if (typeof project.preferred_ide === "string") {
            try {
              // 尝试解析JSON字符串
              preferredIdes = JSON.parse(project.preferred_ide);
            } catch (e) {
              // 如果解析失败，假设它是单个IDE字符串
              preferredIdes = [project.preferred_ide];
            }
          } else if (Array.isArray(project.preferred_ide)) {
            preferredIdes = project.preferred_ide;
          }
        }

        // 如果有多个IDE且未指定具体IDE，可能需要让用户选择
        let ideToUse = preferredIdes[0]; // 默认使用第一个
        if (!specificIde && preferredIdes.length > 1) {
          // 这里可以添加逻辑让用户选择IDE
          // 现在简单使用第一个
        }

        // Update last opened timestamp
        await this.updateProject(project.id, {
          ...project,
          last_opened_at: new Date().toISOString() // 确保是ISO字符串格式
        });

        // Call electron API to open with IDE
        return await api.openWithIDE(project.path, ideToUse);
      } catch (error) {
        console.error("Failed to open project with IDE:", error);
        this.error = "Failed to open project with IDE";
        throw error;
      }
    },

    async searchProjects(query) {
      try {
        const api = getAPI();
        if (!api) throw new Error("API未初始化");

        this.searchQuery = query;
        this.projects = await api.searchProjects(query);
        return this.projects;
      } catch (error) {
        console.error("Failed to search projects:", error);
        this.error = "Failed to search projects";
        throw error;
      }
    },

    async changeTheme(theme) {
      const api = getAPI();
      if (!api) throw new Error("API未初始化");

      this.theme = theme;
      document.documentElement.setAttribute("data-theme", theme);
      document.documentElement.classList.toggle("dark", theme === "dark");
      await api.saveAppSettings({ theme });
    },

    async changeDbPath(newPath) {
      try {
        const api = getAPI();
        if (!api) throw new Error("API未初始化");

        this.dbPath = newPath;
        await api.saveAppSettings({ dbPath: newPath });

        // After changing db path, we need to reload data
        await this.loadFolders();
        return true;
      } catch (error) {
        console.error("Failed to change database path:", error);
        this.error = "Failed to change database path";
        throw error;
      }
    },

    // 添加收藏项目
    async toggleFavoriteProject(project) {
      try {
        await this.updateProject(project.id, {
          is_favorite: project.is_favorite === 0 ? 1 : 0
        });
        // 更新 favoriteStatus 状态，触发监听器
        this.favoriteStatus += 1;
        return true;
      } catch (error) {
        console.error("收藏项目操作失败:", error);
        this.error = "收藏项目操作失败";
        throw error;
      }
    },
    setFolderToEdit(folder) {
      this.folderToEdit = folder;
    },

    clearFolderToEdit() {
      this.folderToEdit = null;
    }
  }
});
