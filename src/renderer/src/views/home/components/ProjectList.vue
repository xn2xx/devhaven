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
        @click="handleProjectAction('openFolder', project)"
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
                  <el-dropdown-item v-if="project.source_type === 'github' && project.is_cloned === 0" command="clone">
                    <i class="i-fa-solid:download mr-2"></i>
                    克隆仓库
                  </el-dropdown-item>
                  <el-dropdown-item v-if="project.source_type === 'github'" command="viewOnGithub">
                    <i class="i-fa-brands:github mr-2"></i>
                    在 GitHub 上查看
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
                <i :class="[project.is_favorite ===1? 'i-fa-solid:star' : 'i-fa-solid:star', 'card-action-icon']"
                   :style="project.is_favorite === 1 ? 'color: #f59e0b;' : ''"></i>
              </i>
            </div>
            <div class="stat-item">
              <i
                :class="[project.source_type === 'github' ? 'i-fa-brands:github' : 'i-fa-solid:folder', 'stat-icon']"></i>
              <span class="project-path">{{ project.path }}</span>
              <span v-if="project.source_type === 'github'" class="github-badge">GitHub</span>
              <span v-if="project.source_type === 'github' && project.is_cloned === 0"
                    class="not-cloned-badge">未克隆</span>
            </div>
          </div>
          <div class="project-tags">

          </div>

          <!-- 克隆进度条 -->
          <div v-if="cloningProject && cloningProject.id === project.id" class="clone-progress">
            <el-progress
              :percentage="cloneProgress"
              :status="cloneStatus === 'completed' ? 'success' : undefined"
              :stroke-width="8"
            ></el-progress>
            <div class="clone-status">{{ getCloneStatusText() }}</div>
          </div>

          <div class="card-actions">
            <button
              class="card-action-btn"
              v-for="ide in getPreferredIdes(project)"
              @click.stop="openProjectWithSpecificIde(project, ide)"
              :disabled="project.source_type === 'github' && project.is_cloned === 0 && !cloningProject"
            >
              <i class="i-fa-solid:external-link-alt card-action-icon"></i>
              {{ getIdeName(ide) }}
            </button>
            <button
              v-if="project.source_type === 'github' && project.is_cloned === 0"
              class="card-action-btn github"
              @click.stop="handleProjectAction('clone', project)"
            >
              <i class="i-fa-solid:download card-action-icon"></i>
              克隆
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 克隆确认对话框 -->
    <el-dialog
      v-model="cloneConfirmDialogVisible"
      title="克隆GitHub仓库"
      width="500px"
    >
      <p class="mb-3">您确定要将以下GitHub仓库克隆到本地吗？</p>
      <p v-if="projectToClone" class="font-bold mb-1">{{ projectToClone.name }}</p>
      <p v-if="projectToClone" class="mb-4">目标路径：{{ projectToClone.path }}</p>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="cloneConfirmDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmClone">确认克隆</el-button>
        </span>
      </template>
    </el-dialog>
  </div>

</template>

<script setup>
import { useAppStore } from "@/store";
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

// 克隆相关状态
const cloneConfirmDialogVisible = ref(false);
const projectToClone = ref(null);
const cloningProject = ref(null);
const cloneProgress = ref(0);
const cloneStatus = ref("");

// Store
const store = useAppStore();
const folders = computed(() => store.folders);


