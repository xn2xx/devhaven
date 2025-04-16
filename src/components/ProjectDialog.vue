<template>
  <el-dialog
    v-model="dialogVisible"
    :title="projectData?.id ? '编辑项目' : '添加新项目'"
    width="600px"
    :close-on-click-modal="false"
    class="project-dialog"
  >
    <el-form
      ref="projectForm"
      :model="form"
      :rules="rules"
      label-width="100px"
    >
      <div class="form-row">
        <div class="form-col">
          <el-form-item label="项目名称" prop="name">
            <el-input v-model="form.name" placeholder="例如: 电商平台前端" />
          </el-form-item>
        </div>
        <div class="form-col">
          <el-form-item label="所属文件夹" prop="folder_id">
            <el-select
              v-model="form.folder_id"
              placeholder="选择所属文件夹"
              clearable
              style="width: 100%;"
            >
              <el-option
                v-for="folder in sortedFolders"
                :key="folder.id"
                :label="getFolderPathName(folder)"
                :value="folder.id"
              >
                <span class="folder-option">
                  <i class="i-fa-solid:folder folder-icon"></i>
                  <span>{{ getFolderPathName(folder) }}</span>
                </span>
              </el-option>
            </el-select>
          </el-form-item>
        </div>
      </div>

      <el-form-item label="项目描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="简要描述项目的功能和目的..."
        />
      </el-form-item>

      <div class="form-row">
        <div class="form-col">
          <el-form-item label="可用IDE" prop="preferred_ide">
            <el-select
              v-model="form.preferred_ide"
              placeholder="选择IDE"
              style="width: 100%;"
              multiple
            >
              <el-option v-for="ide in ideConfigs" :label="ide.display_name" :value="ide.name" :key="ide" />
            </el-select>
          </el-form-item>
        </div>
      </div>

      <el-form-item label="项目路径" prop="path">
        <el-input
          v-model="form.path"
          placeholder="/Users/username/Projects/your-project"
        />
        <div class="path-actions">
          <el-button @click="selectDirectory">
            <i class="i-fa-solid:folder-open"></i>
            选择项目目录
          </el-button>
        </div>
        <div class="form-helper">本地项目文件夹的绝对路径</div>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="form-actions">
        <el-button class="button-cancel" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" class="button-primary" @click="saveProject">保存项目</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { useAppStore } from "@/store";
import { ElMessage } from "element-plus";

const props = defineProps({
  visible: Boolean,
  projectData: {
    type: Object,
    default: () => ({
      id: null,
      name: "",
      folder_id: null,
      description: "",
      path: "",
      preferred_ide: ["vscode"],
      icon: "code"
    })
  },
  currentFolderId: {
    type: [Number, String, null],
    default: null
  },
});

const ideConfigs = ref([]);
// 加载IDE配置列表
const loadIdeConfigs = async () => {
  try {
    ideConfigs.value = await window.api.getIdeConfigs();
  } catch (error) {
    console.error(error);
    ElMessage.error("加载IDE配置失败");
  }
};
const emit = defineEmits(["update:visible", "save"]);

// Store
const store = useAppStore();
const projectForm = ref(null);

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit("update:visible", value)
});

const form = ref({
  id: null,
  name: "",
  folder_id: null,
  description: "",
  path: "",
  preferred_ide: ["vscode"],
  icon: "code"
});

const rules = {
  name: [
    { required: true, message: "请输入项目名称", trigger: "blur" },
    { min: 2, max: 50, message: "长度应为2到50个字符", trigger: "blur" }
  ],
  path: [
    { required: true, message: "请输入项目路径", trigger: "blur" }
  ],
  folder_id: [
    { required: true, message: "请选择所属文件夹", trigger: "blur" }
  ]
};

// 监听projectData变化，更新表单
watch(() => props.projectData, (newValue) => {
  if (newValue) {
    const data = { ...newValue };

    // 处理preferred_ide字段，确保它是数组格式
    if (typeof data.preferred_ide === "string") {
      try {
        // 尝试解析JSON字符串
        data.preferred_ide = JSON.parse(data.preferred_ide);
      } catch (e) {
        // 如果解析失败，假设它是单个IDE字符串
        data.preferred_ide = [data.preferred_ide];
      }
    } else if (!Array.isArray(data.preferred_ide)) {
      // 如果不是数组也不是字符串，设置默认值
      data.preferred_ide = ["vscode"];
    }

    form.value = data;

    // 如果传入了当前文件夹ID且项目未设置文件夹，则使用当前文件夹ID
    if (props.currentFolderId && !form.value.folder_id) {
      form.value.folder_id = props.currentFolderId;
    }
  }
}, { immediate: true });

// 选择项目目录
const selectDirectory = async () => {
  try {
    // 使用window.api调用主进程
    const result = await window.api.openDirectoryDialog();
    if (result && result.filePath) {
      form.value.path = result.filePath;
    }
  } catch (error) {
    console.error(error);
    ElMessage.error("选择目录失败");
  }
};

// 保存项目
const saveProject = async () => {
  try {
    await projectForm.value.validate();
    emit("save", { ...form.value });
    dialogVisible.value = false;
  } catch (error) {
    // 表单验证失败
  }
};

// 根据文件夹ID获取完整路径名称
const getFolderPathName = (folder) => {
  if (!folder) return '';

  // 创建路径数组
  const pathArray = [folder.name];
  let currentParentId = folder.parent_id;

  // 向上查找父文件夹，直到找到根文件夹
  while (currentParentId) {
    const parentFolder = store.folders.find(f => f.id === currentParentId);
    if (parentFolder) {
      // 将父文件夹添加到路径前面
      pathArray.unshift(parentFolder.name);
      currentParentId = parentFolder.parent_id;
    } else {
      break;
    }
  }

  // 返回 "文件夹1/文件夹2/..." 格式的路径
  return pathArray.join(' / ');
};

// 加入计算属性，按层级排序文件夹
const sortedFolders = computed(() => {
  // 复制一份文件夹列表
  const folders = [...store.folders];

  // 按照路径排序
  return folders.sort((a, b) => {
    const pathA = getFolderPathName(a);
    const pathB = getFolderPathName(b);
    return pathA.localeCompare(pathB);
  });
});

onMounted(() => {
  loadIdeConfigs();
});
</script>

<style scoped>
.project-dialog :deep(.el-dialog__body) {
  padding: 20px 24px;
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-col {
  flex: 1;
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

.folder-option {
  display: flex;
  align-items: center;
}

.folder-icon {
  margin-right: 8px;
  color: var(--primary-color);
}

.el-select :deep(.el-select-dropdown__item) {
  padding: 8px 12px;
}

.path-actions {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}

.path-actions .el-button {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
