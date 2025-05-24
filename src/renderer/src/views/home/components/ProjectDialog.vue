<template>
  <el-dialog
    v-model="dialogVisible"
    :title="getDialogTitle()"
    width="800px"
    :close-on-click-modal="false"
    class="project-dialog"
  >
    <el-form
      ref="projectForm"
      :model="form"
      :rules="rules"
      label-width="100px"
    >
      <!-- 类型选择 -->
      <el-form-item label="类型" prop="type">
        <el-radio-group v-model="form.type" @change="handleTypeChange">
          <el-radio value="project">项目</el-radio>
          <el-radio value="prompt">提示词</el-radio>
        </el-radio-group>
      </el-form-item>

      <div class="form-row">
        <div class="form-col">
          <el-form-item label="名称" prop="name">
            <div class="name-input-wrapper">
              <el-input
                v-model="form.name"
                :placeholder="form.type === 'prompt' ? '例如: code_review' : '例如: 电商平台前端'"
                @input="handleNameInput"
              />
              <el-tooltip
                v-if="form.type === 'prompt'"
                content="mcp的tool name，只能包含字母和下划线"
                placement="top"
                class="name-help-tooltip"
              >
                <el-icon class="name-help-icon">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
            </div>
          </el-form-item>
        </div>
        <div class="form-col">
          <el-form-item label="所属文件夹" prop="folder_id">
            <el-popover
              placement="bottom-start"
              :width="320"
              trigger="manual"
              v-model:visible="folderTreeVisible"
              :hide-after="0"
              :popper-options="{ modifiers: [{ name: 'eventListeners', enabled: true }] }"
            >
              <template #reference>
                <el-input
                  v-model="selectedFolderPath"
                  placeholder="选择所属文件夹"
                  readonly
                  @click="toggleFolderTree"
                >
                  <template #prefix>
                    <i class="i-fa-solid:folder folder-icon"></i>
                  </template>
                  <template #suffix v-if="form.folder_id">
                    <el-button
                      type="text"
                      @click.stop="clearSelectedFolder"
                    >
                      <i class="i-fa-solid:times"></i>
                    </el-button>
                  </template>
                </el-input>
              </template>

              <div class="folder-tree-container">
                <el-input
                  v-model="folderSearchKeyword"
                  placeholder="搜索文件夹..."
                  prefix-icon="i-fa-solid:search"
                  clearable
                  class="mb-2"
                />
                <el-scrollbar height="250px">
                  <el-tree
                    ref="folderTree"
                    :data="folderTreeData"
                    :props="{ label: 'name', children: 'children' }"
                    :filter-node-method="filterFolderNode"
                    node-key="id"
                    :expand-on-click-node="false"
                    :default-expanded-keys="defaultExpandedKeys"
                    highlight-current
                    @node-click="handleFolderSelect"
                  >
                    <template #default="{ node, data }">
                      <span class="folder-node">
                        <i class="i-fa-solid:folder folder-icon"></i>
                        <span>{{ data.name }}</span>
                      </span>
                    </template>
                  </el-tree>
                </el-scrollbar>
              </div>
            </el-popover>
          </el-form-item>
        </div>
      </div>

      <el-form-item label="描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="简要描述功能和目的..."
        />
      </el-form-item>

      <!-- 项目相关字段 -->
      <template v-if="form.type === 'project'">
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

        <el-form-item label="项目标签" prop="tags">
          <el-input-tag v-model="form.tags" />
        </el-form-item>

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
      </template>

      <!-- 提示词相关字段 -->
      <template v-if="form.type === 'prompt'">
        <el-form-item label="提示词标签" prop="tags">
          <el-input-tag v-model="form.tags" />
        </el-form-item>

        <!-- Prompt 编辑器 -->
        <div class="prompt-editor-container">
          <PromptEditor
            :arguments="form.prompt_arguments"
            :messages="form.prompt_messages"
            @update:arguments="form.prompt_arguments = $event"
            @update:messages="form.prompt_messages = $event"
          />
        </div>
      </template>
    </el-form>

    <template #footer>
      <div class="form-actions">
        <el-button class="button-cancel" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" class="button-primary" @click="saveProject">
          {{ form.type === 'prompt' ? '保存提示词' : '保存项目' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { useAppStore } from "@/store";
import { ElMessage } from "element-plus";
import { QuestionFilled } from "@element-plus/icons-vue";
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import PromptEditor from "./PromptEditor.vue";

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
      icon: "code",
      type: "project",
      prompt_arguments: [{ name: 'content', description: '内容', required: true }],
      prompt_messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: '{{content}}'
        }
      }]
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
  icon: "code",
  type: "project",
  prompt_arguments: [],
  prompt_messages: [{
    role: 'user',
    content: {
      type: 'text',
      text: ''
    }
  }]
});

