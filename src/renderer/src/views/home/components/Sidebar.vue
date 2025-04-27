<template>
  <div class="sidebar" :class="{ 'collapsed': isCollapsed }">
    <div class="sidebar-header">
      <div class="logo">
        <i class="i-fa-solid:boxes logo-icon"></i>
        <span class="logo-text">DevHaven</span>
      </div>
    </div>

    <div class="search-box">
      <i class="search-icon i-fa-solid:search"></i>
      <el-input
        v-model="searchInput"
        class="search-input"
        placeholder="搜索项目、文档..."
        clearable
        @input="handleSearch"
      />
    </div>
    <!-- 快速访问区域 -->
    <div class="section-title">快速访问</div>
    <div class="favorites-list">
      <div
        v-for="item in favoriteProjects"
        :key="item.id"
        class="favorite-item"
        @click="selectQuickAccessItem(item)"
      >
        <div class="favorite-icon" :class="getIconClass(item.icon)">
          <i :class="`i-fa-solid:${item.icon || 'code'}`"></i>
        </div>
        <div class="favorite-info">
          <div class="favorite-name">{{ item.name }}</div>
          <div class="favorite-path">{{ item.path }}</div>
        </div>
      </div>
      <div v-if="favoriteProjects.length === 0" class="no-favorites">
        <p class="text-gray-500 text-center text-sm p-2">暂无收藏项目</p>
      </div>
    </div>

    <!-- 文件夹区域 -->
    <div class="section-title-container">
      <div class="section-title">文件夹</div>
      <el-button
        class="add-folder-btn"
        type="text"
        @click="handleAddRootFolder"
        title="添加根文件夹"
      >
        <i class="i-fa-solid:folder-plus"></i>
      </el-button>
    </div>
    <div
      class="sidebar-content"
      v-loading="loading"
      @contextmenu.prevent="showEmptyAreaContextMenu"
    >
      <recursive-folder-tree
        :folders="folderTree"
        :expanded-folders="expandedFolders"
        :current-folder="currentFolder"
        @toggle-folder="toggleFolder"
        @select-folder="selectFolder"
        @delete-folder="deleteFolder"
        @add-folder="handleAddSubfolder"
        @rename-folder="showRenameFolderDialog"
        @update-folder-tree="handleUpdateFolderTree"
        @node-drop="handleFolderDrop"
      />
    </div>


    <!-- Rename Folder Dialog -->
    <el-dialog
      v-model="renameDialogVisible"
      title="重命名文件夹"
      width="400px"
    >
      <el-form>
        <el-form-item label="文件夹名称">
          <el-input v-model="renamedFolderName" placeholder="输入新文件夹名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="renameDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="renameFolder">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Empty Area Context Menu -->
    <div v-if="emptyAreaContextMenu.visible" class="context-menu" :style="emptyAreaContextMenuStyle">
      <div class="context-menu-item" @click="handleAddRootFolder">
        <i class="i-fa-solid:folder-plus"></i>
        添加文件夹
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAppStore } from "../../../store";
import { Setting } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import RecursiveFolderTree from "./RecursiveFolderTree.vue";
import { watch } from "vue";

const props = defineProps({
  loading: Boolean,
  currentFolder: Object
});

const emit = defineEmits([
  "search",
  "select-folder",
  "add-folder",
  "open-settings",
  "toggle-collapse"
]);

// Store
const store = useAppStore();

// State
const searchInput = ref("");
const expandedFolders = ref([]);
const folderToDelete = ref(null);
const renameDialogVisible = ref(false);
const folderToRename = ref(null);
const renamedFolderName = ref("");
const isCollapsed = ref(false);
const isLoading = ref(false);


const favoriteProjects = ref([]);

// Context Menu
const emptyAreaContextMenu = ref({
  visible: false,
  x: 0,
  y: 0
});

const emptyAreaContextMenuStyle = computed(() => {
  return {
    left: `${emptyAreaContextMenu.value.x}px`,
    top: `${emptyAreaContextMenu.value.y}px`
  };
});

// Computed
const folderTree = computed(() => {
  return store.folderTree;
});

