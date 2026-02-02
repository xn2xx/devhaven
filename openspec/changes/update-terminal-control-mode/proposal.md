# Change: Disable tmux control mode by default

## Why
Users spend too much time dealing with tmux control mode (-C) quirks. The workspace terminal should use a plain command-line mode by default, while still allowing opt-in control mode when needed.

## What Changes
- Add a settings toggle to enable/disable tmux control mode for workspace terminals.
- Default the toggle to disabled (raw tmux client mode).
- When disabled, attach to tmux sessions in standard client mode (non -C) while preserving window list and split actions.
- Keep control mode behavior available behind the toggle for users who need the current multi-pane UI.

## Impact
- Affected specs: terminal-workspace
- Affected code: settings model/state, Settings modal, terminal workspace hook, tmux control client spawning
