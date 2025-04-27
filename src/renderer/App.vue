<template>
  <div id="app">
    <router-view />
  </div>
</template>
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
</style>
