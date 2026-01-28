import { useEffect, useState } from "react";

import type { CodexSessionSummary } from "../models/codex";
import { listCodexSessions } from "../services/codex";

const REFRESH_INTERVAL_MS = 2000;

export type CodexSessionStore = {
  sessions: CodexSessionSummary[];
  isLoading: boolean;
  error: string | null;
};

/** 轮询 Codex CLI 会话列表。 */
export function useCodexSessions(): CodexSessionStore {
  const [sessions, setSessions] = useState<CodexSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

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

    return () => {
      canceled = true;
      window.clearInterval(timer);
    };
  }, []);

  return { sessions, isLoading, error };
}