// Methods
const handleSearch = () => {
  if (searchInput.value.trim()) {
    emit("search", searchInput.value.trim());
  } else {
    emit("search", "");
  }
};

const selectFolder = (folder) => {
  emit("select-folder", folder);
};

const toggleFolder = (folder) => {
  // el-tree组件可能会发送对象或ID
  const folderId = typeof folder === "object" ? folder.id : folder;

  if (expandedFolders.value.includes(folderId)) {
    expandedFolders.value = expandedFolders.value.filter(id => id !== folderId);
  } else {
    expandedFolders.value.push(folderId);
  }
};

const showEmptyAreaContextMenu = (event) => {
  event.preventDefault();
  // 只有点击空白区域才显示菜单
  if (event.target.closest(".folder-item") === null) {
    emptyAreaContextMenu.value.visible = true;
    emptyAreaContextMenu.value.x = event.clientX;
    emptyAreaContextMenu.value.y = event.clientY;
  }
};


const deleteFolder = async (folder) => {
  folderToDelete.value = folder;
  if (!folderToDelete.value) return;

  try {
    await store.deleteFolder(folderToDelete.value);
    ElMessage.success("文件夹删除成功");

    // 如果删除的是当前选中的文件夹，则选择第一个可用的文件夹
    if (props.currentFolder && props.currentFolder.id === folderToDelete.value.id) {
      const firstFolder = store.folders[0];
      if (firstFolder) {
        emit("select-folder", firstFolder);
      } else {
        emit("select-folder", null);
      }
    }
  } catch (error) {
    ElMessage.error("删除文件夹失败");
  }
};

const handleAddSubfolder = async (parentId) => {
  try {
    const newFolder = {
      name: "未命名文件夹",
      parent_id: parentId,
      description: "",
      icon: "folder"
    };

    const createdFolder = await store.createFolder(newFolder);

    // 确保父文件夹是展开的
    if (!expandedFolders.value.includes(parentId)) {
      expandedFolders.value.push(parentId);
    }

    // 刷新文件夹列表
    await store.loadFolders();

    // 将最新创建的文件夹标记为需要编辑的
    store.setFolderToEdit(createdFolder);

  } catch (error) {
    ElMessage.error("添加文件夹失败");
  }
};

const handleAddRootFolder = async () => {
  emptyAreaContextMenu.value.visible = false;

  try {
    const newFolder = {
      name: "未命名文件夹",
      parent_id: null,
      description: "",
      icon: "folder"
    };

    const createdFolder = await store.createFolder(newFolder);

    // 刷新文件夹列表
    await store.loadFolders();

    // 将最新创建的文件夹标记为需要编辑的
    store.setFolderToEdit(createdFolder);

  } catch (error) {
    ElMessage.error("添加文件夹失败");
  }
};

const showRenameFolderDialog = (folder) => {
  folderToRename.value = folder;
  renamedFolderName.value = folder.name;
  renameDialogVisible.value = true;
};

const renameFolder = async () => {
  if (!folderToRename.value || !renamedFolderName.value.trim()) return;

  try {
    await store.updateFolder({
      ...folderToRename.value,
      name: renamedFolderName.value.trim()
    });
    ElMessage.success("文件夹重命名成功");
    renameDialogVisible.value = false;
  } catch (error) {
    ElMessage.error("重命名文件夹失败");
  }
};

const selectQuickAccessItem = async (item) => {
  try {
    // 如果是项目，则打开项目
    if (item.folder_id !== undefined) {
      const result = await store.openProjectWithIDE(item);
      if (!result.success) {
        ElMessage.error(`打开项目失败: ${result.error}`);
      } else {
        ElMessage.success(`已打开项目: ${item.name}`);
      }
    } else {
      // 其它快速访问项（如果有）
      ElMessage.info(`快速访问: ${item.name}`);
    }
  } catch (error) {
    ElMessage.error("打开项目失败");
  }
};


