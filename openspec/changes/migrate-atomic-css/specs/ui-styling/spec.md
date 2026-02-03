## MODIFIED Requirements
### Requirement: 应用样式体系
界面样式 SHALL 使用 UnoCSS 原子化类来定义布局、排版与交互状态，并保留必要的全局样式用于复杂选择器。

#### Scenario: 常规界面渲染
- **WHEN** 应用启动并渲染主界面
- **THEN** 所有布局与组件样式由 UnoCSS 类提供
- **AND** 仅滚动条、Markdown 内容与 xterm 等复杂选择器继续使用全局 CSS
