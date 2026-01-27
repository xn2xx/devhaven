## Context
The current tmux control client spawns `tmux -CC` but only parses `%output` and a few notifications. Most tmux operations are executed via the tmux CLI, which can diverge from control-mode state and timing. We need a single, consistent control channel.

## Goals / Non-Goals
- Goals:
  - Track control-mode response blocks (`%begin/%end/%error`) and maintain command state.
  - Parse the full set of important control notifications and emit structured events.
  - Prefer control-channel commands with CLI fallback for unsupported cases.
  - Recover cleanly after reconnect or partial line reads.
- Non-Goals:
  - Replacing xterm.js or changing the renderer.
  - Implementing a full iTerm2-like UI layer.

## Approach
- Implement a control-mode state machine: DISCONNECTED, CONNECTING, RECOVERY, IDLE, IN_RESPONSE, EXITING.
- Add a command queue that sends one control command at a time and resolves it on matching `%end/%error`.
- Expand the line parser to handle `%begin/%end/%error/%output/%layout-change/%window-*/%session-*` and `%exit`.
- Add recovery behavior to ignore the first line after reconnect unless it starts with `%begin` or `%exit`.
- Keep CLI as a fallback when control-channel commands fail or are unsupported.

## Event Model
- Output events: { session_id, pane_id, data }
- State events: { kind, session_name?, window_id? }
- Command events (internal): begin/end/error for command tracking

## Error Handling
- Preserve partial UTF-8 sequences while buffering.
- Time out stuck commands and force a reconnect.
- If control channel dies, notify clients and fall back to CLI where safe.