const handleUpdateFolderTree = async () => {
  console.log("开始重新加载文件夹树");
  isLoading.value = true;
  try {
    // 保存当前展开状态和选中文件夹，以便刷新后恢复
    const currentExpandedState = [...expandedFolders.value];
    const currentSelectedId = props.currentFolder?.id;

    // 重新加载所有文件夹
    await store.loadFolders();

    // 恢复展开状态和选中状态
    expandedFolders.value = currentExpandedState;

    if (currentSelectedId) {
      // 重新查找当前文件夹（可能位置已变）
      const folder = findFolderById(store.folders, currentSelectedId);
      if (folder) {
        // 通知父组件更新当前文件夹
        emit("select-folder", folder);

        // 如果文件夹已经移到根级别或者其他位置，确保其父级都已展开
        ensureParentFoldersExpanded(folder);

        // 加载该文件夹下的项目
        await store.loadProjects(currentSelectedId);
      }
    }

    console.log("文件夹树重新加载完成，展开节点：", expandedFolders.value);
  } catch (error) {
    console.error("重新加载文件夹树失败:", error);
    ElMessage.error("更新文件夹结构失败");
  } finally {
    isLoading.value = false;
  }
};

// 确保父文件夹都已展开
const ensureParentFoldersExpanded = (folder) => {
  if (!folder || !folder.parent_id) return;

  // 查找父文件夹并添加到expandedFolders
  const parent = findFolderById(store.folders, folder.parent_id);
  if (parent) {
    if (!expandedFolders.value.includes(parent.id)) {
      expandedFolders.value.push(parent.id);
    }
    // 递归处理更上层的父文件夹
    ensureParentFoldersExpanded(parent);
  }
};
const loadFavoriteProjects = async () => {
  favoriteProjects.value = await window.api.favoriteProjects();
};

// 监听store中的收藏状态变化
watch(() => store.favoriteStatus, () => {
  loadFavoriteProjects();
});

// Lifecycle Hooks
onMounted(() => {
  // 获取收藏的项目
  loadFavoriteProjects();
  // 点击其他地方关闭右键菜单
  document.addEventListener("click", closeContextMenu);

  // 如果没有选中文件夹，自动选择第一个
  checkAndSelectFirstFolder();
});

// 检查并选择第一个文件夹（如果当前没有选中文件夹）
const checkAndSelectFirstFolder = () => {
  if (!props.currentFolder && store.folders.length > 0) {
    // 获取第一个文件夹
    const firstFolder = store.folders[0];
    if (firstFolder) {
      emit("select-folder", firstFolder);
    }
  }
};

// 当文件夹树加载或更新时，检查是否需要选择第一个文件夹
watch(() => store.folders, () => {
  checkAndSelectFirstFolder();
}, { immediate: true });

onUnmounted(() => {
  document.removeEventListener("click", closeContextMenu);
});

const closeContextMenu = () => {
  emptyAreaContextMenu.value.visible = false;
};

