<template>
  <div class="general-settings">
    <el-form label-width="120px">
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
    </el-form>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  settings: Object
});

const emit = defineEmits(['settings-updated']);

// 本地状态
const themeValue = ref(props.settings?.theme || 'light');

// 监听设置变化
watch(() => props.settings, (newSettings) => {
  if (newSettings) {
    themeValue.value = newSettings.theme;
  }
}, { immediate: true });

// 主题变更处理
const handleThemeChange = () => {
  emit('settings-updated', {
    ...props.settings,
    theme: themeValue.value
  });
};
</script>

<style scoped>
.general-settings {
  width: 100%;
}
</style>
