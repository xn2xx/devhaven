<template>
  <div class="app-container" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
    <!-- 侧边栏 -->
    <Sidebar
      :loading="loading"
      :current-folder="currentFolder"
      @search="handleSearch"
      @select-folder="selectFolder"
      @add-folder="showAddFolderDialog"
      @toggle-collapse="handleSidebarCollapse"
    />

    <!-- 主内容区 -->
    <div class="main-content">
      <div class="content-header">
        <div style="display: flex; align-items: center">
          <div class="breadcrumb">
            <div class="breadcrumb-item">
              <a href="#" class="breadcrumb-link">
                <i class="i-fa-solid:home breadcrumb-icon"></i>
                <span>首页</span>
              </a>
            </div>
            <template v-if="currentFolder">
              <template v-for="(folder) in getFolderPath" :key="folder.id">
                <div class="breadcrumb-item">
                  <a href="#" class="breadcrumb-link" @click.prevent="selectFolder(folder)">
                    <span>{{ folder.name }}</span>
                  </a>
                </div>
              </template>
            </template>
          </div>
        </div>

        <div class="page-actions">
          <el-button class="action-btn secondary" @click="showProjectDialog">
            <i class="i-fa-solid:plus action-btn-icon"></i>
            添加项目
          </el-button>
          <button class="theme-toggle" @click="toggleTheme">
            <i :class="isDarkMode ? 'i-fa-solid:sun' : 'i-fa-solid:moon'"></i>
          </button>
          <el-button class="theme-toggle" @click="goToGithubStars">
            <i class="i-fa-brands:github"></i>
          </el-button>
          <el-button class="theme-toggle" @click="goToSettings">
            <i class="i-fa-solid:cog"></i>
          </el-button>
        </div>
      </div>

      <ProjectList
        :loading="loading"
        :search-input="searchInput"
        @add-project="showProjectDialog"
        :current-folder-id="currentFolder?.id"
        @edit-project="editProject"
        @select-folder="selectFolder"
      />
    </div>

    <!-- 弹窗 -->
    <ProjectDialog
      v-model:visible="projectDialogVisible"
      :project-data="currentProject"
      :current-folder-id="currentFolder?.id"
      @save="addProject"
    />
  </div>
</template>

<script setup>
import { useAppStore } from "@/store";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
// 导入组件
import Sidebar from "@/views/home/components/Sidebar.vue";
import ProjectList from "@/views/home/components/ProjectList.vue";
import ProjectDialog from "@/views/home/components/ProjectDialog.vue";

// Store
const store = useAppStore();
const router = useRouter();

// 状态
const loading = ref(false);
const searchInput = ref("");
const currentFolder = ref(null);
const isSidebarCollapsed = ref(false);

// 计算属性
const isDarkMode = computed(() => store.theme === "dark");

// 对话框可见性
const projectDialogVisible = ref(false);
const currentProject = ref(null);

// 方法
const toggleTheme = async () => {
  const newTheme = isDarkMode.value ? "light" : "dark";
  await store.changeTheme(newTheme);
};
// 方法
const selectFolder = (folder) => {
  currentFolder.value = folder;
};
const handleSearch = async (query) => {
  searchInput.value = query;

  if (query.length > 0) {
    loading.value = true;
    try {
      await store.searchProjects(query);
      currentFolder.value = null;
    } catch (error) {
      ElMessage.error("搜索失败");
    } finally {
      loading.value = false;
    }
  } else {
    // 清除搜索并恢复之前的视图
    if (currentFolder.value) {
      await loadProjectsForFolder(currentFolder.value.id);
    } else {
      await store.loadProjects();
    }
  }
};

const showAddFolderDialog = async (parentId = null) => {
  try {
    const newFolder = {
      name: "未命名文件夹",
      parent_id: parentId || currentFolder.value?.id || null,
      description: "",
      icon: "folder"
    };

    await store.createFolder(newFolder);
    // 刷新文件夹列表
    await store.loadFolders();

    // 将最新创建的文件夹标记为需要编辑的
    store.setFolderToEdit({ ...newFolder, id: store.getLastCreatedFolderId() });
  } catch (error) {
    ElMessage.error("添加文件夹失败");
  }
};

