<template>
  <div class="database-settings">
    <el-form label-width="120px">
      <el-form-item label="数据库路径">
        <div class="path-input-group">
          <el-input v-model="dbPathValue" readonly placeholder="选择数据库文件存储位置" />
          <el-button @click="selectDbPath">
            <i class="i-fa-solid:folder-open"></i>
          </el-button>
        </div>
        <div class="form-helper">
          数据库当前位置: {{ dbPathValue }}
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  dbPath: String
});

const emit = defineEmits(['db-path-updated']);

// 本地状态
const dbPathValue = ref(props.dbPath || '');

// 监听设置变化
watch(() => props.dbPath, (newPath) => {
  if (newPath) {
    dbPathValue.value = newPath;
  }
}, { immediate: true });

// 选择数据库路径
const selectDbPath = async () => {
  try {
    const result = await window.electronAPI.selectDbPath();

    if (!result.canceled && result.filePath) {
      dbPathValue.value = result.filePath;
      emit('db-path-updated', result.filePath);
    }
  } catch (error) {
    ElMessage.error('选择数据库路径失败');
  }
};
</script>

<style scoped>
.database-settings {
  width: 100%;
}

.path-input-group {
  display: flex;
  gap: 8px;
}

.path-input-group .el-button {
  flex-shrink: 0;
}

.form-helper {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}
</style>
