# 终端主题配置指南

## 当前配置

应用已配置为使用 **iTerm2 Solarized Dark** 主题，与 Ghostty 保持一致。

## 主题文件

主题定义在 `src/styles/terminal-themes.ts` 中，包含：

- `solarizedDark` - 完整的 Solarized Dark 主题
- `solarizedDarkTransparent` - 透明背景版本（当前使用）

## 如何切换主题

### 方法 1: 使用预定义主题

编辑 `src/hooks/useTerminalSession.ts`，修改导入：

```typescript
// 使用透明背景版本
import { solarizedDarkTransparent } from "../styles/terminal-themes";

// 或使用完整背景版本
import { solarizedDark } from "../styles/terminal-themes";
```

### 方法 2: 添加新主题

在 `src/styles/terminal-themes.ts` 中添加新主题：

```typescript
export const myCustomTheme: ITheme = {
  background: "#1e1e1e",
  foreground: "#d4d4d4",
  cursor: "#d4d4d4",

  // ANSI 颜色
  black: "#000000",
  red: "#cd3131",
  green: "#0dbc79",
  yellow: "#e5e510",
  blue: "#2472c8",
  magenta: "#bc3fbc",
  cyan: "#11a8cd",
  white: "#e5e5e5",

  // 高亮颜色
  brightBlack: "#666666",
  brightRed: "#f14c4c",
  brightGreen: "#23d18b",
  brightYellow: "#f5f543",
  brightBlue: "#3b8eea",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#ffffff",
};
```

然后在 `useTerminalSession.ts` 中使用：

```typescript
import { myCustomTheme } from "../styles/terminal-themes";

const terminal = new Terminal({
  // ...
  theme: myCustomTheme,
  // ...
});
```

## Solarized Dark 颜色参考

| 颜色名称 | 十六进制 | 用途 |
|---------|---------|------|
| base03  | #002b36 | 背景 |
| base02  | #073642 | 背景高亮 |
| base01  | #586e75 | 注释 |
| base00  | #657b83 | 次要内容 |
| base0   | #839496 | 主要内容 |
| base1   | #93a1a1 | 强调内容 |
| base2   | #eee8d5 | 背景高亮（浅色） |
| base3   | #fdf6e3 | 背景（浅色） |
| yellow  | #b58900 | 黄色 |
| orange  | #cb4b16 | 橙色 |
| red     | #dc322f | 红色 |
| magenta | #d33682 | 品红 |
| violet  | #6c71c4 | 紫罗兰 |
| blue    | #268bd2 | 蓝色 |
| cyan    | #2aa198 | 青色 |
| green   | #859900 | 绿色 |

## 其他流行主题

你可以参考以下资源添加更多主题：

- [iTerm2 Color Schemes](https://iterm2colorschemes.com/)
- [Gogh Terminal Themes](https://gogh-co.github.io/Gogh/)
- [xterm.js Themes](https://github.com/mbadolato/iTerm2-Color-Schemes/tree/master/xterm)

## 背景色配置

终端容器的背景色在 `src/App.css` 中配置：

```css
.workspace-terminal {
  background: #002b36; /* 与主题背景色匹配 */
}
```

如果切换主题，记得同步更新这个背景色。
