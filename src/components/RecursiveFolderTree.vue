<template>
  <div class="folder-tree-container" @click="handleGlobalClick">
    <!-- 使用Element Plus的el-tree组件替换自定义递归实现 -->
    <el-tree
      ref="treeRef"
      :data="folders"
      :props="defaultProps"
      :expand-on-click-node="false"
      :current-node-key="currentFolder?.id"
      :default-expanded-keys="expandedFolders"
      :draggable="true"
      :default-expand-all="true"
      :allow-drop="allowDrop"
      @node-click="handleSelectFolder"
      @node-expand="handleNodeExpand"
      @node-collapse="handleNodeCollapse"
      @node-drop="handleElTreeDrop"
      @node-contextmenu="handleNodeRightClick"
      node-key="id"
    >
      <template #default="{ node, data }">
        <div
          class="custom-tree-node"
          tabindex="0"
        >
          <!-- 使用Element Plus图标 -->
          <span class="folder-icon">
            <el-icon>
              <Folder />
            </el-icon>
          </span>

          <span v-if="data.id === editingId" class="folder-edit">
            <el-input
              ref="inputRef"
              v-model="editingName"
              size="small"
              @blur="saveEdit"
              @keyup.enter="saveEdit"
              @keyup.esc="cancelEdit"
              style="width: 150px"
            />
          </span>
          <span v-else class="folder-name">{{ data.name }}</span>

          <span class="folder-actions">
            <el-button
              type="primary"
              size="small"
              text
              @click.stop="handleAddSubfolder(data.id)"
              title="添加子文件夹"
            >
              <el-icon><FolderAdd /></el-icon>
            </el-button>
            <el-button
              type="primary"
              size="small"
              text
              @click.stop="startEditing(data)"
              title="重命名"
            >
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button
              type="danger"
              size="small"
              text
              @click.stop="confirmDelete(data)"
              title="删除"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </span>
        </div>
      </template>
    </el-tree>

    <!-- 删除确认对话框 -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="删除文件夹"
      width="400px"
      center
      destroy-on-close
    >
      <p>确定要删除文件夹 "{{ folderToDelete?.name }}"？</p>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="deleteDialogVisible = false">取消</el-button>
          <el-button type="danger" @click="deleteFolder">删除</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch, reactive } from 'vue';
import { useAppStore } from '../store';
import { FolderAdd, Folder, Edit, Delete } from '@element-plus/icons-vue';

const props = defineProps({
  folders: {
    type: Array,
    default: () => []
  },
  expandedFolders: {
    type: Array,
    default: () => []
  },
  currentFolder: Object
});

// Store
const store = useAppStore();

// Emit events to parent
const emit = defineEmits([
  'toggle-folder',
  'select-folder',
  'delete-folder',
  'add-folder',
  'rename-folder',
  'update-folder-tree'
]);

// Tree refs and props
const treeRef = ref(null);
const inputRef = ref(null);
const defaultProps = {
  children: 'children',
  label: 'name',
};

// 编辑状态
const editingId = ref(null);
const editingName = ref('');

// Delete dialog state
const deleteDialogVisible = ref(false);
const folderToDelete = ref(null);

// 处理文件夹展开
const handleNodeExpand = (data) => {
  emit('toggle-folder', data);
};

// 处理文件夹折叠
const handleNodeCollapse = (data) => {
  emit('toggle-folder', data);
};

// 处理文件夹选择
const handleSelectFolder = (data, node) => {
  if (editingId.value === data.id) return; // 编辑时不触发选择

  emit('select-folder', data);
};

// 处理右键点击节点
const handleNodeRightClick = (event, node) => {
  // 阻止默认的右键菜单
  event.preventDefault();
};

// 添加子文件夹
const handleAddSubfolder = (parentId) => {
  emit('add-folder', parentId);
};

// 确认删除文件夹
const confirmDelete = (folder) => {
  folderToDelete.value = folder;
  deleteDialogVisible.value = true;
};

// 删除文件夹
const deleteFolder = async () => {
  if (!folderToDelete.value) return;

  try {
    emit('delete-folder', folderToDelete.value);
    deleteDialogVisible.value = false;
  } catch (error) {
    console.error('删除文件夹失败', error);
  }
};

// 开始编辑文件夹名称
const startEditing = (folder) => {
  editingId.value = folder.id;
  editingName.value = folder.name;

  // 在下一个DOM更新周期后聚焦输入框
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus();
    }
  });
};

// 保存编辑
const saveEdit = async () => {
  if (!editingName.value.trim()) {
    // 名称不能为空
    cancelEdit();
    return;
  }

  // 找到被编辑的文件夹
  const folder = findFolderById(store.folders, editingId.value);

  if (folder) {
    try {
      await store.updateFolder({
        id: folder.id,
        name: editingName.value.trim(),
        parent_id: folder.parent_id,
        icon: folder.icon,
        description: folder.description
      });

      // 刷新树
      await store.loadFolders();
      emit('update-folder-tree');

      cancelEdit();
    } catch (error) {
      console.error('保存文件夹名称失败:', error);
      cancelEdit();
    }
  }
};

