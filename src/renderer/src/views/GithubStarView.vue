<template>
  <div class="github-star-container">
    <div class="github-header">
      <button class="back-button" @click="$router.back()">
        <i class="i-fa-solid:arrow-left"></i>
      </button>
      <h2>GitHub 收藏管理</h2>
      <el-button v-if="!isAuthenticated" type="primary" size="small" @click="handleLogin">
        <i class="i-fa-brands:github mr-1"></i> 连接 GitHub
      </el-button>
      <el-button v-else size="small" @click="handleLogout">
        <i class="i-fa-solid:sign-out-alt mr-1"></i> 断开连接
      </el-button>
      <el-button v-if="isAuthenticated" size="small" @click="syncStarredRepos">
        <i class="i-fa-solid:sync mr-1"></i> 同步
      </el-button>
    </div>

    <div class="github-content" v-loading="loading">
      <div v-if="!isAuthenticated" class="auth-prompt">
        <div class="auth-icon">
          <i class="i-fa-brands:github"></i>
        </div>
        <h3>连接您的 GitHub 账号</h3>
        <p>连接后可以查看和管理您的 GitHub 收藏项目</p>
        <el-button type="primary" @click="handleLogin">连接 GitHub</el-button>
      </div>

      <template v-else>
        <div class="github-layout">
          <!-- 左侧过滤面板 -->
          <div class="filter-panel">
            <h3>筛选</h3>

            <div class="filter-section">
              <h4>编程语言</h4>
              <el-input
                v-model="languageSearch"
                placeholder="搜索语言"
                prefix-icon="el-icon-search"
                clearable
                class="mb-2"
              ></el-input>
              <div class="language-list">
                <el-checkbox-group v-model="selectedLanguages">
                  <el-checkbox
                    v-for="lang in filteredLanguages"
                    :key="lang.name"
                    :label="lang.name"
                    class="language-item"
                  >
                    {{ lang.name }} <span class="language-count">({{ lang.count }})</span>
                  </el-checkbox>
                </el-checkbox-group>
              </div>
            </div>

            <div class="filter-section">
              <h4>Topics</h4>
              <el-input
                v-model="topicSearch"
                placeholder="搜索话题"
                prefix-icon="el-icon-search"
                clearable
                class="mb-2"
              ></el-input>
              <div class="topic-list">
                <el-checkbox-group v-model="selectedTopics">
                  <el-checkbox
                    v-for="topic in filteredTopics"
                    :key="topic.name"
                    :label="topic.name"
                    class="topic-item"
                  >
                    {{ topic.name }} <span class="topic-count">({{ topic.count }})</span>
                  </el-checkbox>
                </el-checkbox-group>
              </div>
            </div>
          </div>

          <!-- 右侧项目列表 -->
          <div class="projects-panel">
            <div class="projects-header">
              <el-input
                v-model="projectSearch"
                placeholder="搜索项目"
                prefix-icon="el-icon-search"
                clearable
                class="project-search"
              ></el-input>
              <div class="projects-count">
                显示 {{ filteredProjects.length }} / {{ starredProjects.length }} 个项目
              </div>
            </div>

            <div class="projects-grid">
              <template v-if="filteredProjects.length > 0">
                <div v-for="project in filteredProjects" :key="project.id" class="project-card">
                  <div class="project-header">
                    <h4 class="project-name">
                      <a :href="project.html_url" target="_blank">{{ project.name }}</a>
                    </h4>
                    <div class="project-owner">
                      <a :href="project?.owner?.html_url" target="_blank">
                        <span>{{ project?.owner?.login }}</span>
                      </a>
                    </div>
                  </div>

                  <p class="project-description">{{ project.description || '暂无描述' }}</p>

                  <div class="project-stats">
                    <div class="stat-item">
                      <i class="i-fa-solid:star"></i>
                      <span>{{ project.stargazers_count }}</span>
                    </div>
                    <div class="stat-item" v-if="project.language">
                      <span
                        class="language-dot"
                        :style="{ backgroundColor: getLanguageColor(project.language) }"
                      ></span>
                      <span>{{ project.language }}</span>
                    </div>
                    <div class="stat-item">
                      <i class="i-fa-solid:code-branch"></i>
                      <span>{{ project.forks_count }}</span>
                    </div>
                  </div>

                  <div class="project-topics" v-if="project.topics && project.topics.length > 0">
                    <span
                      v-for="topic in project.topics.slice(0, 3)"
                      :key="topic"
                      class="topic-tag"
                    >
                      {{ topic }}
                    </span>
                    <span v-if="project.topics.length > 3" class="more-topics">
                      +{{ project.topics.length - 3 }}
                    </span>
                  </div>

                  <div class="project-actions">
                    <el-button type="primary" size="small" @click="openProject(project)">
                      <i class="i-fa-solid:external-link-alt mr-1"></i> 打开
                    </el-button>
                    <el-button size="small" @click="importProject(project)">
                      <i class="i-fa-solid:download mr-1"></i> 导入
                    </el-button>
                  </div>
                </div>
              </template>

              <div v-else class="no-projects">
                <i class="i-fa-solid:search"></i>
                <p>未找到匹配的项目</p>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 项目弹窗 -->
    <ProjectDialog
      v-model:visible="projectDialogVisible"
      :project-data="projectToImport"
      @save="saveImportedProject"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/store'
