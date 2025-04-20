<template>
  <div class="general-settings">
    <el-form label-width="150px">
      <el-form-item label="主题">
        <el-select
          v-model="themeValue"
          placeholder="选择主题"
          style="width: 100%;"
          @change="handleThemeChange"
        >
          <el-option label="浅色" value="light" />
          <el-option label="深色" value="dark" />
          <el-option label="跟随系统" value="auto" />
        </el-select>
      </el-form-item>

      <el-form-item label="GitHub项目目录">
        <div class="path-input-group">
          <el-input v-model="githubProjectsPath" placeholder="GitHub项目的默认克隆位置" />
          <el-button @click="selectGithubProjectsPath">
            <i class="i-fa-solid:folder-open mr-1"></i>
            选择目录
          </el-button>
        </div>
        <div class="form-helper">GitHub项目将默认克隆到该目录</div>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  settings: Object
});

const emit = defineEmits(['settings-updated']);

// 本地状态
const themeValue = ref(props.settings?.theme || 'light');
const githubProjectsPath = ref(props.settings?.githubProjectsPath || '');

// 监听设置变化
watch(() => props.settings, (newSettings) => {
  if (newSettings) {
    themeValue.value = newSettings.theme;
    githubProjectsPath.value = newSettings.githubProjectsPath || '';
  }
}, { immediate: true });

// 主题变更处理
const handleThemeChange = () => {
  updateSettings();
};

// 选择GitHub项目目录
const selectGithubProjectsPath = async () => {
  try {
    const result = await window.api.openDirectoryDialog();
    if (!result.canceled && result.filePath) {
      githubProjectsPath.value = result.filePath;
      updateSettings();
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('选择目录失败');
  }
};

// 更新设置
const updateSettings = () => {
  emit('settings-updated', {
    ...props.settings,
    theme: themeValue.value,
    githubProjectsPath: githubProjectsPath.value
  });
};
</script>

<style scoped>
.general-settings {
  width: 100%;
}

.path-input-group {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.form-helper {
  font-size: 12px;
  color: var(--text-secondary);
}

.mr-1 {
  margin-right: 4px;
}
</style>