// 取消编辑
const cancelEdit = () => {
  editingId.value = null;
  editingName.value = '';
};

// 拖拽验证函数 - 控制节点是否可以被放置
const allowDrop = (draggingNode, dropNode, type) => {
  // 不允许拖拽到自己或自己的子节点上
  if (!dropNode) return type === 'prev' || type === 'next';

  // 检查是否拖放到子节点上
  const isChild = isDescendantOf(draggingNode.data, dropNode.data.id);
  return !isChild;
};

// 处理节点拖拽放置
const handleElTreeDrop = (draggingNode, dropNode, dropType, event) => {
  console.log(`拖放操作: 节点=${draggingNode.data.id}, 位置=${dropType}, 目标=${dropNode?.data?.id || '根级别'}`);

  // 如果是放置到根级别
  if (!dropNode && (dropType === 'prev' || dropType === 'next')) {
    emit('node-drop', {
      draggedFolder: draggingNode.data,
      targetFolder: null,
      dropPosition: 'root'
    });
    return;
  }

  // 映射 el-tree 的放置类型到我们自己的类型
  let position;
  if (dropType === 'inner') {
    position = 'inside';
  } else if (dropType === 'prev') {
    position = 'before';
  } else { // next
    position = 'after';
  }

  // 触发拖放事件
  emit('node-drop', {
    draggedFolder: draggingNode.data,
    targetFolder: dropNode.data,
    dropPosition: position
  });
};

// 处理全局点击事件，只需处理关闭上下文菜单的逻辑即可
const handleGlobalClick = () => {
  // 不再需要清除悬停状态
};

// 检查文件夹是否是另一个文件夹的子孙
const isDescendantOf = (folder, ancestorId) => {
  if (!folder) return false;
  if (folder.id === ancestorId) return true;

  if (folder.children && folder.children.length > 0) {
    return folder.children.some(child => isDescendantOf(child, ancestorId));
  }

  return false;
};

// 递归查找文件夹
const findFolderById = (folders, id) => {
  // 先尝试平铺查找
  const flatFind = (arr) => {
    for (const folder of arr) {
      if (folder.id === id) {
        return folder;
      }
    }
    return null;
  };

  // 先检查store中的扁平数组
  const fromFlat = flatFind(store.folders);
  if (fromFlat) {
    return fromFlat;
  }

  // 如果在扁平数组中找不到，再递归查找树结构
  for (const folder of folders) {
    if (folder.id === id) {
      return folder;
    }
    if (folder.children && folder.children.length > 0) {
      const found = findFolderById(folder.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
};


// 监听store中的编辑标记
watch(() => store.folderToEdit, (newFolder) => {
  if (newFolder) {
    const folder = findFolderById(props.folders, newFolder.id);
    if (folder) {
      startEditing(folder);
      // 处理完后清除store中的标记
      store.clearFolderToEdit();
    }
  }
}, { immediate: true });


onMounted(() => {
  // 在这里可以添加初始化逻辑
  nextTick(() => {
    // 确保树组件能够接收键盘事件
    if (treeRef.value?.$el) {
      treeRef.value.$el.setAttribute('tabindex', '0');
    }
  });
});
</script>

<style scoped>
.folder-tree-container {
  position: relative;
  height: 100%;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.custom-tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 4px 0;
  outline: none; /* 移除默认的焦点轮廓 */
  transition: all 0.2s ease; /* 添加平滑过渡效果 */
}


.folder-icon {
  margin-right: 8px;
  display: flex;
  align-items: center;
}

.folder-icon :deep(.el-icon) {
  font-size: 16px;
  color: var(--el-color-primary);
}

.folder-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-color);
}

.folder-edit {
  flex: 1;
  display: flex;
  align-items: center;
}

.folder-actions {
  margin-left: 8px;
  display: flex;
  gap: 0px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
}

/* 自定义文件夹操作按钮样式 */
.folder-actions :deep(.el-button) {
  padding: 2px 4px;
  margin: 0;
  min-height: auto;
}

/* 当树节点内容被hover时显示操作按钮 */
:deep(.el-tree-node__content:hover) .folder-actions {
  opacity: 0.8;
  visibility: visible;
}

/* 当操作按钮自身被hover时，提高不透明度 */
.folder-actions:hover {
  opacity: 1;
}

/* 确保在触摸设备上也可以点击操作按钮 */
@media (hover: none) {
  .folder-actions {
    opacity: 0.8;
    visibility: visible;
  }
}

/* 基础样式 */
:deep(.el-tree) {
  background-color: transparent;
  color: var(--el-text-color-primary);
}

:deep(.el-tree-node__content) {
  height: 36px;
  border-radius: 4px;
  transition: background-color 0.2s, color 0.2s;
}

:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  box-shadow: inset 0 0 0 1px var(--el-color-primary-light-5);
}

:deep(.el-tree-node__content:hover) {
  background-color: var(--el-fill-color-light);
}

</style>
