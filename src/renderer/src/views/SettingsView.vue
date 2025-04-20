<template>
  <div class="settings-container">
    <div class="settings-sidebar">
      <div class="settings-header">
        <button class="back-button" @click="$router.back()">
          <i class="i-fa-solid:arrow-left"></i>
        </button>
        <h2>设置</h2>
      </div>
      <div class="settings-nav">
        <div
          v-for="section in settingsSections"
          :key="section.id"
          :class="['nav-item', { active: activeSection === section.id }]"
          @click="activeSection = section.id"
        >
          <i :class="`i-fa-solid:${section.icon}`"></i>
          <span>{{ section.name }}</span>
        </div>
      </div>
    </div>

    <div class="settings-content">
      <!-- 常规设置 -->
      <div v-show="activeSection === 'general'" class="settings-section">
        <h3>常规设置</h3>
        <GeneralSettings
          :settings="settingsData"
          @settings-updated="handleSettingsUpdate"
        />
      </div>

      <!-- IDE管理 -->
      <div v-show="activeSection === 'ide'" class="settings-section">
        <h3>IDE管理</h3>
        <IdeSettings
          :ide-configs="ideConfigs"
          :loading="ideLoading"
          @refresh="loadIdeConfigs"
        />
      </div>

      <!-- 数据库 -->
      <div v-show="activeSection === 'database'" class="settings-section">
        <h3>数据库</h3>
        <DatabaseSettings
          :db-path="settingsData.dbPath"
          @db-path-updated="handleDbPathUpdate"
        />
      </div>

      <!-- 关于 -->
      <div v-show="activeSection === 'about'" class="settings-section">
        <h3>关于</h3>
        <AboutSection />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAppStore } from '../store';
import { ElMessage } from 'element-plus';

// 导入子组件
import GeneralSettings from '@/components/settings/GeneralSettings.vue';
import IdeSettings from '@/components/settings/IdeSettings.vue';
import DatabaseSettings from '@/components/settings/DatabaseSettings.vue';
import AboutSection from '@/components/settings/AboutSection.vue';

// Store
const store = useAppStore();

// 设置部分
const settingsSections = [
  { id: 'general', name: '常规', icon: 'sliders-h' },
  { id: 'ide', name: 'IDE管理', icon: 'code' },
  { id: 'database', name: '数据库', icon: 'database' },
  { id: 'about', name: '关于', icon: 'info-circle' }
];

// 状态
const activeSection = ref('general');
const settingsData = ref({
  theme: 'light',
  dbPath: '',
  githubProjectsPath: ''
});

// IDE管理状态
const ideLoading = ref(false);
const ideConfigs = ref([]);

// 加载当前设置
const loadCurrentSettings = async () => {
  try {
    const appSettings = await window.api.getAppSettings();
    settingsData.value = {
      theme: appSettings.theme || 'light',
      dbPath: appSettings.dbPath || '',
      githubProjectsPath: appSettings.githubProjectsPath || ''
    };
  } catch (error) {
    console.error('加载应用设置失败:', error);
    ElMessage.error('加载设置失败');
  }
};

// 加载IDE配置列表
const loadIdeConfigs = async () => {
  ideLoading.value = true;
  try {
    ideConfigs.value = await window.api.getIdeConfigs();
  } catch (error) {
    console.error(error)
    ElMessage.error('加载IDE配置失败');
  } finally {
    ideLoading.value = false;
  }
};

// 处理设置更新
const handleSettingsUpdate = async (updatedSettings) => {
  try {
    // 保存主题
    if (updatedSettings.theme !== store.theme) {
      await store.changeTheme(updatedSettings.theme);
      // 立即更新本地设置数据
      settingsData.value.theme = updatedSettings.theme;
    }

    // 保存GitHub项目路径
    if (updatedSettings.githubProjectsPath !== settingsData.value.githubProjectsPath) {
      settingsData.value.githubProjectsPath = updatedSettings.githubProjectsPath;
    }

    // 保存所有设置
    await window.api.saveAppSettings({
      theme: updatedSettings.theme,
      githubProjectsPath: updatedSettings.githubProjectsPath
    });

    ElMessage.success('设置已保存');
  } catch (error) {
    console.error('保存设置失败:', error);
    ElMessage.error('保存设置失败');
  }
};

// 处理数据库路径更新
const handleDbPathUpdate = async (newDbPath) => {
  try {
    if (newDbPath !== store.dbPath) {
      await store.changeDbPath(newDbPath);
      settingsData.value.dbPath = newDbPath;
      ElMessage.success('数据库路径已更新');
    }
  } catch (error) {
    ElMessage.error('更新数据库路径失败');
  }
};

// 初始化
onMounted(() => {
  loadCurrentSettings();
  loadIdeConfigs();

  // 设置主题
  const theme = store.theme;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
});
</script>

<style scoped>
.settings-container {
  display: flex;
  height: 100vh;
  width: 100%;
  background-color: var(--bg-color);
}

.settings-sidebar {
  width: 220px;
  background-color: var(--card-bg);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.settings-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-button {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--text-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  width: 28px;
  height: 28px;
  border-radius: 4px;
}

.back-button:hover {
  background-color: var(--bg-color);
}

.settings-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
}

.settings-nav {
  flex: 1;
  padding: 16px 0;
}

.nav-item {
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.nav-item:hover {
  background-color: var(--bg-color);
  color: var(--text-color);
}

.nav-item.active {
  background-color: var(--primary-light);
  color: var(--primary-color);
}

.nav-item i {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.settings-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.settings-section {
  background-color: var(--card-bg);
  border-radius: 8px;
  padding: 20px;
  box-shadow: var(--shadow-sm);
}

.settings-section h3 {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: 500;
}
</style>