const handleFolderDrop = async ({ draggedFolder, targetFolder, dropPosition }) => {
  console.log(`处理拖拽: 文件夹=${draggedFolder.id}, 位置=${dropPosition}, 目标=${targetFolder?.id || "根级别"}`);

  try {
    isLoading.value = true;

    // 特殊处理：拖动到根级别
    if (dropPosition === "root") {
      console.log("处理拖放到根级别:", draggedFolder.id);

      // 获取原始文件夹信息
      const folder = store.folders.find(f => f.id === draggedFolder.id);

      // 只有当文件夹不是根级别时才处理
      if (folder && folder.parent_id !== null) {
        console.log("将文件夹从 parent_id =", folder.parent_id, "变更为 null (根级别)");

        // 构造更新对象
        const updateData = {
          id: draggedFolder.id,
          name: draggedFolder.name,
          parent_id: null, // 明确设置为null使其成为根级文件夹
          icon: draggedFolder.icon || "folder",
          description: draggedFolder.description || "",
          order_index: getMaxOrder(store.folders.filter(f => f.parent_id === null)) + 1
        };

        console.log("更新数据:", JSON.stringify(updateData));

        // 执行更新
        await store.updateFolder(updateData);

        // 更新完成后刷新文件夹列表
        await handleUpdateFolderTree();
      } else {
        console.log("文件夹已经是根级别，无需更改");
      }

      return;
    }

    // 必须有目标文件夹
    if (!targetFolder) {
      console.warn("缺少目标文件夹");
      return;
    }

    // 检查是否拖放到自己的子文件夹中
    if (isDescendantOf(store.folderTree, targetFolder.id, draggedFolder.id)) {
      ElMessage.warning("不能将文件夹拖放到其子文件夹中");
      return;
    }

    // 获取拖拽前的文件夹状态
    const originalFolder = store.folders.find(f => f.id === draggedFolder.id);
    if (!originalFolder) {
      console.error("找不到要拖拽的文件夹:", draggedFolder.id);
      return;
    }

    let parentId = null;
    let orderIndex = 0;

    // 根据拖放位置确定新的父节点和排序
    if (dropPosition === "inside") {
      // 拖入内部，作为子节点
      parentId = targetFolder.id;

      // 获取目标文件夹子项的最大顺序值
      const siblingFolders = store.folders.filter(f => f.parent_id === targetFolder.id);
      orderIndex = siblingFolders.length > 0
        ? Math.max(...siblingFolders.map(f => f.order_index || 0)) + 1
        : 0;

      console.log(`将文件夹移动到 ${targetFolder.name} 内部，新顺序=${orderIndex}`);
    } else {
      // 拖到前面或后面，与目标节点同级
      parentId = targetFolder.parent_id;

      // 获取同级文件夹
      const siblingFolders = store.folders.filter(f => f.parent_id === parentId);

      if (dropPosition === "before") {
        // 放在目标文件夹前面
        orderIndex = targetFolder.order_index > 0 ? targetFolder.order_index - 0.5 : 0;
        console.log(`将文件夹移动到 ${targetFolder.name} 前面，新顺序=${orderIndex}`);
      } else { // 'after'
        // 放在目标文件夹后面
        orderIndex = targetFolder.order_index + 0.5;
        console.log(`将文件夹移动到 ${targetFolder.name} 后面，新顺序=${orderIndex}`);
      }
    }

    // 构造更新对象
    const updateData = {
      id: draggedFolder.id,
      name: draggedFolder.name,
      parent_id: parentId,
      icon: draggedFolder.icon || "folder",
      description: draggedFolder.description || "",
      order_index: orderIndex
    };

    console.log("发送更新请求:", JSON.stringify(updateData));

    // 更新被拖动节点
    await store.updateFolder(updateData);

    // 更新完成后刷新文件夹列表
    await handleUpdateFolderTree();

  } catch (error) {
    console.error("移动文件夹失败", error);
    ElMessage.error("移动文件夹失败");
  } finally {
    isLoading.value = false;
  }
};

// 获取列表中最大的order值
const getMaxOrder = (folders) => {
  if (!folders || folders.length === 0) return 0;
  return Math.max(...folders.map(f => f.order_index || 0));
};

// 检查文件夹是否是另一个文件夹的子孙
const isDescendantOf = (folders, targetId, possibleAncestorId) => {
  // 直接找出目标文件夹
  const targetFolder = findFolderById(folders, targetId);
  if (!targetFolder) return false;

  // 检查目标文件夹的父级链是否包含可能的祖先
  let currentFolder = targetFolder;
  while (currentFolder && currentFolder.parent_id !== null) {
    if (currentFolder.parent_id === possibleAncestorId) {
      return true;
    }

    // 查找父文件夹，继续向上检查
    currentFolder = findFolderById(folders, currentFolder.parent_id);
  }

  return false;
};

// 递归查找文件夹
const findFolderById = (folders, id) => {
  // 如果是数组，直接遍历查找
  if (Array.isArray(folders)) {
    for (const folder of folders) {
      if (folder.id === id) {
        return folder;
      }

      // 递归检查子文件夹
      if (folder.children && folder.children.length > 0) {
        const found = findFolderById(folder.children, id);
        if (found) return found;
      }
    }
  }

  return null;
};

// 获取图标样式类
const getIconClass = (icon) => {
  switch (icon) {
    case "server":
      return "backend";
    case "code":
      return "frontend";
    case "database":
      return "database";
    default:
      return "";
  }
};
</script>

<style scoped>
.sidebar {
  width: 280px;
  background-color: var(--card-bg);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  z-index: 10;
  height: 100%;
}

.sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 18px;
  color: var(--primary-color);
}