import ProjectDialog from './home/components/ProjectDialog.vue'

// Store
const store = useAppStore()

// 状态
const loading = ref(false)
const isAuthenticated = ref(false)
const starredProjects = ref([])
const githubUser = ref(null)
const waitingForAuth = ref(false)

// 项目导入相关
const projectDialogVisible = ref(false)
const projectToImport = ref(null)
const importedProjects = ref([])

// 筛选状态
const languageSearch = ref('')
const topicSearch = ref('')
const projectSearch = ref('')
const selectedLanguages = ref([])
const selectedTopics = ref([])

// 计算语言列表
const languageList = computed(() => {
  const languages = {}

  starredProjects.value.forEach((project) => {
    if (project.language) {
      if (!languages[project.language]) {
        languages[project.language] = 0
      }
      languages[project.language]++
    }
  })

  return Object.entries(languages)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
})

// 筛选语言
const filteredLanguages = computed(() => {
  if (!languageSearch.value) return languageList.value

  return languageList.value.filter((lang) =>
    lang.name.toLowerCase().includes(languageSearch.value.toLowerCase())
  )
})
const syncStarredRepos = () => {
  loading.value = true
  window.api
    .syncStarredRepositories()
    .then(() => {
      loading.value = false
    })
    .catch(() => {
      loading.value = false
      ElMessage.error('同步失败')
    })
}

// 计算话题列表
const topicList = computed(() => {
  const topics = {}

  starredProjects.value.forEach((project) => {
    if (project.topics && project.topics.length > 0) {
      project.topics.forEach((topic) => {
        if (!topics[topic]) {
          topics[topic] = 0
        }
        topics[topic]++
      })
    }
  })

  return Object.entries(topics)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
})

// 筛选话题
const filteredTopics = computed(() => {
  if (!topicSearch.value) return topicList.value

  return topicList.value.filter((topic) =>
    topic.name.toLowerCase().includes(topicSearch.value.toLowerCase())
  )
})

// 筛选项目
const filteredProjects = computed(() => {
  let result = [...starredProjects.value]

  // 按名称筛选
  if (projectSearch.value) {
    const searchTerm = projectSearch.value.toLowerCase()
    result = result.filter(
      (project) =>
        project.name.toLowerCase().includes(searchTerm) ||
        (project.description && project.description.toLowerCase().includes(searchTerm)) ||
        project.owner.login.toLowerCase().includes(searchTerm)
    )
  }

  // 按语言筛选
  if (selectedLanguages.value.length > 0) {
    result = result.filter(
      (project) => project.language && selectedLanguages.value.includes(project.language)
    )
  }

  // 按话题筛选
  if (selectedTopics.value.length > 0) {
    result = result.filter((project) => {
      if (!project.topics || project.topics.length === 0) return false
      return selectedTopics.value.some((topic) => project.topics.includes(topic))
    })
  }

  return result
})

