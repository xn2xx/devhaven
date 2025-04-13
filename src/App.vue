<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
import { useAppStore } from './store'
import {  watchEffect } from 'vue'

const store = useAppStore()
// 监听主题变化
watchEffect(() => {
  const theme = store.theme;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
});


</script>

<style>
/* 导入HTML模板样式 */
:root {
  --primary-color: #3498db;
  --primary-dark: #2980b9;
  --primary-light: rgba(52, 152, 219, 0.1);
  --secondary-color: #2ecc71;
  --secondary-dark: #27ae60;
  --warning-color: #f39c12;
  --danger-color: #e74c3c;
  --bg-color: #f8f9fa;
  --card-bg: #ffffff;
  --border-color: #e1e5e8;
  --text-color: #333333;
  --text-secondary: #7f8c8d;
  --text-muted: #95a5a6;
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.15);
}

html.dark {
  --primary-color: #3498db;
  --primary-dark: #2980b9;
  --primary-light: rgba(52, 152, 219, 0.2);
  --secondary-color: #2ecc71;
  --secondary-dark: #27ae60;
  --warning-color: #f39c12;
  --danger-color: #e74c3c;
  --bg-color: #1a1d21;
  --card-bg: #282c34;
  --border-color: #3a3f48;
  --text-color: #ecf0f1;
  --text-secondary: #bdc3c7;
  --text-muted: #95a5a6;
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.25);
  --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.3);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  transition: background-color 0.3s ease;
}

.app-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* 侧边栏样式 */
.sidebar {
  width: 280px;
  background-color: var(--card-bg);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  z-index: 10;
}

.sidebar-collapsed {
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

.sidebar-collapsed .logo-text {
  display: none;
}

.sidebar-collapsed .logo-icon {
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

.sidebar-search {
  padding: 12px 16px;
  position: relative;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-collapsed .sidebar-search {
  padding: 12px 8px;
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
}

.sidebar-collapsed .search-icon {
  left: 50%;
  transform: translate(-50%, -50%);
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

.search-input:focus {
  border-color: var(--primary-color);
  outline: none;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.sidebar-collapsed .search-input {
  padding: 8px;
  width: 40px;
  background-color: transparent;
  border-color: transparent;
  cursor: pointer;
}

.sidebar-collapsed .search-input::placeholder {
  opacity: 0;
}

/* 主内容区 */
.main-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}

.content-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--card-bg);
}

.content-title {
  font-size: 20px;
  font-weight: 500;
}

.header-actions {
  display: flex;
  align-items: center;
}

.action-btn {
  padding: 8px 16px;
  margin-left: 8px;
  border-radius: 6px;
  border: none;
  background-color: var(--primary-color);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 14px;
}

.action-btn:hover {
  background-color: var(--secondary-color);
}

.action-btn-icon {
  margin-right: 6px;
}

.action-btn.secondary {
  background-color: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-color);
}

.action-btn.secondary:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.content-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.project-card {
  background-color: var(--card-bg);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-header {
  padding: 16px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
}

.project-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(52, 152, 219, 0.1);
  color: var(--primary-color);
  font-size: 20px;
}

.card-header-info {
  margin-left: 12px;
  flex: 1;
}

.project-title {
  font-weight: 500;
  margin: 0;
  font-size: 16px;
}

.project-subtitle {
  color: var(--text-muted);
  font-size: 13px;
  margin-top: 4px;
}

.card-menu {
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  border-radius: 4px;
}

.card-menu:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--text-color);
}

.card-body {
  padding: 16px;
}

.project-stats {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  margin-right: 16px;
  font-size: 13px;
  color: var(--text-muted);
}

.stat-icon {
  margin-right: 6px;
  font-size: 14px;
}

.project-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.project-tag {
  padding: 4px 10px;
  background-color: rgba(52, 152, 219, 0.1);
  color: var(--primary-color);
  border-radius: 4px;
  font-size: 12px;
}

.project-tag.backend {
  background-color: rgba(46, 204, 113, 0.1);
  color: var(--secondary-color);
}

.project-tag.frontend {
  background-color: rgba(243, 156, 18, 0.1);
  color: var(--warning-color);
}

.card-actions {
  display: flex;
  align-items: center;
  margin-top: 12px;
}

.card-action-btn {
  padding: 8px 12px;
  background-color: transparent;
  border: 1px solid var(--primary-color);
  color: var(--primary-color);
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  margin-right: 8px;
  display: flex;
  align-items: center;
}

.card-action-btn:hover {
  background-color: var(--primary-color);
  color: white;
}

.card-action-icon {
  margin-right: 4px;
  font-size: 14px;
}

/* 文档部分样式 */
.docs-section {
  margin-top: 32px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.doc-meta {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 4px;
}

/* 详情模态框样式 */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background-color: var(--card-bg);
  width: 60%;
  max-width: 800px;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 18px;
  font-weight: 500;
  margin: 0;
}

.modal-close {
  font-size: 24px;
  cursor: pointer;
  color: var(--text-muted);
}

.modal-close:hover {
  color: var(--text-color);
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
}

.form-select {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
}

.form-textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  min-height: 100px;
  resize: vertical;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
  margin-top: 16px;
}

.form-button {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  margin-left: 12px;
}

.cancel-button {
  background-color: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-color);
}

.cancel-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.save-button {
  background-color: var(--primary-color);
  border: none;
  color: white;
}

.save-button:hover {
  background-color: var(--secondary-color);
}

/* 面包屑导航 */
.breadcrumb {
  display: flex;
  align-items: center;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
}

.breadcrumb-item:not(:last-child):after {
  content: '/';
  margin: 0 8px;
  color: var(--text-muted);
}

.breadcrumb-link {
  color: var(--text-muted);
  text-decoration: none;
}

.breadcrumb-link:hover {
  color: var(--primary-color);
}

.breadcrumb-current {
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .projects-grid, .docs-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }

  .modal-content {
    width: 80%;
  }
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: -280px;
    top: 0;
    height: 100%;
    z-index: 100;
    transition: left 0.3s;
    box-shadow: var(--shadow-lg);
  }

  .sidebar.active {
    left: 0;
  }

  .sidebar-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 90;
  }

  .sidebar-overlay.active {
    display: block;
  }

  .mobile-menu-toggle {
    display: block;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 24px;
    cursor: pointer;
    margin-right: 16px;
  }

  .projects-grid, .docs-grid {
    grid-template-columns: 1fr;
  }

  .modal-content {
    width: 95%;
    margin: 40px auto;
  }
}

@media (min-width: 769px) {
  .mobile-menu-toggle {
    display: none;
  }
}
</style>
