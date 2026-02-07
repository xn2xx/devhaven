import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import type { CodexAgentEvent, CodexMonitorSession, CodexMonitorSnapshot } from "../models/codex";
import {
  CODEX_MONITOR_AGENT_EVENT,
  CODEX_MONITOR_SNAPSHOT_EVENT,
  getCodexMonitorSnapshot,
} from "../services/codex";

const REFRESH_INTERVAL_MS = 5000;
const MAX_EVENTS = 80;

export type CodexMonitorStore = {
  snapshot: CodexMonitorSnapshot | null;
  sessions: CodexMonitorSession[];
  isCodexRunning: boolean;
  agentEvents: CodexAgentEvent[];
  isLoading: boolean;
  error: string | null;
};

/** 监听 Codex 监控快照和状态事件，并保留低频轮询兜底。 */
export function useCodexMonitor(): CodexMonitorStore {
  const [snapshot, setSnapshot] = useState<CodexMonitorSnapshot | null>(null);
  const [sessions, setSessions] = useState<CodexMonitorSession[]>([]);
  const [isCodexRunning, setIsCodexRunning] = useState(false);
  const [agentEvents, setAgentEvents] = useState<CodexAgentEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    let stopSnapshotListen: (() => void) | null = null;
    let stopEventListen: (() => void) | null = null;

    const applySnapshot = (next: CodexMonitorSnapshot) => {
      if (canceled) {
        return;
      }
      setSnapshot(next);
      setSessions(next.sessions ?? []);
      setIsCodexRunning(Boolean(next.isCodexRunning));
      setError(null);
      setIsLoading(false);
    };

    const load = async () => {
      try {
        const result = await getCodexMonitorSnapshot();
        applySnapshot(result);
      } catch (err) {
        if (canceled) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);

    void listen<CodexMonitorSnapshot>(CODEX_MONITOR_SNAPSHOT_EVENT, (event) => {
      if (!event.payload || canceled) {
        return;
      }
      applySnapshot(event.payload);
    })
      .then((unlisten) => {
        if (canceled) {
          unlisten();
          return;
        }
        stopSnapshotListen = unlisten;
      })
      .catch((err) => {
        if (canceled) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      });

    void listen<CodexAgentEvent>(CODEX_MONITOR_AGENT_EVENT, (event) => {
      if (canceled || !event.payload) {
        return;
      }
      setAgentEvents((prev) => {
        const next = [event.payload, ...prev];
        if (next.length > MAX_EVENTS) {
          return next.slice(0, MAX_EVENTS);
        }
        return next;
      });
    })
      .then((unlisten) => {
        if (canceled) {
          unlisten();
          return;
        }
        stopEventListen = unlisten;
      })
      .catch((err) => {
        if (canceled) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      canceled = true;
      window.clearInterval(timer);
      stopSnapshotListen?.();
      stopEventListen?.();
    };
  }, []);

  return {
    snapshot,
    sessions,
    isCodexRunning,
    agentEvents,
    isLoading,
    error,
  };
}
