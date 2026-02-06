import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

import {
  applyTerminalMonacoTheme,
  ensureTerminalMonacoInitialized,
  getTerminalMonacoBaseOptions,
  TERMINAL_MONACO_THEME,
} from "./terminalMonaco";

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
    ensureTerminalMonacoInitialized()
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
    applyTerminalMonacoTheme(container);
  }, [ready]);

  const options = useMemo(() => {
    return getTerminalMonacoBaseOptions(readOnly);
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
        theme={TERMINAL_MONACO_THEME}
        onMount={handleMount}
        onChange={handleChange}
        options={options}
      />
    </div>
  );
}