const handleProjectAction = async (command, project) => {
  switch (command) {
    case "openFolder":
      try {
        if (project.source_type === "github" && project.is_cloned === 0) {
          ElMessage.warning("项目尚未克隆到本地，请先克隆项目");
          return;
        }

        const exists = await window.api.pathExists(project.path);
        if (!exists) {
          ElMessage.error("项目路径不存在，请检查路径或重新克隆项目");
          return;
        }

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
    case "viewOnGithub":
      if (project.github_url) {
        window.api.openExternalUrl(project.github_url);
      } else {
        ElMessage.warning("没有找到GitHub URL");
      }
      break;
    case "clone":
      showCloneConfirmDialog(project);
      break;
  }
};

// 显示克隆确认对话框
const showCloneConfirmDialog = (project) => {
  projectToClone.value = project;
  cloneConfirmDialogVisible.value = true;
};

// 确认克隆仓库
const confirmClone = async () => {
  if (!projectToClone.value || !projectToClone.value.github_url) {
    ElMessage.error("无效的GitHub仓库");
    cloneConfirmDialogVisible.value = false;
    return;
  }

  cloneConfirmDialogVisible.value = false;
  await cloneRepository(projectToClone.value);
};

// 克隆仓库
const cloneRepository = async (project) => {
  try {
    cloningProject.value = project;
    cloneProgress.value = 0;
    cloneStatus.value = "cloning";

    // 设置克隆进度监听器
    window.api.ipcRenderer.on("clone-progress-update", handleCloneProgress);

    // 开始克隆
    const result = await window.api.cloneGithubRepo(project.github_url, project.path);

    if (result.success) {
      ElMessage.success(`仓库 ${project.name} 克隆成功`);

      // 更新项目状态为已克隆
      await store.updateProject(project.id, {
        is_cloned: 1
      });

      // 更新当前项目的克隆状态
      project.is_cloned = 1;
    } else {
      ElMessage.error(`克隆失败: ${result.message}`);
    }
  } catch (error) {
    console.error("克隆仓库出错:", error);
    ElMessage.error("克隆过程中发生错误");
  } finally {
    // 清理
    setTimeout(() => {
      window.api.ipcRenderer.removeListener("clone-progress-update", handleCloneProgress);
      cloningProject.value = null;
      cloneProgress.value = 0;
      cloneStatus.value = "";
    }, 2000);
  }
};

// 处理克隆进度更新
const handleCloneProgress = (progress) => {
  cloneProgress.value = progress.percent;
  cloneStatus.value = progress.status;
};

// 获取克隆状态文本
const getCloneStatusText = () => {
  switch (cloneStatus.value) {
    case "cloning":
      return `正在克隆 (${cloneProgress.value}%)`;
    case "completed":
      return "克隆完成";
    default:
      return "准备克隆...";
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
    // 如果是GitHub项目且未克隆，提示先克隆
    if (project.source_type === "github" && project.is_cloned === 0) {
      ElMessage.warning("项目尚未克隆到本地，请先克隆项目");
      return;
    }

    // 检查项目路径是否存在
    const exists = await window.api.pathExists(project.path);
    if (!exists) {
      ElMessage.error("项目路径不存在，请检查路径或重新克隆项目");
      return;
    }

    // 更新项目的最后打开时间
    const now = new Date();
    store.updateProject(project.id, { last_opened_at: now.toISOString() });
    console.log("currentFolder", props.currentFolderId);
    // 打开项目
    await window.api.openWithIDE(project.path, ide);
  } catch (error) {
    ElMessage.error(`使用 ${getIdeName(ide)} 打开项目失败`);
    console.error(error);
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
  console.log("loadProjects", props.currentFolderId);
  projects.value = await window.api.getProjects(props.currentFolderId);
};

onMounted(async () => {
  await loadProjects();
});

watch(() => props.currentFolderId, async () => {
  await loadProjects();
});

</script>

<style scoped>
.content-body {
  flex: 1;
  overflow-y: auto;
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

.github-badge {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: #24292e;
  color: white;
  margin-left: 6px;
}

.not-cloned-badge {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: #f97316;
  color: white;
  margin-left: 6px;
}

.clone-progress {
  margin: 10px 0;
}

.clone-status {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  text-align: center;
}

.card-action-btn.github {
  background-color: #24292e;
  color: white;
}

.card-action-btn.github:hover {
  background-color: #1a1f24;
}

.card-action-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
