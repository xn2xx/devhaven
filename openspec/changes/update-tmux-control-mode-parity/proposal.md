# Change: Update tmux -CC control mode parity

## Why
The current tmux control client only parses a subset of control-mode lines and sends most commands via the tmux CLI, which can cause state drift and inconsistent behavior. Aligning the control client with tmux -CC semantics reduces desync and centralizes control flow.

## What Changes
- Add a control-mode state machine with response block tracking and recovery behavior.
- Route core tmux operations through the control channel with CLI fallback.
- Emit structured control-mode events for outputs and command lifecycle.

## Impact
- Affected code: src-tauri/src/terminal.rs, src/hooks/useTmuxWorkspace.ts (if event handling changes), src/services/terminal.ts (if new events are surfaced)
- New capability spec: tmux-control-mode
