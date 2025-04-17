<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from "vue";

const projects = ref<DevHaven.Project[]>([]);
const isLoading = ref(false);

const fetchOpenProjects = async () => {
  isLoading.value = true;
  try {
    console.log("获取已打开的项目列表");
    projects.value = await window.api.getOpenProjects();
    console.log("projects", projects.value);
  } catch (error) {
    console.error("获取已打开项目失败:", error);
  } finally {
    isLoading.value = false;
  }
};

// 获取项目缩写作为图标显示
const getProjectInitials = (name: string) => {
  if (!name) return "PR";
  const words = name.split(/[-_\s]/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// 为每个项目生成一个随机的背景颜色
const getProjectColor = (name: string) => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500',
    'bg-orange-500', 'bg-red-500', 'bg-teal-500',
    'bg-indigo-500', 'bg-pink-500', 'bg-amber-500'
  ];
  const index = name.length % colors.length;
  return colors[index];
};

// 获取IDE图标
const getIdeIcon = (ide: string) => {
  // 根据路径判断IDE类型，这里简单模拟
  if (ide.includes('Webstorm')) {
    return 'i-mdi-web';
  } else if (ide.includes('Idea')) {
    return 'i-mdi-language-java';
  } else if (ide.includes('Pycharm')) {
    return 'i-mdi-file-document';
  }
  return 'i-mdi-code-tags';
};

const resumeIde = (project: DevHaven.Project) => {
  window.api.resumeIde({
    ide: project.ide,
    projectName: project.projectName,
    projectPath: project.projectPath
  });
};
// 监听刷新项目列表事件
const handleRefreshProjects = () => {
  fetchOpenProjects();
};

// 组件挂载时设置事件监听和初始获取项目列表
onMounted(() => {
  fetchOpenProjects();
  // 添加事件监听
  window.api.ipcRenderer.on("refresh-tray-projects", handleRefreshProjects);
});

// 组件卸载时移除事件监听
onUnmounted(() => {
  // 移除事件监听
  window.api.ipcRenderer.removeListener("refresh-tray-projects", handleRefreshProjects);
});
</script>

<template>
  <div class="tray-window">
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <div class="loading-text">加载中...</div>
    </div>

    <div v-else-if="projects.length === 0" class="empty-container">
      <div class="empty-icon i-mdi-folder-open-outline"></div>
      <div class="empty-text">暂无打开的项目</div>
      <div class="empty-description">当您打开项目后，将会在此处显示</div>
    </div>

    <div v-else class="project-list">
      <div v-for="project in projects" :key="project.projectPath" class="project-item" @click="resumeIde(project)">
        <!-- 项目图标 -->
        <div class="project-icon" :class="getProjectColor(project.projectName)">
          {{ getProjectInitials(project.projectName) }}
        </div>

        <!-- 项目信息 -->
        <div class="project-info">
          <div class="project-title">{{ project.projectName }}</div>
          <div class="project-path">
            <span :class="getIdeIcon(project.ide)" class="ide-icon"></span>
            <span class="path-text">{{ project.projectPath }}</span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="project-actions">
          <button class="action-button">
            <span class="i-mdi-dots-vertical"></span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.tray-window {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #1e1e1e;
  color: #f0f0f0;
  padding: 8px;
  border-radius: 6px;
  max-height: 100vh;
  overflow-y: auto;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 10px;
  font-size: 14px;
  color: #a0a0a0;
}

.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 150px;
  text-align: center;
  padding: 0 16px;
}

.empty-icon {
  font-size: 48px;
  color: #a0a0a0;
  margin-bottom: 12px;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
}

.empty-description {
  font-size: 14px;
  color: #a0a0a0;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.project-item:hover {
  background-color: #2a2a2a;
}

.project-icon {
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.project-info {
  margin-left: 12px;
  flex: 1;
  overflow: hidden;
}

.project-title {
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-path {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #a0a0a0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ide-icon {
  font-size: 14px;
  margin-right: 4px;
}

.path-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-actions {
  display: flex;
  align-items: center;
  margin-left: 8px;
}

.action-button {
  background: transparent;
  border: none;
  color: #a0a0a0;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #f0f0f0;
}

.favorite-icon {
  font-size: 18px;
  color: #f5c042;
}

.i-mdi-dots-vertical,
.i-mdi-folder-open-outline {
  font-size: 18px;
}

/* 为UnoCSS的图标样式 */
.i-mdi-web,
.i-mdi-language-java,
.i-mdi-file-document,
.i-mdi-code-tags,
.i-mdi-star,
.i-mdi-star-outline,
.i-mdi-dots-vertical,
.i-mdi-folder-open-outline {
  width: 1em;
  height: 1em;
  display: inline-block;
}

/* 颜色类 */
.bg-blue-500 { background-color: #3b82f6; }
.bg-green-500 { background-color: #22c55e; }
.bg-purple-500 { background-color: #a855f7; }
.bg-orange-500 { background-color: #f97316; }
.bg-red-500 { background-color: #ef4444; }
.bg-teal-500 { background-color: #14b8a6; }
.bg-indigo-500 { background-color: #6366f1; }
.bg-pink-500 { background-color: #ec4899; }
.bg-amber-500 { background-color: #f59e0b; }
</style>