// 获取语言颜色
const getLanguageColor = (language) => {
  const colors = {
    JavaScript: '#f1e05a',
    TypeScript: '#2b7489',
    Python: '#3572A5',
    Java: '#b07219',
    Go: '#00ADD8',
    'C++': '#f34b7d',
    PHP: '#4F5D95',
    Ruby: '#701516',
    'C#': '#178600',
    Rust: '#dea584',
    Swift: '#ffac45',
    Kotlin: '#F18E33',
    Vue: '#41b883',
    React: '#61dafb',
    HTML: '#e34c26',
    CSS: '#563d7c'
  }

  return colors[language] || '#8e8e8e'
}

// GitHub授权
const handleLogin = async () => {
  loading.value = true
  waitingForAuth.value = true
  try {
    // 在调用认证前，先设置一个监听器
    window.api.ipcRenderer.on('github-auth-callback', handleAuthCallback)
    // 调用Electron主进程进行GitHub OAuth认证（这只是打开浏览器）
    const result = await window.api.authenticateGithub()
    if (!result.success) {
      ElMessage.error('启动GitHub认证失败')
      waitingForAuth.value = false
      loading.value = false
    } else {
      ElMessage.info('请在浏览器中完成GitHub授权')
    }
  } catch (error) {
    console.error('GitHub认证错误:', error)
    ElMessage.error('GitHub连接出错')
    waitingForAuth.value = false
    loading.value = false
  }
}
const handleStarredReposUpdated = async (result) => {
  debugger
  console.log('仓库信息存储到数据库之中', result)
  await fetchStarredRepos()
  window.api.ipcRenderer.removeListener('github-starred-repos-updated', handleStarredReposUpdated)
}
// 处理OAuth回调结果
const handleAuthCallback = async (authResult) => {
  try {
    // 移除监听器，避免重复处理
    window.api.ipcRenderer.removeListener('github-auth-callback', handleAuthCallback)
    window.api.ipcRenderer.on('github-starred-repos-updated', handleStarredReposUpdated)
    waitingForAuth.value = false

    if (authResult && authResult.success) {
      isAuthenticated.value = true
      githubUser.value = authResult.user
      // await fetchStarredRepos()
      ElMessage.success(`已连接到GitHub账号: ${authResult.user.login}`)
    } else {
      ElMessage.error('GitHub授权失败: ' + (authResult?.error || '未知错误'))
    }
  } catch (error) {
    console.error('处理GitHub回调错误:', error)
    ElMessage.error('GitHub连接处理出错')
  }
}

const handleLogout = async () => {
  try {
    await window.api.logoutGithub()
    isAuthenticated.value = false
    githubUser.value = null
    starredProjects.value = []
    importedProjects.value = []
    ElMessage.success('已断开GitHub连接')
  } catch (error) {
    console.error('GitHub登出错误:', error)
    ElMessage.error('断开连接失败')
  }
}

// 获取已收藏的仓库
const fetchStarredRepos = async () => {
  loading.value = true
  try {
    starredProjects.value = await window.api.getGithubStarredRepos()
  } catch (error) {
    console.error('获取GitHub收藏错误:', error)
    ElMessage.error('获取GitHub收藏失败')
  } finally {
    loading.value = false
  }
}

// 打开项目
const openProject = (project) => {
  window.api.openExternalUrl(project.html_url)
}

// 导入项目到DevHaven
const importProject = (project) => {
  // 构建项目数据
  projectToImport.value = {
    id: null,
    name: project.name,
    description: project.description || '',
    path: `${store.settings?.githubProjectsPath || ''}/${project.owner.login}/${project.name}`,
    folder_id: null,
    preferred_ide: ['vscode'],
    icon: project.language ? getIconByLanguage(project.language) : 'code',
    source_type: 'github',
    github_url: project.html_url,
    is_cloned: 0 // 初始设置为未克隆
  }

  // 打开项目对话框
  projectDialogVisible.value = true
}

