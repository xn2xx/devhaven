<template>
  <div class="about-section">
    <div class="app-logo">
      <i class="i-fa-solid:boxes"></i>
    </div>
    <h2 class="app-name">DevHaven</h2>
    <div class="app-version">版本 1.0.0</div>
    <p class="app-description">
      一个高效管理本地开发项目的工具，让您的开发工作更轻松、更有条理。
    </p>
    <div class="app-copyright">
      © 2023 DevHaven. 保留所有权利。
    </div>
  </div>
</template>

<script setup>
// 无需任何逻辑
</script>

<style scoped>
.about-section {
  text-align: center;
  padding: 40px 0;
}

.app-logo {
  font-size: 72px;
  color: var(--primary-color);
  margin-bottom: 20px;
}

.app-name {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 8px;
}

.app-version {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.app-description {
  font-size: 16px;
  line-height: 1.6;
  margin-bottom: 24px;
  color: var(--text-secondary);
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.app-copyright {
  font-size: 14px;
  color: var(--text-muted);
}
</style>
