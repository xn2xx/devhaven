import type { CodexSessionView } from "../models/codex";

export type CodexProjectStatus = {
  runningCount: number;
  lastActivityAt: number;
};

/**
 * 将 Codex 会话聚合成“项目级”运行状态。
 * - 只统计 `isRunning=true` 且能匹配到 `projectId` 的会话
 * - lastActivityAt 取该项目下运行中会话的最大值
 */
export function buildCodexProjectStatusById(
  sessions: CodexSessionView[],
): Record<string, CodexProjectStatus> {
  const result: Record<string, CodexProjectStatus> = {};

  for (const session of sessions) {
    if (!session.isRunning || !session.projectId) {
      continue;
    }
    const existing = result[session.projectId];
    if (!existing) {
      result[session.projectId] = {
        runningCount: 1,
        lastActivityAt: session.lastActivityAt ?? 0,
      };
      continue;
    }
    existing.runningCount += 1;
    if ((session.lastActivityAt ?? 0) > existing.lastActivityAt) {
      existing.lastActivityAt = session.lastActivityAt ?? 0;
    }
  }

  return result;
}

