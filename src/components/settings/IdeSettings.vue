<template>
  <div class="ide-settings">
    <el-table :data="ideConfigs" style="width: 100%" v-loading="loading">
      <el-table-column prop="name" label="标识符" width="120" />
      <el-table-column prop="display_name" label="显示名称" />
      <el-table-column label="操作" width="120">
        <template #default="scope">
          <el-button size="small" @click="editIde(scope.row)" plain>
            <i class="i-fa-solid:edit"></i>
          </el-button>
          <el-button size="small" type="danger" @click="deleteIde(scope.row)" plain>
            <i class="i-fa-solid:trash-alt"></i>
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="table-footer">
      <el-button type="primary" @click="showIdeDialog()">
        <i class="i-fa-solid:plus mr-2"></i>添加应用程序
      </el-button>
      <el-button type="success" @click="detectIdes" :loading="detectingIdes">
        <i class="i-fa-solid:sync mr-2"></i>自动检测IDE
      </el-button>
    </div>

    <!-- IDE配置对话框 -->
    <el-dialog
      v-model="ideDialogVisible"
      :title="currentIde.id ? '编辑IDE配置' : '添加IDE配置'"
      width="500px"
    >
      <el-form ref="ideForm" :model="currentIde" :rules="ideRules" label-width="120px">
        <el-form-item label="标识符" prop="name">
          <el-input
            v-model="currentIde.name"
            :disabled="!!currentIde.id"
            placeholder="如：vscode, idea"
          />
          <div class="form-helper" v-if="currentIde.id">标识符创建后不可修改</div>
        </el-form-item>

        <el-form-item label="显示名称" prop="display_name">
          <el-input v-model="currentIde.display_name" placeholder="如：Visual Studio Code" />
        </el-form-item>

        <el-form-item label="命令路径" prop="command">
          <div class="path-input-group">
            <el-input v-model="currentIde.command" placeholder="应用程序路径或命令名称" />
            <el-button @click="selectCommand">
              <i class="i-fa-solid:folder-open"></i>
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="参数模板" prop="args">
          <el-input
            v-model="currentIde.args"
            placeholder="命令参数，用 {projectPath} 表示项目路径变量"
          />
          <div class="form-helper">
            如不指定，将直接使用项目路径作为参数
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="form-actions">
          <el-button class="button-cancel" @click="ideDialogVisible = false">取消</el-button>
          <el-button type="primary" class="button-primary" @click="saveIdeConfig">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

defineProps({
  ideConfigs: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['refresh']);

// IDE对话框状态
const ideDialogVisible = ref(false);
const ideForm = ref(null);
const detectingIdes = ref(false);
const currentIde = ref({
  id: null,
  name: '',
  display_name: '',
  command: '',
  args: '',
  icon: ''
});

// 表单验证规则
const ideRules = {
  name: [
    { required: true, message: '请输入IDE标识符', trigger: 'blur' },
  ],
  display_name: [
    { required: true, message: '请输入显示名称', trigger: 'blur' }
  ],
  command: [
    { required: true, message: '请输入命令路径', trigger: 'blur' }
  ]
};

// 显示添加/编辑IDE对话框
const showIdeDialog = (ide = null) => {
  if (ide) {
    // 编辑现有IDE
    currentIde.value = { ...ide };
  } else {
    // 添加新IDE
    currentIde.value = {
      id: null,
      name: '',
      display_name: '',
      command: '',
      args: '',
      icon: 'desktop'
    };
  }
  ideDialogVisible.value = true;
};

// 编辑IDE
const editIde = (ide) => {
  showIdeDialog(ide);
};

// 删除IDE
const deleteIde = (ide) => {
  ElMessageBox.confirm(
    `确定要删除IDE配置 "${ide.display_name}" 吗？`,
    '确认删除',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await window.electronAPI.deleteIdeConfig(ide.id);
      ElMessage.success('IDE配置删除成功');
      emit('refresh');
    } catch (error) {
      ElMessage.error('删除IDE配置失败');
    }
  }).catch(() => {});
};

// 自动检测系统中安装的IDE
const detectIdes = async () => {
  try {
    detectingIdes.value = true;
    await window.electronAPI.detectIdes();
    ElMessage.success('IDE检测完成');
    emit('refresh');
  } catch (error) {
    ElMessage.error('IDE检测失败');
  } finally {
    detectingIdes.value = false;
  }
};

// 保存IDE配置
const saveIdeConfig = async () => {
  try {
    await ideForm.value.validate();

    // 创建一个纯净的数据对象，避免克隆问题
    const ideData = {
      name: currentIde.value.name,
      display_name: currentIde.value.display_name,
      command: currentIde.value.command,
      args: currentIde.value.args,
      icon: currentIde.value.icon
    };

    if (currentIde.value.id) {
      // 更新现有IDE
      await window.electronAPI.updateIdeConfig(currentIde.value.id, ideData);
      ElMessage.success('IDE配置更新成功');
    } else {
      // 创建新IDE
      await window.electronAPI.createIdeConfig(ideData);
      ElMessage.success('IDE配置添加成功');
    }

    ideDialogVisible.value = false;
    emit('refresh');
  } catch (error) {
    console.error('保存IDE配置失败:', error);
    ElMessage.error('保存IDE配置失败: ' + error.message);
  }
};

// 选择命令文件
const selectCommand = async () => {
  try {
    const result = await window.electronAPI.openExecutableDialog();
    if (!result.canceled && result.filePath) {
      currentIde.value.command = result.filePath;
    }
  } catch (error) {
    ElMessage.error('选择可执行文件失败');
  }
};
</script>

<style scoped>
.ide-settings {
  width: 100%;
}

.table-footer {
  margin-top: 16px;
  display: flex;
  gap: 8px;
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

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.button-cancel {
  background-color: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-color);
}

.button-cancel:hover {
  background-color: var(--bg-color);
}

.button-primary {
  background-color: var(--primary-color);
  border: none;
  color: white;
}

.button-primary:hover {
  background-color: var(--primary-dark);
}
</style>
