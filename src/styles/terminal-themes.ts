import type { ITheme } from "xterm";

/**
 * iTerm2 Solarized Dark 主题
 * 基于 Ethan Schoonover 的 Solarized 配色方案
 */
export const solarizedDark: ITheme = {
  // 基础颜色
  background: "#002b36",
  foreground: "#839496",
  cursor: "#839496",
  cursorAccent: "#002b36",

  // 选择颜色
  selectionBackground: "rgba(7, 54, 66, 0.99)",
  selectionForeground: "#93a1a1",

  // 标准 ANSI 颜色 (0-7)
  black: "#073642",
  red: "#dc322f",
  green: "#859900",
  yellow: "#b58900",
  blue: "#268bd2",
  magenta: "#d33682",
  cyan: "#2aa198",
  white: "#eee8d5",

  // 高亮 ANSI 颜色 (8-15)
  brightBlack: "#002b36",
  brightRed: "#cb4b16",
  brightGreen: "#586e75",
  brightYellow: "#657b83",
  brightBlue: "#839496",
  brightMagenta: "#6c71c4",
  brightCyan: "#93a1a1",
  brightWhite: "#fdf6e3",
};

/**
 * 透明版本的 Solarized Dark（用于与应用背景融合）
 */
export const solarizedDarkTransparent: ITheme = {
  ...solarizedDark,
  background: "transparent",
};

/**
 * 其他流行主题可以在这里添加
 */
export const themes = {
  solarizedDark,
  solarizedDarkTransparent,
} as const;

export type ThemeName = keyof typeof themes;