// 动态验证规则
const rules = computed(() => {
  const baseRules = {
    name: [
      { required: true, message: "请输入名称", trigger: "blur" },
      { min: 2, max: 50, message: "长度应为2到50个字符", trigger: "blur" }
    ],
    folder_id: [
      { required: true, message: "请选择所属文件夹", trigger: "blur" }
    ],
    type: [
      { required: true, message: "请选择类型", trigger: "change" }
    ]
  };

  // 为prompt类型添加特殊的名称验证规则
  if (form.value.type === 'prompt') {
    baseRules.name.push({
      pattern: /^[a-zA-Z0-9_]+$/,
      message: "只能包含字母、数字和下划线",
      trigger: "blur"
    });
  }

  // 只有项目类型才需要路径验证
  if (form.value.type === 'project') {
    baseRules.path = [
      { required: true, message: "请输入项目路径", trigger: "blur" }
    ];
  }

  return baseRules;
});

// 获取对话框标题
const getDialogTitle = () => {
  if (props.projectData?.id) {
    return form.value.type === 'prompt' ? '编辑提示词' : '编辑项目';
  } else {
    return form.value.type === 'prompt' ? '添加新提示词' : '添加新项目';
  }
};

// 处理类型变化
const handleTypeChange = (newType) => {
  // 根据类型设置默认图标
  if (newType === 'prompt') {
    form.value.icon = 'comments';
    form.value.path = ''; // 提示词不需要路径
  } else {
    form.value.icon = 'code';
  }
};

