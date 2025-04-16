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

</template>

<style>

</style>
