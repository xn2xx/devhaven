const { BrowserWindow, net, shell } = require('electron')
const { stringify } = require('querystring')
const axios = require('axios')
const keytar = require('keytar')
const Store = require('electron-store')

// 用于存储GitHub认证相关信息
const store = new Store({
  name: 'github-oauth',
  encryptionKey: 'dev-haven-github-oauth'
})
const loadEnv = () => {
  if (process.env.NODE_ENV === 'development') {
    return {
      GITHUB_CLIENT_ID: 'Ov23li3eFOHd8AnGWZcU',
      GITHUB_CLIENT_SECRET: '652ee3fdc73dcb2037fc2856b0b8726142956250',
      GITHUB_REDIRECT_URI: 'http://localhost:45678/oauth/callback'
    }
  }
  return {
    GITHUB_CLIENT_ID: 'Ov23liatWhsfHuFRqYMQ',
    GITHUB_CLIENT_SECRET: 'd550714afa2391040142d09df9a3281707c51482',
    GITHUB_REDIRECT_URI: 'devhaven://oauth/callback'
  }
}
const env = loadEnv()
// GitHub OAuth 应用配置
// 注意：这些值应当从环境变量或配置文件中读取
const CLIENT_ID = env.GITHUB_CLIENT_ID
const CLIENT_SECRET = env.GITHUB_CLIENT_SECRET
const REDIRECT_URI = env.GITHUB_REDIRECT_URI

const OAUTH_SCOPES = ['read:user', 'user:email', 'public_repo']

// keytar服务名称
const SERVICE_NAME = 'devhaven-github'
const ACCOUNT_NAME = 'github-oauth'

class GitHubService {
  constructor() {
    this.authWindow = null
    this.authResolver = null
  }

  // 获取当前认证状态
  async getAuthStatus() {
    try {
      const token = await this.getAccessToken()
      if (!token) {
        return { isAuthenticated: false }
      }

      const user = await this.getCurrentUser(token)
      return {
        isAuthenticated: true,
        user
      }
    } catch (error) {
      console.error('获取认证状态失败:', error)
      return { isAuthenticated: false }
    }
  }

  // 从安全存储中获取访问令牌
  async getAccessToken() {
    try {
      return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
    } catch (error) {
      console.error('获取访问令牌失败:', error)
      return null
    }
  }

