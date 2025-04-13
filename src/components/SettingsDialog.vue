<template>
  <el-dialog
    v-model="dialogVisible"
    title="设置"
    width="600px"
    :close-on-click-modal="false"
    class="settings-dialog"
  >
    <el-tabs>
      <el-tab-pane name="general" label="常规">
        <el-form label-width="100px">
          <el-form-item label="主题">
            <el-select v-model="settingsData.theme" placeholder="选择主题" style="width: 100%;">
              <el-option label="浅色" value="light" />
              <el-option label="深色" value="dark" />
              <el-option label="跟随系统" value="auto" />
            </el-select>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane name="ide" label="IDE管理">
        <el-table :data="ideConfigs" style="width: 100%" v-loading="ideLoading">
          <el-table-column prop="name" label="标识符" width="120" />
          <el-table-column prop="display_name" label="显示名称" />
          <el-table-column label="类型" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.is_script ? 'warning' : 'success'">
                {{ scope.row.is_script ? '脚本' : '应用程序' }}
              </el-tag>
            </template>
          </el-table-column>
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
          <el-button type="primary" @click="showIdeDialog('app')">
            <i class="i-fa-solid:plus mr-2"></i>添加应用程序
          </el-button>
          <el-button type="warning" @click="showIdeDialog('script')">
            <i class="i-fa-solid:code mr-2"></i>添加脚本
          </el-button>
        </div>
      </el-tab-pane>

      <el-tab-pane name="database" label="数据库">
        <el-form label-width="100px">
          <el-form-item label="数据库路径">
            <div class="path-input-group">
              <el-input v-model="settingsData.dbPath" readonly placeholder="选择数据库文件存储位置" />
              <el-button @click="selectDbPath">
                <i class="i-fa-solid:folder-open"></i>
              </el-button>
            </div>
            <div class="form-helper">
              数据库当前位置: {{ settingsData.dbPath }}
            </div>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane name="about" label="关于">
        <div class="about-section">
          <div class="app-logo">
            <i class="i-fa-solid:boxes"></i>
          </div>
          <h2 class="app-name">DevHaven</h2>
          <div class="app-version">版本 1.0.0</div>
          <p class="app-description">
            一个高效管理本地开发项目的工具，让您的开发工作更轻松、更有条理。
          </p>
          <div class="app-copyright">
            © 2023 DevHaven. 保留所有权利。
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <div class="form-actions">
        <el-button class="button-cancel" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" class="button-primary" @click="saveSettings">保存设置</el-button>
      </div>
    </template>

    <!-- IDE配置对话框 -->
    <el-dialog
      v-model="ideDialogVisible"
      :title="currentIde.id ? '编辑IDE配置' : '添加IDE配置'"
      width="500px"
      append-to-body
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

        <el-form-item label="图标" prop="icon">
          <el-input v-model="currentIde.icon" placeholder="FontAwesome图标名称，如：code">
            <template #prepend>i-fa-solid:</template>
            <template #append v-if="currentIde.icon">
              <i :class="`i-fa-solid:${currentIde.icon}`"></i>
            </template>
          </el-input>
        </el-form-item>

        <template v-if="currentIde.is_script">
          <el-form-item label="脚本内容" prop="script_content">
            <el-input
              v-model="currentIde.script_content"
              type="textarea"
              :rows="10"
              placeholder="输入用于打开项目的脚本内容，可以使用 {projectPath} 作为项目路径变量"
            />
          </el-form-item>
        </template>

        <template v-else>
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
        </template>
      </el-form>

      <template #footer>
        <div class="form-actions">
          <el-button class="button-cancel" @click="ideDialogVisible = false">取消</el-button>
          <el-button type="primary" class="button-primary" @click="saveIdeConfig">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useAppStore } from "../store";
import { ElMessage, ElMessageBox } from "element-plus";

const props = defineProps({
  visible: Boolean
});

const emit = defineEmits(['update:visible', 'save']);

// Store
const store = useAppStore();

// State
const dialogVisible = ref(props.visible);
const settingsData = ref({
  theme: 'light',
  dbPath: ''
});

// IDE管理状态
const ideLoading = ref(false);
const ideConfigs = ref([]);
const ideDialogVisible = ref(false);
const currentIde = ref({
  id: null,
  name: '',
  display_name: '',
  command: '',
  args: '',
  icon: '',
  is_script: false,
  script_content: ''
});
const ideForm = ref(null);
const ideRules = {
  name: [
    { required: true, message: '请输入IDE标识符', trigger: 'blur' },
    { pattern: /^[a-z0-9_]+$/, message: '只能使用小写字母、数字和下划线', trigger: 'blur' }
  ],
  display_name: [
    { required: true, message: '请输入显示名称', trigger: 'blur' }
  ],
  command: [
    { required: true, message: '请输入命令路径', trigger: 'blur' }
  ],
  script_content: [
    { required: true, message: '请输入脚本内容', trigger: 'blur' }
  ]
};

// Watch for changes to the visible prop
watch(() => props.visible, (newValue) => {
  dialogVisible.value = newValue;

  if (newValue) {
    loadCurrentSettings();
    loadIdeConfigs();
  }
});

// Watch for changes to dialogVisible and emit update:visible
watch(dialogVisible, (newValue) => {
  emit('update:visible', newValue);
});

const loadCurrentSettings = () => {
  settingsData.value = {
    theme: store.theme,
    dbPath: store.dbPath
  };
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

// 显示添加/编辑IDE对话框
const showIdeDialog = (type, ide = null) => {
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
      icon: type === 'script' ? 'code' : 'desktop',
      is_script: type === 'script',
      script_content: ''
    };
  }
  ideDialogVisible.value = true;
};

// 编辑IDE
const editIde = (ide) => {
  showIdeDialog(ide.is_script ? 'script' : 'app', ide);
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
      loadIdeConfigs();
    } catch (error) {
      ElMessage.error('删除IDE配置失败');
    }
  }).catch(() => {});
};

// 保存IDE配置
const saveIdeConfig = async () => {
  try {
    await ideForm.value.validate();

    if (currentIde.value.id) {
      // 更新现有IDE
      await window.electronAPI.updateIdeConfig(currentIde.value.id, currentIde.value);
      ElMessage.success('IDE配置更新成功');
    } else {
      // 创建新IDE
      await window.electronAPI.createIdeConfig(currentIde.value);
      ElMessage.success('IDE配置添加成功');
    }

    ideDialogVisible.value = false;
    loadIdeConfigs();
  } catch (error) {
    console.error('保存IDE配置失败:', error);
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

const saveSettings = async () => {
  emit('save', { ...settingsData.value });
  dialogVisible.value = false;
};

const selectDbPath = async () => {
  try {
    const result = await window.electronAPI.selectDbPath();

    if (!result.canceled && result.filePath) {
      settingsData.value.dbPath = result.filePath;
    }
  } catch (error) {
    ElMessage.error('选择数据库路径失败');
  }
};

// 初始加载
onMounted(() => {
  loadIdeConfigs();
});
</script>

<style scoped>
.settings-dialog :deep(.el-dialog__body) {
  padding: 20px 24px;
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

.about-section {
  text-align: center;
  padding: 20px 0;
}

.app-logo {
  font-size: 64px;
  color: var(--primary-color);
  margin-bottom: 16px;
}

.app-name {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 4px;
}

.app-version {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.app-description {
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 16px;
  color: var(--text-secondary);
}

.app-copyright {
  font-size: 12px;
  color: var(--text-muted);
}

.table-footer {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}
</style>
