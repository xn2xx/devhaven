import { app } from "electron";
import path from "path";
import Store from "electron-store";

// 初始化设置存储
const store = new Store({
  name: "devhaven-settings",
  defaults: {
    dbPath: path.join(app.getPath("userData"), "devhaven.db"),
    theme: "light",
    githubProjectsPath: path.join(app.getPath("home"), "DevHavenGitHub"),
    showTrayWindow: true // 默认显示悬浮窗
  }
});

/**
 * 获取所有应用设置
 * @returns {Object} 应用设置对象
 */
function getSettings() {
  return {
    dbPath: store.get("dbPath"),
    theme: store.get("theme"),
    githubProjectsPath: store.get("githubProjectsPath"),
    showTrayWindow: store.get("showTrayWindow")
  };
}

/**
 * 保存应用设置
 * @param {Object} settings 要保存的设置对象
 * @returns {Object} 操作结果
 */
function saveSettings(settings: any) {
  if (settings.dbPath) store.set("dbPath", settings.dbPath);
  if (settings.theme) store.set("theme", settings.theme);
  if (settings.githubProjectsPath) store.set("githubProjectsPath", settings.githubProjectsPath);
  if (settings.showTrayWindow !== undefined) store.set("showTrayWindow", settings.showTrayWindow);
  return { success: true };
}

/**
 * 获取数据库路径
 * @returns {string} 数据库路径
 */
function getDbPath() :string{
  return store.get("dbPath");
}

/**
 * 设置数据库路径
 * @param {string} dbPath 数据库路径
 */
function setDbPath(dbPath: string) {
  store.set("dbPath", dbPath);
}

/**
 * 获取GitHub项目目录
 * @returns {string} GitHub项目目录
 */
function getGithubProjectsPath() {
  return store.get("githubProjectsPath");
}

/**
 * 设置GitHub项目目录
 * @param {string} githubProjectsPath GitHub项目目录
 */
function setGithubProjectsPath(githubProjectsPath: string) {
  store.set("githubProjectsPath", githubProjectsPath);
}

/**
 * 获取默认IDE
 * @returns {string} 默认IDE名称
 */
function getDefaultIde() {
  return store.get("defaultIde");
}

/**
 * 设置默认IDE
 * @param {string} ideName IDE名称
 */
function setDefaultIde(ideName: string) {
  store.set("defaultIde", ideName);
}

/**
 * 获取主题
 * @returns {string} 主题名称
 */
function getTheme() {
  return store.get("theme");
}

/**
 * 设置主题
 * @param {string} theme 主题名称
 */
function setTheme(theme: string) {
  store.set("theme", theme);
}

/**
 * 获取悬浮窗显示设置
 * @returns {boolean} 是否显示悬浮窗
 */
function getTrayWindowSetting() {
  return store.get("showTrayWindow", true); // 默认为true
}

/**
 * 保存悬浮窗显示设置
 * @param {boolean} show 是否显示悬浮窗
 */
function saveTrayWindowSetting(show: boolean) {
  store.set("showTrayWindow", show);
}

export {
  getSettings,
  saveSettings,
  getDbPath,
  setDbPath,
  getGithubProjectsPath,
  setGithubProjectsPath,
  getDefaultIde,
  setDefaultIde,
  getTheme,
  setTheme,
  getTrayWindowSetting,
  saveTrayWindowSetting
}