  // 保存访问令牌到安全存储
  async saveAccessToken(token) {
    try {
      await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token)
      return true
    } catch (error) {
      console.error('保存访问令牌失败:', error)
      return false
    }
  }

  // 清除访问令牌
  async clearAccessToken() {
    try {
      await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME)
      store.clear()
      return true
    } catch (error) {
      console.error('清除访问令牌失败:', error)
      return false
    }
  }

  // 使用临时代码交换访问令牌
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          redirect_uri: REDIRECT_URI
        },
        {
          headers: {
            Accept: 'application/json'
          }
        }
      )

      if (response.data.access_token) {
        await this.saveAccessToken(response.data.access_token)
        return response.data.access_token
      }

      throw new Error('未能获取访问令牌')
    } catch (error) {
      console.error('交换访问令牌失败:', error)
      throw error
    }
  }

  // 启动OAuth认证流程
  async authenticate() {
    try {
      console.log('启动GitHub认证流程...')

      // 创建一个认证Promise
      const authPromise = new Promise((resolve) => {
        this.authResolver = resolve
      })

      // 创建一个随机state值防止CSRF攻击
      const state = Math.random().toString(36).substring(2, 15)
      store.set('oauth_state', state)

      // 构建认证URL
      const authParams = {
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: OAUTH_SCOPES.join(' '),
        state: state,
        response_type: 'code'
      }

      const queryString = Object.entries(authParams)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&')

      const authUrl = `https://github.com/login/oauth/authorize?${queryString}`

      console.log('认证URL已构建:', authUrl)
      console.log('重定向URI:', REDIRECT_URI)

      // 设置协议处理器
      this.setupProtocolHandler()

      // 使用系统默认浏览器打开认证页面
      console.log('正在打开系统浏览器...')
      await shell.openExternal(authUrl)
      console.log('已在系统浏览器中打开GitHub授权页面')

      // 等待认证完成
      console.log('等待认证完成...')
      return await authPromise
    } catch (error) {
      console.error('启动认证流程失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 设置自定义协议处理器
  setupProtocolHandler() {
    // 协议处理器已在主进程的app.setAsDefaultProtocolClient中注册
    // 这里不需要做额外的操作，因为主进程已经监听了协议激活事件
    // 并会调用我们的handleCallback方法

    // 如果存在之前的解析器（可能是之前未完成的认证），需要清除
    if (this.authResolver) {
      this.authResolver({ success: false, error: 'Authentication was restarted' })
      this.authResolver = null
    }
  }

  // 处理授权回调
  async handleCallback(url) {
    console.log('GitHub服务收到回调URL:', url)

    if (!url) {
      console.error('回调URL为空')
      return
    }

    if (!url.startsWith(REDIRECT_URI)) {
      console.error('回调URL不匹配重定向URI:', url)
      return
    }

    try {
      // 解析URL，获取code和state参数
      let code = null
      let state = null

      try {
        const urlObj = new URL(url)
        code = urlObj.searchParams.get('code')
        state = urlObj.searchParams.get('state')
        console.log('从URL中提取的授权码:', code ? '成功获取' : '未获取到')
        console.log('从URL中提取的state:', state ? '成功获取' : '未获取到')
      } catch (parseError) {
        // URL解析失败，尝试手动解析
        console.warn('URL解析失败，尝试手动解析:', parseError.message)
        const queryString = url.split('?')[1]
        if (queryString) {
          const params = new URLSearchParams(queryString)
          code = params.get('code')
          state = params.get('state')
          console.log('手动解析获取的授权码:', code ? '成功获取' : '未获取到')
          console.log('手动解析获取的state:', state ? '成功获取' : '未获取到')
        }
      }

      // 验证state参数，防止CSRF攻击
      const savedState = store.get('oauth_state')
      console.log('保存的state:', savedState)
      console.log('收到的state:', state)

      if (state !== savedState) {
        console.error('State参数不匹配，可能是CSRF攻击')
        if (this.authResolver) {
          this.authResolver({
            success: false,
            error: 'State parameter mismatch, possible CSRF attack'
          })
          this.authResolver = null
        }
        return
      }

      // 清除保存的state
      store.delete('oauth_state')

      if (code) {
        console.log('正在使用授权码交换访问令牌...')
        // 交换代码获取访问令牌
        const token = await this.exchangeCodeForToken(code)
        console.log('访问令牌获取成功')

        // 获取用户信息
        console.log('正在获取用户信息...')
        const user = await this.getCurrentUser(token)
        console.log('用户信息获取成功:', user.login)

        console.log('调用认证解析器，返回成功结果')
        this.authResolver({ success: true, user })
        this.authResolver = null
      } else {
        // 没有收到授权码
        console.error('未从回调URL中获取到授权码')
        if (this.authResolver) {
          this.authResolver({ success: false, error: 'No authorization code received' })
          this.authResolver = null
        }
      }
    } catch (error) {
      console.error('认证回调处理出错:', error)
      if (this.authResolver) {
        this.authResolver({ success: false, error: error.message })
        this.authResolver = null
      }
    }
  }

  // 获取当前登录用户信息
  async getCurrentUser(token) {
    try {
      const response = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `token ${token}`
        }
      })
      return response.data
    } catch (error) {
      console.error('获取用户信息失败:', error)
      throw error
    }
  }

  // 获取用户已加星标的仓库
  async getStarredRepositories() {
    try {
      const token = await this.getAccessToken()
      if (!token) {
        throw new Error('未授权')
      }

      // 使用分页获取所有星标仓库
      let page = 1
      const perPage = 100
      let allRepos = []
      let hasMore = true

      while (hasMore) {
        const response = await axios.get(
          `https://api.github.com/user/starred?page=${page}&per_page=${perPage}`,
          {
            headers: {
              Authorization: `token ${token}`
            }
          }
        )

        if (response.data.length === 0) {
          hasMore = false
        } else {
          allRepos = [...allRepos, ...response.data]
          page++
        }
      }

      return allRepos
    } catch (error) {
      console.error('获取星标仓库失败:', error)
      throw error
    }
  }

  // 登出
  async logout() {
    return await this.clearAccessToken()
  }
}

module.exports = new GitHubService()