.logo-icon {
  margin-right: 12px;
  font-size: 20px;
}

.collapsed .logo-text {
  display: none;
}

.collapsed .logo-icon {
  margin-right: 0;
}

.sidebar-toggle {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.sidebar-toggle:hover {
  background-color: var(--primary-light);
  color: var(--primary-color);
}

.search-box {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  z-index: 1;
}

.collapsed .search-icon {
  left: 50%;
  transform: translate(-50%, -50%);
}

.sidebar-tabs {
  display: flex;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
}

.collapsed .sidebar-tabs {
  justify-content: center;
  padding: 8px 0;
}

.sidebar-tab {
  padding: 8px 16px;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.collapsed .sidebar-tab {
  padding: 8px;
  width: 36px;
}

.collapsed .sidebar-tab-text {
  display: none;
}

.sidebar-tab.active {
  background-color: var(--primary-light);
  color: var(--primary-color);
}

.sidebar-tab:hover:not(.active) {
  background-color: var(--bg-color);
  color: var(--text-color);
}

.section-title {
  padding: 8px;
  font-size: 18px;
  font-weight: 500;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 1px;
}

.collapsed .section-title {
  padding: 8px;
  text-align: center;
  font-size: 10px;
}

.favorites-list {
  padding: 0 8px;
}

.collapsed .favorites-list {
  padding: 0 8px;
}

.favorite-item {
  display: flex;
  align-items: center;
  padding: 8px;
  margin: 4px 0;
  border-radius: 6px;
  transition: background-color 0.2s;
  cursor: pointer;
}

.favorite-item:hover {
  background-color: var(--primary-light);
}

.favorite-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background-color: var(--primary-light);
  color: var(--primary-color);
  margin-right: 12px;
  flex-shrink: 0;
}

.favorite-icon.backend {
  background-color: rgba(46, 204, 113, 0.1);
  color: var(--secondary-color);
}

.favorite-icon.frontend {
  background-color: rgba(243, 156, 18, 0.1);
  color: var(--warning-color);
}

.favorite-icon.database {
  background-color: rgba(231, 76, 60, 0.1);
  color: var(--danger-color);
}

.collapsed .favorite-icon {
  margin-right: 0;
  width: 36px;
  height: 36px;
}

.favorite-info {
  flex: 1;
  overflow: hidden;
}

.collapsed .favorite-info {
  display: none;
}

.favorite-name {
  font-weight: 500;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.favorite-path {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
  scrollbar-width: thin;
}

.sidebar-content::-webkit-scrollbar {
  width: 6px;
}

.sidebar-content::-webkit-scrollbar-thumb {
  background-color: var(--border-color);
  border-radius: 3px;
}

.sidebar-content::-webkit-scrollbar-track {
  background-color: transparent;
}

.context-menu {
  position: fixed;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 4px 0;
  min-width: 180px;
  box-shadow: var(--shadow-md);
  z-index: 1000;
}

.context-menu-item {
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.context-menu-item i {
  margin-right: 8px;
}

.context-menu-item:hover {
  background-color: var(--primary-light);
  color: var(--primary-color);
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
}

.sidebar-btn {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  cursor: pointer;
}

.sidebar-btn:hover {
  background-color: var(--primary-light);
  color: var(--primary-color);
}

/* 折叠模式下的图标样式 */
.collapsed-icons {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
}

.collapsed-icon {
  margin: 4px 0;
  cursor: pointer;
}

.folder-tree-drawer {
  padding: 16px;
}

.search-input {
  width: 100%;
  padding: 8px 12px 8px 32px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background-color: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
  transition: all 0.2s;
}

.collapsed .search-input {
  padding: 8px;
  width: 40px;
  background-color: transparent;
  border-color: transparent;
  cursor: pointer;
}

.section-title-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
}

.section-title-container .section-title {
  padding: 0;
  margin: 0;
}

.add-folder-btn {
  font-size: 16px;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.add-folder-btn:hover {
  color: var(--primary-color);
}

.collapsed .add-folder-btn {
  display: none;
}

.no-favorites {
  padding: 16px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background-color: var(--bg-color);
  opacity: 0.8;
}
</style>
