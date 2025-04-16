<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// 为window.api添加类型声明
declare global {
  interface Window {
    api: {
      getOpenProjects: () => Promise<Project[]>;
      ipcRenderer: {
        on: (channel: string, listener: (...args: any[]) => void) => void;
        removeListener: (channel: string, listener: (...args: any[]) => void) => void;
      };
    };
  }
}

interface Project {
  projectName: string;
  projectPath: string;
}

const projects = ref<Project[]>([])
const isLoading = ref(false)

const fetchOpenProjects = async () => {
  isLoading.value = true
  try {
    console.log('获取已打开的项目列表')
    const result = await window.api.getOpenProjects()
    projects.value = result
    console.log('projects', projects.value)
  } catch (error) {
    console.error('获取已打开项目失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 监听刷新项目列表事件
const handleRefreshProjects = () => {
  fetchOpenProjects()
}

// 组件挂载时设置事件监听和初始获取项目列表
onMounted(() => {
  fetchOpenProjects()

  // 添加事件监听
  window.api.ipcRenderer.on('refresh-tray-projects', handleRefreshProjects)
})

// 组件卸载时移除事件监听
onUnmounted(() => {
  // 移除事件监听
  window.api.ipcRenderer.removeListener('refresh-tray-projects', handleRefreshProjects)
})
</script>

<template>
  <div class="tray-window p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg w-64">
    <!-- 项目列表 -->
    <div class="mb-4">
      <h3 class="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">已打开的项目</h3>
      <div v-if="isLoading" class="text-center py-4">
        <i class="i-carbon-circle-dash animate-spin text-xl" />
      </div>
      <div v-else-if="projects.length === 0" class="py-4">
        <el-empty description="暂无打开的项目" />
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="project in projects"
          :key="project.projectPath"
          class="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
        >
          <div class="text-sm font-medium text-gray-800 dark:text-white">
            {{ project.projectName }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
            {{ project.projectPath }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>

</style>
