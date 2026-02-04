import type { ITheme } from "xterm";

export type TerminalThemePreset = {
  name: string;
  xterm: ITheme;
  uiVars: Record<string, string>;
  colorScheme: "dark" | "light";
};

export type TerminalThemeSetting =
  | { kind: "single"; name: string }
  | { kind: "system"; light: string; dark: string };

export const DEFAULT_TERMINAL_THEME_NAME = "DevHaven Dark";

const DEVHAVEN_DARK_THEME: TerminalThemePreset = {
  name: DEFAULT_TERMINAL_THEME_NAME,
  xterm: {
    background: "#0b0b0b",
    foreground: "#e5e7eb",
  },
  uiVars: {
    "--terminal-bg": "#0b0b0b",
    "--terminal-fg": "#e5e7eb",
    "--terminal-panel-bg": "#1a1a1a",
    "--terminal-muted-fg": "rgba(229,231,235,0.65)",
    "--terminal-divider": "rgba(255,255,255,0.08)",
    "--terminal-hover-bg": "rgba(255,255,255,0.08)",
    "--terminal-accent": "#453be7",
    "--terminal-accent-bg": "rgba(69,59,231,0.25)",
    "--terminal-accent-outline": "rgba(69,59,231,0.35)",
    "--terminal-split-divider": "rgba(255,255,255,0.08)",
    "--terminal-split-divider-hover": "rgba(255,255,255,0.2)",
  },
  colorScheme: "dark",
};

const ITERM2_SOLARIZED_DARK_THEME: TerminalThemePreset = {
  name: "iTerm2 Solarized Dark",
  xterm: {
    background: "#002b36",
    foreground: "#839496",
    cursor: "#839496",
    cursorAccent: "#073642",
    selectionBackground: "#073642",
    selectionForeground: "#93a1a1",
    selectionInactiveBackground: "#073642",
    black: "#073642",
    red: "#dc322f",
    green: "#859900",
    yellow: "#b58900",
    blue: "#268bd2",
    magenta: "#d33682",
    cyan: "#2aa198",
    white: "#eee8d5",
    brightBlack: "#335e69",
    brightRed: "#cb4b16",
    brightGreen: "#586e75",
    brightYellow: "#657b83",
    brightBlue: "#839496",
    brightMagenta: "#6c71c4",
    brightCyan: "#93a1a1",
    brightWhite: "#fdf6e3",
  },
  uiVars: {
    "--terminal-bg": "#002b36",
    "--terminal-fg": "#839496",
    "--terminal-panel-bg": "#073642",
    "--terminal-muted-fg": "rgba(131,148,150,0.7)",
    "--terminal-divider": "rgba(131,148,150,0.18)",
    "--terminal-hover-bg": "rgba(131,148,150,0.10)",
    "--terminal-accent": "#268bd2",
    "--terminal-accent-bg": "rgba(38,139,210,0.25)",
    "--terminal-accent-outline": "rgba(38,139,210,0.35)",
    "--terminal-split-divider": "rgba(131,148,150,0.10)",
    "--terminal-split-divider-hover": "rgba(131,148,150,0.25)",
  },
  colorScheme: "dark",
};

const ITERM2_SOLARIZED_LIGHT_THEME: TerminalThemePreset = {
  name: "iTerm2 Solarized Light",
  xterm: {
    background: "#fdf6e3",
    foreground: "#657b83",
    cursor: "#657b83",
    cursorAccent: "#eee8d5",
    selectionBackground: "#eee8d5",
    selectionForeground: "#586e75",
    selectionInactiveBackground: "#eee8d5",
    black: "#073642",
    red: "#dc322f",
    green: "#859900",
    yellow: "#b58900",
    blue: "#268bd2",
    magenta: "#d33682",
    cyan: "#2aa198",
    white: "#bbb5a2",
    brightBlack: "#002b36",
    brightRed: "#cb4b16",
    brightGreen: "#586e75",
    brightYellow: "#657b83",
    brightBlue: "#839496",
    brightMagenta: "#6c71c4",
    brightCyan: "#93a1a1",
    brightWhite: "#fdf6e3",
  },
  uiVars: {
    "--terminal-bg": "#fdf6e3",
    "--terminal-fg": "#657b83",
    "--terminal-panel-bg": "#eee8d5",
    "--terminal-muted-fg": "rgba(101,123,131,0.75)",
    "--terminal-divider": "rgba(101,123,131,0.22)",
    "--terminal-hover-bg": "rgba(101,123,131,0.10)",
    "--terminal-accent": "#268bd2",
    "--terminal-accent-bg": "rgba(38,139,210,0.22)",
    "--terminal-accent-outline": "rgba(38,139,210,0.30)",
    "--terminal-split-divider": "rgba(101,123,131,0.12)",
    "--terminal-split-divider-hover": "rgba(101,123,131,0.26)",
  },
  colorScheme: "light",
};

export const TERMINAL_THEME_PRESETS: TerminalThemePreset[] = [
  DEVHAVEN_DARK_THEME,
  ITERM2_SOLARIZED_DARK_THEME,
  ITERM2_SOLARIZED_LIGHT_THEME,
];

export function getTerminalThemePresetByName(name: string | null | undefined): TerminalThemePreset {
  const normalized = (name ?? "").trim();
  if (!normalized) {
    return DEVHAVEN_DARK_THEME;
  }
  return TERMINAL_THEME_PRESETS.find((preset) => preset.name === normalized) ?? DEVHAVEN_DARK_THEME;
}

export function parseTerminalThemeSetting(value: string | null | undefined): TerminalThemeSetting {
  const raw = (value ?? "").trim();
  if (!raw) {
    return { kind: "single", name: DEFAULT_TERMINAL_THEME_NAME };
  }

  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  let light: string | null = null;
  let dark: string | null = null;

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.startsWith("light:")) {
      const name = part.slice("light:".length).trim();
      if (name) {
        light = name;
      }
      continue;
    }
    if (lower.startsWith("dark:")) {
      const name = part.slice("dark:".length).trim();
      if (name) {
        dark = name;
      }
    }
  }

  if (light && dark) {
    return { kind: "system", light, dark };
  }
  return { kind: "single", name: raw };
}

export function resolveTerminalThemeName(setting: string | null | undefined, systemScheme: "light" | "dark"): string {
  const parsed = parseTerminalThemeSetting(setting);
  if (parsed.kind === "system") {
    return systemScheme === "light" ? parsed.light : parsed.dark;
  }
  return parsed.name;
}

