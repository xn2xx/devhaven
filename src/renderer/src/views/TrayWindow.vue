<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from "vue";
import { ElIcon } from "element-plus";

const projects = ref<DevHaven.Project[]>([]);
const isLoading = ref(false);
import ideaIcon from "../../../../resources/ide/intellij-idea.svg?asset";
import pycharmIcon from "../../../../resources/ide/pycharm.svg?asset";
import webstorm from "../../../../resources/ide/pycharm.svg?asset";
import cursorIcon from "../../../../resources/ide/cursor.png?asset";
import vscodeIcon from "../../../../resources/ide/vscode.svg?asset";

const fetchOpenProjects = async () => {
  try {
    console.log("获取已打开的项目列表");
    projects.value = await window.api.getOpenProjects();
    console.log("projects", projects.value);
  } catch (error) {
    console.error("获取已打开项目失败:", error);
  }
};

// 获取IDE图标路径
const getIdeIconPath = (ide: string) => {
  // 转换为小写，方便比较
  const ideLower = ide.toLowerCase();
  if (ideLower.includes("webstorm")) {
    return webstorm;
  } else if (ideLower.includes("idea")) {
    return ideaIcon;
  } else if (ideLower.includes("pycharm")) {
    return pycharmIcon;
  } else if (ideLower.includes("cursor")) {
    return cursorIcon;
  } else if (ideLower.includes("visual")) {
    return vscodeIcon;
  }

  // 默认图标
  return "./icon.png";
};

const resumeIde = async (project: DevHaven.Project) => {
  console.log("resumeIde", project);
  await window.api.resumeIde({
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
// 因为窗口始终置顶，所以需要定时刷新项目列表保证数据是同步的
setInterval(() => {
  fetchOpenProjects();
}, 5000);
</script>

<template>
  <div class="tray-window">
    <!-- 添加可拖动区域 -->
    <div class="drag-handle"></div>

    <div v-if="projects.length === 0" class="empty-container">
      <div class="empty-icon i-mdi-folder-open-outline"></div>
      <div class="empty-text">暂无打开的项目</div>
      <div class="empty-description">当您打开项目后，将会在此处显示</div>
    </div>

    <div v-else class="project-list">
      <div v-for="project in projects" :key="project.projectPath" class="project-item" @click="resumeIde(project)">
        <!-- 应用图标 -->
        <div class="project-icon">
          <el-icon :size="24">
            <img :src="getIdeIconPath(project.ide)" class="ide-img-icon" />
          </el-icon>
        </div>

        <!-- 项目信息 -->
        <div class="project-info">
          <div class="project-title" v-if="project.debHavenProject">{{ project.debHavenProject.name }}</div>
          <div class="project-title" v-else>{{ project.projectName }}</div>
          <div class="project-path">
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
  position: relative; /* 添加相对定位 */
}

/* 添加拖动区域样式 */
.drag-handle {
  top: 0;
  left: 0;
  right: 0;
  height: 22px;
  -webkit-app-region: drag; /* 使区域可拖动 */
  cursor: move;
  z-index: 10;
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
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
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
  background-color: #2a2a2a;
}

.ide-img-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
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

.i-mdi-dots-vertical,
.i-mdi-folder-open-outline {
  font-size: 18px;
}

/* 为UnoCSS的图标样式 */
.i-mdi-folder-open-outline,
.i-mdi-dots-vertical {
  width: 1em;
  height: 1em;
  display: inline-block;
}

/* 颜色类 */
.bg-blue-500 {
  background-color: #3b82f6;
}

.bg-green-500 {
  background-color: #22c55e;
}

.bg-purple-500 {
  background-color: #a855f7;
}

.bg-orange-500 {
  background-color: #f97316;
}

.bg-red-500 {
  background-color: #ef4444;
}

.bg-teal-500 {
  background-color: #14b8a6;
}

.bg-indigo-500 {
  background-color: #6366f1;
}

.bg-pink-500 {
  background-color: #ec4899;
}

.bg-amber-500 {
  background-color: #f59e0b;
}
</style>