// 监听projectData变化，更新表单
watch(() => props.projectData, (newValue) => {
  if (newValue) {
    const data = { ...newValue };

    // 处理preferred_ide字段，确保它是数组格式
    if (typeof data.preferred_ide === "string") {
      try {
        data.preferred_ide = JSON.parse(data.preferred_ide);
      } catch (e) {
        data.preferred_ide = [data.preferred_ide];
      }
    } else if (!Array.isArray(data.preferred_ide)) {
      data.preferred_ide = ["vscode"];
    }

    // 处理prompt相关字段
    if (data.type === 'prompt') {
      try {
        if (typeof data.prompt_arguments === 'string') {
          data.prompt_arguments = JSON.parse(data.prompt_arguments);
        }
        if (typeof data.prompt_messages === 'string') {
          data.prompt_messages = JSON.parse(data.prompt_messages);
        }
      } catch (e) {
        console.error('解析prompt数据失败:', e);
        data.prompt_arguments = [];
        data.prompt_messages = [{
          role: 'user',
          content: {
            type: 'text',
            text: ''
          }
        }];
      }
    }

    // 确保有默认值
    if (!data.prompt_arguments) {
      data.prompt_arguments = [];
    }
    if (!data.prompt_messages) {
      data.prompt_messages = [{
        role: 'user',
        content: {
          type: 'text',
          text: ''
        }
      }];
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

    // 准备要保存的数据
    const projectData = { ...form.value };

    // 对于prompt类型，将数据序列化为JSON字符串
    if (projectData.type === 'prompt') {
      // 提示词不需要路径和IDE配置
      projectData.path = projectData.path || '';
      projectData.preferred_ide = [];
    }

    emit("save", projectData);
    dialogVisible.value = false;
  } catch (error) {
    // 表单验证失败
    console.error('保存失败:', error);
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

// 文件夹树相关
const folderTreeVisible = ref(false);
const folderTree = ref(null);
const folderSearchKeyword = ref('');
const selectedFolderPath = ref('');
const defaultExpandedKeys = ref([]);

// 将平铺数据转换为树形结构
const folderTreeData = computed(() => {
  // 复制文件夹列表
  const folders = JSON.parse(JSON.stringify(store.folders));

  // 创建结果数组和映射表
  const result = [];
  const map = {};

  // 创建id到节点的映射
  folders.forEach(folder => {
    folder.children = [];
    map[folder.id] = folder;
  });

  // 构建树形结构
  folders.forEach(folder => {
    const parent = map[folder.parent_id];
    if (parent) {
      // 如果存在父节点，添加到父节点的children中
      parent.children.push(folder);
    } else {
      // 如果不存在父节点，则为顶级节点
      result.push(folder);
    }
  });

  return result;
});

// 文件夹选择
const handleFolderSelect = (data) => {
  form.value.folder_id = data.id;
  selectedFolderPath.value = getFolderPathName(data);
  folderTreeVisible.value = false;
};

// 清除选择的文件夹
const clearSelectedFolder = (event) => {
  event.stopPropagation();
  form.value.folder_id = null;
  selectedFolderPath.value = '';
};

// 筛选文件夹节点
const filterFolderNode = (value, data) => {
  if (!value) return true;
  return data.name.toLowerCase().includes(value.toLowerCase());
};

// 监听搜索关键词变化
watch(folderSearchKeyword, (val) => {
  folderTree.value?.filter(val);
});

// 监听选中文件夹变化，更新显示路径
watch(() => form.value.folder_id, (newValue) => {
  if (newValue) {
    const folder = store.folders.find(f => f.id === newValue);
    if (folder) {
      selectedFolderPath.value = getFolderPathName(folder);

      // 设置默认展开的节点
      const pathArray = [];
      let currentId = folder.id;

      // 向上查找所有父节点ID
      while (currentId) {
        pathArray.push(currentId);
        const currentFolder = store.folders.find(f => f.id === currentId);
        currentId = currentFolder?.parent_id;
      }

      defaultExpandedKeys.value = pathArray;
    }
  } else {
    selectedFolderPath.value = '';
  }
}, { immediate: true });

// 切换文件夹树的显示/隐藏
const toggleFolderTree = (event) => {
  event.stopPropagation();
  folderTreeVisible.value = !folderTreeVisible.value;
};

// 点击外部关闭文件夹树
const handleClickOutside = (event) => {
  const popoverEl = document.querySelector('.folder-tree-container')?.parentNode;
  const inputEl = document.querySelector('.el-form-item[label="所属文件夹"] .el-input');

  if (popoverEl && inputEl &&
      !popoverEl.contains(event.target) &&
      !inputEl.contains(event.target) &&
      folderTreeVisible.value) {
    folderTreeVisible.value = false;
  }
};

// 处理名称输入，对prompt类型进行字符限制
const handleNameInput = (value) => {
  if (form.value.type === 'prompt') {
    // 只允许字母、数字和下划线
    const filteredValue = value.replace(/[^a-zA-Z0-9_]/g, '');
    if (filteredValue !== value) {
      form.value.name = filteredValue;
    }
  }
};

onMounted(() => {
  loadIdeConfigs();
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
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

.folder-node {
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

.folder-tree-container {
  padding: 8px;
}

.folder-tree-container .el-scrollbar {
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.mb-2 {
  margin-bottom: 8px;
}

.prompt-editor-container {
  margin-top: 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--card-bg);
}

.name-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}

.name-help-icon {
  color: var(--text-secondary);
  cursor: help;
  font-size: 16px;
  flex-shrink: 0;
}

.name-help-icon:hover {
  color: var(--primary-color);
}
</style>
