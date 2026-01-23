import { useEffect, useRef } from "react";

import { listen } from "@tauri-apps/api/event";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { Terminal } from "xterm";

import { getTerminalOutputEventName, writeToTerminal } from "../services/terminal";
import "xterm/css/xterm.css";

type XtermTerminalProps = {
  sessionId: string;
};

/** xterm.js 终端渲染器。 */
export default function XtermTerminal({ sessionId }: XtermTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const terminal = new Terminal({
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
      fontSize: 12,
      cursorBlink: true,
      theme: {
        background: "#101114",
        foreground: "rgba(255, 255, 255, 0.9)",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(container);
    requestAnimationFrame(() => fitAddon.fit());

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(container);

    const disposeData = terminal.onData((data) => {
      void writeToTerminal(sessionId, data);
    });

    let disposed = false;
    let unlisten: (() => void) | null = null;
    void listen<string>(getTerminalOutputEventName(sessionId), (event) => {
      terminal.write(event.payload);
    }).then((unlistenFn) => {
      if (disposed) {
        unlistenFn();
        return;
      }
      unlisten = unlistenFn;
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      disposeData.dispose();
      terminal.dispose();
      if (unlisten) {
        unlisten();
      }
    };
  }, [sessionId]);

  return <div ref={containerRef} className="terminal-container" />;
}
