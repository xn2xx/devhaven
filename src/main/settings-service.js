const { app } = require("electron");
const path = require("path");
const Store = require("electron-store");

// 初始化设置存储
const store = new Store({
  name: "devhaven-settings",
  defaults: {
    dbPath: path.join(app.getPath("userData"), "devhaven.db"),
    theme: "light"
  }
});

/**
 * 获取所有应用设置
 * @returns {Object} 应用设置对象
 */
function getSettings() {
  return {
    dbPath: store.get("dbPath"),
    theme: store.get("theme")
  };
}

/**
 * 保存应用设置
 * @param {Object} settings 要保存的设置对象
 * @returns {Object} 操作结果
 */
function saveSettings(settings) {
  if (settings.dbPath) store.set("dbPath", settings.dbPath);
  if (settings.theme) store.set("theme", settings.theme);
  return { success: true };
}

/**
 * 获取数据库路径
 * @returns {string} 数据库路径
 */
function getDbPath() {
  return store.get("dbPath");
}

/**
 * 设置数据库路径
 * @param {string} dbPath 数据库路径
 */
function setDbPath(dbPath) {
  store.set("dbPath", dbPath);
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
function setDefaultIde(ideName) {
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
function setTheme(theme) {
  store.set("theme", theme);
}

module.exports = {
  getSettings,
  saveSettings,
  getDbPath,
  setDbPath,
  getTheme,
  setTheme
};
