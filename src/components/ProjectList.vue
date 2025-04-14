<template>
  <div class="content-body" v-loading="loading">
    <div v-if="projects.length === 0" class="no-projects">
      <i class="i-fa-solid:folder-open text-8xl text-gray-300 mb-4"></i>
      <h3>未找到项目</h3>
      <p class="text-gray-500 mb-4">
        {{ searchInput ? "没有匹配您搜索条件的项目。" : "开始添加一个新项目吧。" }}
      </p>
      <el-button type="primary" @click="$emit('add-project')">
        <i class="i-fa-solid:plus mr-2"></i>
        添加项目
      </el-button>
    </div>

    <div v-else class="projects-grid">
      <div
        v-for="project in projects"
        :key="project.id"
        class="project-card"
      >
        <div class="card-header">
          <div :class="`project-icon ${getIconClass(project.icon)}`">
            <i :class="`i-fa-solid:${project.icon || 'code'}`"></i>
          </div>
          <div class="card-header-info">
            <h3 class="project-title">{{ project.name }}</h3>
            <div class="project-subtitle">{{ project.description || "暂无描述" }}</div>
          </div>
          <div class="card-menu">
            <el-dropdown trigger="click" @command="handleProjectAction($event, project)">
              <i class="i-fa-solid:ellipsis-v"></i>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="openFolder">
                    <i class="i-fa-solid:folder-open mr-2"></i>
                    打开文件夹
                  </el-dropdown-item>
                  <el-dropdown-item command="edit">
                    <i class="i-fa-solid:edit mr-2"></i>
                    编辑项目
                  </el-dropdown-item>
                  <el-dropdown-item command="favorite">
                    <i
                      :class="['i-fa-solid:star mr-2']"
                      :style="project.is_favorite === 1 ? 'color: #f59e0b;' : ''"></i>
                    {{ project.is_favorite === 1 ? "取消收藏" : "收藏项目" }}
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" divided>
                    <i class="i-fa-solid:trash-alt mr-2 text-red-500"></i>
                    <span class="text-red-500">删除项目</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

        </div>

        <div class="card-body">
          <div class="project-stats">
            <div class="stat-item">
              <i class="i-fa-solid:code-branch stat-icon"></i>
              <span>{{ project.branch || "master" }}</span>
            </div>
            <div class="stat-item">
              <i class="i-fa-solid:clock stat-icon"></i>
              <span>{{ formatDate(project.last_opened_at) || "未打开" }}</span>
            </div>
            <div class="stat-item">
              <i class="i-fa-solid:folder-tree stat-icon"></i>
              <span class="project-folder"
                    @click.stop="navigateToFolder(project.folder_id)">{{ getFolderName(project.folder_id) }}</span>
            </div>
            <div class="stat-item">
              <i @click.stop="handleProjectAction('favorite', project)">
                <i :class="[project.is_favorite ===1? 'i-fa-solid:star' : 'i-fa-solid:star', 'card-action-icon']" :style="project.is_favorite === 1 ? 'color: #f59e0b;' : ''"></i>
              </i>
            </div>
            <div class="stat-item">
              <i class="i-fa-solid:folder stat-icon"></i>
              <span class="project-path">{{ project.path }}</span>
            </div>
          </div>
          <div class="project-tags">
            <span class="project-tag" :class="getTagClass(project.icon)">{{ getProjectType(project.icon) }}</span>
            <span class="project-tag" v-if="getPreferredIdes(project).length === 1">
              {{ getIdeName(getPreferredIdes(project)[0]) }}
            </span>
            <span class="project-tag" v-else>
              多IDE支持
            </span>
          </div>

          <div class="project-description">
            {{ project.description || "该项目暂无描述信息。" }}
          </div>
          <div class="card-actions">
            <button class="card-action-btn" v-for="ide in getPreferredIdes(project)"
                    @click.stop="openProjectWithSpecificIde(project,ide)">
              <i class="i-fa-solid:external-link-alt card-action-icon"></i>
              {{ getIdeName(ide) }}
            </button>
            <button class="card-action-btn secondary" @click.stop="handleProjectAction('openFolder', project)">
              <i class="i-fa-solid:folder-open card-action-icon"></i>
              文件夹
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>

