import type { WorkspaceSession } from "../models/terminal";
import TabBar from "./TabBar";
import TerminalPanel from "./TerminalPanel";

export type WorkspaceViewProps = {
  sessions: WorkspaceSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onExitWorkspace: () => void;
  terminalUseWebglRenderer: boolean;
};

/** 开发模式主视图。 */
export default function WorkspaceView({
  sessions,
  activeSessionId,
  onSelectSession,
  onCloseSession,
  onExitWorkspace,
  terminalUseWebglRenderer,
}: WorkspaceViewProps) {
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;

  return (
    <div className="workspace-root">
      <TabBar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={onSelectSession}
        onCloseSession={onCloseSession}
        onExitWorkspace={onExitWorkspace}
      />
      <TerminalPanel
        sessions={sessions}
        activeSession={activeSession}
        terminalUseWebglRenderer={terminalUseWebglRenderer}
      />
    </div>
  );
}
