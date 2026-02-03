# Change: 迁移到 UnoCSS 原子化样式

## Why
当前样式集中在 `App.css` 与 `theme.css`，维护成本高、复用度低。引入原子化样式框架可以提升一致性、减少重复并为后续迭代提供更快的样式调整能力。

## What Changes
- 引入 UnoCSS 与 Vite 插件并完成基础配置
- 将 `theme.css` 变量迁移为 UnoCSS 主题 token
- 删除 `App.css`/`theme.css`，全量改写组件 `className` 为原子化样式
- 保留少量全局 CSS（字体、滚动条、xterm/Markdown 等复杂选择器）

## Impact
- Affected specs: 无（当前未定义 specs）
- Affected code:
  - `vite.config.ts`
  - `src/main.tsx`
  - `src/styles/base.css`/`src/styles/global.css`
  - `unocss.config.ts`
  - `src/App.tsx`
  - `src/components/*`
