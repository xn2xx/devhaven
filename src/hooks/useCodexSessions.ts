import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import type { CodexSessionSummary } from "../models/codex";
import { CODEX_SESSIONS_EVENT, listCodexSessions } from "../services/codex";

const REFRESH_INTERVAL_MS = 5000;

export type CodexSessionStore = {
  sessions: CodexSessionSummary[];
  isLoading: boolean;
  error: string | null;
};

/** 监听 Codex CLI 会话更新，并保留低频轮询兜底。 */
export function useCodexSessions(): CodexSessionStore {
  const [sessions, setSessions] = useState<CodexSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    let unlisten: (() => void) | null = null;

    const load = async () => {
      try {
        const result = await listCodexSessions();
        if (canceled) {
          return;
        }
        setSessions(result);
        setError(null);
      } catch (err) {
        if (canceled) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!canceled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    void listen<CodexSessionSummary[]>(CODEX_SESSIONS_EVENT, (event) => {
      if (canceled) {
        return;
      }
      setSessions(event.payload ?? []);
      setError(null);
      setIsLoading(false);
    })
      .then((stop) => {
        if (canceled) {
          stop();
          return;
        }
        unlisten = stop;
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
      unlisten?.();
    };
  }, []);

  return { sessions, isLoading, error };
}