const showProjectDialog = () => {
  currentProject.value = {
    name: "",
    folder_id: currentFolder.value?.id || null,
    description: "",
    path: "",
    preferred_ide: ["vscode"],
    icon: "code"
  };
  projectDialogVisible.value = true;
};

const loadProjectsForFolder = async (folderId) => {
  loading.value = true;
  try {
    await store.loadProjects(folderId);
  } catch (error) {
    ElMessage.error("加载项目失败");
  } finally {
    loading.value = false;
  }
};

const addProject = async (project) => {
  try {
    if (project.id) {
      await store.updateProject(project.id, project);
    } else {
      await store.createProject(project);
    }

    // 根据项目所属文件夹刷新项目列表
    if (project.folder_id) {
      // 如果当前不在项目所属文件夹，则切换到该文件夹
      if (currentFolder.value?.id !== project.folder_id) {
        // 查找项目所属文件夹
        const targetFolder = store.folders.find(f => f.id === project.folder_id);
        if (targetFolder) {
          // 切换到项目所属文件夹
          selectFolder(targetFolder);
        } else {
          // 如果找不到文件夹，则刷新当前文件夹的项目
          await loadProjectsForFolder(currentFolder.value?.id);
        }
      } else {
        // 当前就在项目所属文件夹，直接刷新
        await loadProjectsForFolder(currentFolder.value.id);
      }
    } else {
      // 如果项目没有所属文件夹，则刷新当前视图
      if (currentFolder.value) {
        await loadProjectsForFolder(currentFolder.value.id);
      } else {
        await store.loadProjects();
      }
    }

    ElMessage.success("项目更新成功");
  } catch (error) {
    console.error("更新项目失败:", error);
    ElMessage.error("更新项目失败");
  }
};

const editProject = (project) => {
  // 编辑项目的实现
  currentProject.value = { ...project };
  projectDialogVisible.value = true;
};

const handleSidebarCollapse = (collapsed) => {
  isSidebarCollapsed.value = collapsed;
};

const goToSettings = () => {
  router.push("/settings");
};

const goToGithubStars = () => {
  router.push("/github-stars");
};

// 生命周期钩子
onMounted(async () => {
  loading.value = true;
  try {
    await store.initializeApp();
    await store.loadFolders();
    await store.loadProjects();
  } catch (error) {
    ElMessage.error("初始化应用失败");
  } finally {
    loading.value = false;
  }
});

const getFolderPath = computed(() => {
  if (!currentFolder.value) return [];

  const path = [];
  let currentFolderObj = { ...currentFolder.value };

  // 先添加当前文件夹
  path.unshift(currentFolderObj);

  // 循环查找父文件夹，直到找到根文件夹
  while (currentFolderObj.parent_id) {
    // 在 store.folders 中查找父文件夹
    const parentFolder = store.folders.find(f => f.id === currentFolderObj.parent_id);
    if (parentFolder) {
      // 将父文件夹添加到路径前面
      path.unshift(parentFolder);
      currentFolderObj = parentFolder;
    } else {
      // 如果找不到父文件夹，退出循环
      break;
    }
  }

  return path;
});

</script>

<style scoped>
/* 使用HTML模板中的样式 */
.breadcrumb {
  display: flex;
  align-items: center;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
}

.breadcrumb-item:not(:last-child):after {
  content: '/';
  margin: 0 8px;
  color: var(--text-muted);
}

.breadcrumb-link {
  color: var(--text-secondary);
  text-decoration: none;
  display: flex;
  align-items: center;
}

.breadcrumb-icon {
  margin-right: 6px;
}

.breadcrumb-link:hover {
  color: var(--primary-color);
}

.page-actions {
  display: flex;
  align-items: center;
}

.action-btn {
  padding: 8px 16px;
  margin-left: 8px;
  border-radius: 6px;
  border: none;
  background-color: var(--primary-color);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 14px;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background-color: var(--primary-dark);
}

.action-btn-icon {
  margin-right: 6px;
}

.action-btn.secondary {
  background-color: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-color);
}

.action-btn.secondary:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.theme-toggle {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: none;
  background-color: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  transition: background-color 0.2s;
}

.theme-toggle:hover {
  background-color: var(--bg-color);
  color: var(--text-color);
}
</style>