<script setup>
import { useAppStore } from "../store";
import { ElMessage, ElMessageBox } from "element-plus";

const props = defineProps({
  currentFolderId: {
    type: Number,
    default: null
  },
  loading: Boolean,
  searchInput: String
});
const projects = ref([]);
const emit = defineEmits([
  "select-project",
  "add-project",
  "edit-project",
  "favorite-project",
  "select-folder"
]);

// Store
const store = useAppStore();
const folders = computed(() => store.folders);


const handleProjectAction = async (command, project) => {
  switch (command) {
    case "openFolder":
      try {
        await window.electronAPI.openFolder(project.path);
      } catch (error) {
        ElMessage.error("打开文件夹失败");
      }
      break;
    case "edit":
      emit("edit-project", project);
      break;
    case "delete":
      ElMessageBox.confirm(
        "确定要删除此项目吗？",
        "确认删除",
        {
          confirmButtonText: "删除",
          cancelButtonText: "取消",
          type: "warning"
        }
      ).then(async () => {
        try {
          await store.deleteProject(project.id);
          loadProjects();
          ElMessage.success("项目删除成功");
        } catch (error) {
          ElMessage.error("删除项目失败");
        }
      }).catch(() => {
      });
      break;
    case "favorite":
      try {
        await store.toggleFavoriteProject(project);
        project.is_favorite = project.is_favorite === 1 ? 0 : 1;
        emit("favorite-project", project);
        ElMessage.success(project.is_favorite === 1 ? "项目已添加到收藏" : "项目已从收藏中移除");
      } catch (error) {
        console.error(error);
        ElMessage.error("操作收藏失败");
      }
      break;
  }
};

const getIconClass = (icon) => {
  switch (icon) {
    case "server":
      return "backend";
    case "code":
      return "frontend";
    case "database":
      return "database";
    default:
      return "";
  }
};

const getTagClass = (icon) => {
  switch (icon) {
    case "server":
      return "backend";
    case "code":
      return "frontend";
    case "database":
      return "database";
    default:
      return "";
  }
};

const getProjectType = (icon) => {
  switch (icon) {
    case "server":
      return "后端";
    case "code":
      return "前端";
    case "database":
      return "数据库";
    default:
      return "项目";
  }
};
const ideConfigs = ref([]);

const getIdeName = (ide) => {
  const ideConfig = ideConfigs.value.find((config) => config.name === ide);
  return ideConfig ? ideConfig.display_name : ide;
};

// 加载IDE配置列表
const loadIdeConfigs = async () => {
  try {
    ideConfigs.value = await window.api.getIdeConfigs();
  } catch (error) {
    console.error(error);
    ElMessage.error("加载IDE配置失败");
  }
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  const now = new Date();
  const date = new Date(dateString);

  const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

  if (diffInHours < 1) {
    return "刚刚";
  } else if (diffInHours < 24) {
    return `${diffInHours}小时前`;
  } else {
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) {
      return "昨天";
    } else if (diffInDays < 7) {
      return `${diffInDays}天前`;
    } else {
      return date.toLocaleDateString("zh-CN");
    }
  }
};

const getPreferredIdes = (project) => {
  if (!project.preferred_ide) {
    return ["vscode"]; // 默认值
  }

  if (typeof project.preferred_ide === "string") {
    try {
      // 尝试解析JSON字符串
      return JSON.parse(project.preferred_ide);
    } catch (e) {
      // 如果解析失败，假设它是单个IDE字符串
      return [project.preferred_ide];
    }
  } else if (Array.isArray(project.preferred_ide)) {
    return project.preferred_ide;
  }

  return ["vscode"]; // 默认值
};

