import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

const MONACO_THEME = "devhaven-terminal";

// Monaco needs explicit worker wiring in bundlers like Vite.
// We keep it local to the editor chunk so the main terminal workspace stays light.
(self as unknown as { MonacoEnvironment?: unknown }).MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === "json") {
      return new jsonWorker();
    }
    if (label === "css" || label === "scss" || label === "less") {
      return new cssWorker();
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return new htmlWorker();
    }
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

loader.config({ monaco });

let monacoInitialized = false;
let monacoInitPromise: Promise<void> | null = null;

async function ensureMonacoInitialized(): Promise<void> {
  if (monacoInitialized) {
    return;
  }
  if (monacoInitPromise) {
    return monacoInitPromise;
  }
  monacoInitPromise = (async () => {
    await loader.init();
    monacoInitialized = true;
  })();
  return monacoInitPromise;
}

export type TerminalMonacoEditorProps = {
  value: string;
  language: string;
  readOnly: boolean;
  onChange: (next: string) => void;
  onSave?: () => void;
};

function registerSaveAction(editor: monaco.editor.IStandaloneCodeEditor, onSave: () => void) {
  editor.addAction({
    id: "save-file",
    label: "Save File",
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    run: () => onSave(),
  });
}

function parseRgbTuple(value: string): { r: number; g: number; b: number } | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = Number.parseInt(hex[0] + hex[0], 16);
      const g = Number.parseInt(hex[1] + hex[1], 16);
      const b = Number.parseInt(hex[2] + hex[2], 16);
      return { r, g, b };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      return { r, g, b };
    }
  }

  const match = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) {
    return null;
  }
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

function isDarkColor(value: string): boolean {
  const rgb = parseRgbTuple(value);
  if (!rgb) {
    return true;
  }
  const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return luminance < 128;
}

export default function TerminalMonacoEditor({
  value,
  language,
  readOnly,
  onChange,
  onSave,
}: TerminalMonacoEditorProps) {
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureMonacoInitialized()
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch((err) => {
        console.warn("初始化 Monaco 失败", err);
        if (!cancelled) {
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const styles = getComputedStyle(container);
    const bg = styles.getPropertyValue("--terminal-bg").trim() || "#0b0b0b";
    const fg = styles.getPropertyValue("--terminal-fg").trim() || "#e5e7eb";

    monaco.editor.defineTheme(MONACO_THEME, {
      base: isDarkColor(bg) ? "vs-dark" : "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": bg,
        "editor.foreground": fg,
      },
    });
    monaco.editor.setTheme(MONACO_THEME);
  }, [ready]);

  const options = useMemo(() => {
    return {
      minimap: { enabled: false },
      wordWrap: "on",
      scrollBeyondLastLine: false,
      fontSize: 12,
      lineHeight: 20,
      lineNumbersMinChars: 3,
      padding: { top: 10, bottom: 10 },
      readOnly,
      cursorBlinking: "smooth",
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
    } as const;
  }, [readOnly]);

  const handleMount: OnMount = useCallback(
    (editorInstance) => {
      if (onSave) {
        registerSaveAction(editorInstance, onSave);
      }
    },
    [onSave],
  );

  const handleChange = useCallback(
    (next: string | undefined) => {
      onChange(next ?? "");
    },
    [onChange],
  );

  if (!ready) {
    return <div className="flex h-full items-center justify-center text-[12px] text-[var(--terminal-muted-fg)]">正在加载编辑器...</div>;
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <Editor
        height="100%"
        language={language}
        value={value}
        theme={MONACO_THEME}
        onMount={handleMount}
        onChange={handleChange}
        options={options}
      />
    </div>
  );
}