// 根据语言获取图标
const getIconByLanguage = (language) => {
  const langToIcon = {
    JavaScript: 'js',
    TypeScript: 'ts',
    Python: 'python',
    Java: 'java',
    Ruby: 'gem',
    PHP: 'php',
    HTML: 'html5',
    CSS: 'css3',
    C: 'code',
    'C++': 'code',
    'C#': 'code',
    Go: 'code',
    Rust: 'code'
  }

  return langToIcon[language] || 'code'
}

// 保存导入的项目
const saveImportedProject = async (project) => {
  try {
    // 确保设置source_type和is_cloned
    project.source_type = 'github'
    if (project.is_cloned === undefined) {
      project.is_cloned = 0
    }

    // 创建项目
    const newProject = await store.createProject(project)

    if (newProject) {
      ElMessage.success(`项目 ${project.name} 已导入`)

      // 添加到已导入项目列表
      importedProjects.value.push({
        id: newProject.id,
        github_id: project.id,
        name: project.name
      })
    }
  } catch (error) {
    console.error('导入项目失败:', error)
    ElMessage.error('导入项目失败')
  }
}

// 检查认证状态
const checkAuthStatus = async () => {
  loading.value = true
  try {
    const status = await window.api.getGithubAuthStatus()
    isAuthenticated.value = status.isAuthenticated
    if (status.isAuthenticated) {
      githubUser.value = status.user
      await fetchStarredRepos()
    }
  } catch (error) {
    console.error('检查GitHub认证状态错误:', error)
  } finally {
    loading.value = false
  }
}

// 生命周期钩子
onMounted(() => {
  checkAuthStatus()

  // 如果页面加载时正在等待认证，设置监听器
  if (waitingForAuth.value) {
    window.api.ipcRenderer.on('github-auth-callback', handleAuthCallback)
  }
  // 进来的时候执行同步
  window.api.syncStarredRepositories()
})

onBeforeUnmount(() => {
  // 确保在组件卸载时移除事件监听
  window.api.ipcRenderer.removeListener('github-auth-callback', handleAuthCallback)
})
</script>

<style scoped>
.github-star-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-color);
}

.github-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 16px;
  background-color: var(--card-bg);
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

.github-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  flex: 1;
}

.github-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.auth-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  text-align: center;
  padding: 20px;
}

.auth-icon {
  font-size: 48px;
  color: var(--primary-color);
}

.auth-prompt h3 {
  font-size: 20px;
  font-weight: 500;
  margin: 0;
}

.auth-prompt p {
  color: var(--text-secondary);
  max-width: 400px;
  margin: 0;
}

.github-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.filter-panel {
  width: 250px;
  background-color: var(--card-bg);
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
  padding: 16px;
  flex-shrink: 0;
}

.filter-panel h3 {
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 16px 0;
}

.filter-section {
  margin-bottom: 24px;
}

.filter-section h4 {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 12px 0;
  color: var(--text-secondary);
}

.language-list,
.topic-list {
  max-height: 200px;
  overflow-y: auto;
}

.language-item,
.topic-item {
  display: block;
  margin-bottom: 6px;
}

.language-count,
.topic-count {
  font-size: 12px;
  color: var(--text-secondary);
}

.projects-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.projects-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 16px;
}

.project-search {
  max-width: 300px;
}

.projects-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.projects-grid {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.project-card {
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  height: 250px;
  flex-direction: column;
  gap: 12px;
  transition: all 0.2s ease;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.project-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-name {
  font-size: 16px;
  font-weight: 500;
  margin: 0;
}

.project-name a {
  color: var(--primary-color);
  text-decoration: none;
}

.project-name a:hover {
  text-decoration: underline;
}

.project-owner {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.project-owner a {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  text-decoration: none;
}

.project-description {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.project-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.language-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.project-topics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.topic-tag {
  font-size: 12px;
  background-color: var(--primary-light);
  color: var(--primary-color);
  padding: 2px 8px;
  border-radius: 12px;
}

.more-topics {
  font-size: 12px;
  color: var(--text-secondary);
}

.project-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}

.no-projects {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--text-secondary);
  text-align: center;
}

.no-projects i {
  font-size: 32px;
  margin-bottom: 16px;
}

.mb-2 {
  margin-bottom: 12px;
}

.mr-1 {
  margin-right: 4px;
}
</style>