const openProjectWithSpecificIde = async (project, ide) => {
  try {
    const result = await store.openProjectWithIDE(project, ide);
    if (!result.success) {
      ElMessage.error(`打开项目失败: ${result.error}`);
    }
  } catch (error) {
    ElMessage.error("打开项目失败");
  }
};

const getFolderName = (folderId) => {
  if (!folderId) return "根目录";

  const folder = folders.value.find(f => f.id === folderId);
  return folder ? folder.name : "未知文件夹";
};

const navigateToFolder = (folderId) => {
  if (!folderId) return;

  const folder = folders.value.find(f => f.id === folderId);
  if (folder) {
    emit("select-folder", folder);
  }
};

const loadProjects = async () => {
  projects.value = await window.api.getProjects(props.currentFolderId);
};

// 监听 store 中的项目变化
watch(() => store.projects, (newProjects) => {
  // 当 store 中的项目发生变化时，刷新列表
  if (newProjects && Array.isArray(newProjects)) {
    projects.value = newProjects;
  }
});

onMounted(async () => {
  loadProjects();
});

watch(() => props.currentFolderId, async () => {
  loadProjects();
});

</script>

<style scoped>
.content-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  scrollbar-width: thin;
}

.content-body::-webkit-scrollbar {
  width: 8px;
}

.content-body::-webkit-scrollbar-thumb {
  background-color: var(--border-color);
  border-radius: 4px;
}

.content-body::-webkit-scrollbar-track {
  background-color: transparent;
}

.no-projects {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  text-align: center;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.project-card {
  background-color: var(--card-bg);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid var(--border-color);
  cursor: pointer;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card-header {
  padding: 16px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  position: relative;
}

.project-icon.backend {
  background-color: rgba(46, 204, 113, 0.1);
  color: var(--secondary-color);
}

.project-icon.frontend {
  background-color: rgba(243, 156, 18, 0.1);
  color: var(--warning-color);
}

.project-icon.database {
  background-color: rgba(231, 76, 60, 0.1);
  color: var(--danger-color);
}

.card-header-info {
  margin-left: 12px;
  flex: 1;
  min-width: 0;
}

.project-title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-menu {
  margin-left: 8px;
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--text-secondary);
}

.card-menu:hover {
  background-color: var(--bg-color);
  color: var(--text-color);
}

.card-body {
  padding: 16px;
}

.project-stats {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  margin-right: 16px;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.stat-icon {
  margin-right: 6px;
  font-size: 14px;
}

.project-folder {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
  font-weight: 500;
  color: var(--primary-color);
  cursor: pointer;
  transition: color 0.2s;
  text-decoration: underline;
}

.project-folder:hover {
  color: var(--primary-dark);
  text-decoration: underline;
}

.project-path {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.project-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.project-tag {
  padding: 4px 10px;
  background-color: var(--primary-light);
  color: var(--primary-color);
  border-radius: 4px;
  font-size: 12px;
}

.project-tag.backend {
  background-color: rgba(46, 204, 113, 0.1);
  color: var(--secondary-color);
}

.project-tag.frontend {
  background-color: rgba(243, 156, 18, 0.1);
  color: var(--warning-color);
}

.project-tag.database {
  background-color: rgba(231, 76, 60, 0.1);
  color: var(--danger-color);
}

.project-description {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.card-action-btn {
  padding: 8px 12px;
  background-color: transparent;
  border: 1px solid var(--primary-color);
  color: var(--primary-color);
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.2s;
}

.card-action-btn:hover {
  background-color: var(--primary-color);
  color: white;
}

.card-action-icon {
  margin-right: 6px;
}

.card-action-btn.secondary {
  border-color: var(--border-color);
  color: var(--text-secondary);
}

.card-action-btn.secondary:hover {
  background-color: var(--bg-color);
  color: var(--text-color);
}

.ide-dropdown {
  position: relative;
}

@media (max-width: 1200px) {
  .projects-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}

@media (max-width: 992px) {
  .projects-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
}

@media (max-width: 768px) {
  .projects-grid {
    grid-template-columns: 1fr;
  }
}
</style>
