# Change: Make the CLI monitor window a mascot-style floating pet

## Why
The current floating CLI monitor window feels rigid and utilitarian. The user wants a desktop-pet style interaction to make the monitor feel lighter and more playful without losing quick access to session status.

## What Changes
- Convert the CLI monitor window into a mascot-style UI with a slime pet as the primary affordance.
- Use click-to-expand behavior that reveals the session list in a speech-bubble panel.
- Enable transparent window styling for the monitor window.
- Provide small/large window sizes for collapsed and expanded states (toggle on click).
- Add a CC0-licensed slime mascot asset under `public/mascot/` to make replacement easy.
- Update monitor window permissions if new window APIs (e.g., set size) are required.

## Impact
- Affected specs: `cli-monitor-window` (new/updated capability requirements).
- Affected code:
  - `src/components/MonitorWindow.tsx`
  - `src/App.css`
  - `src/App.tsx`
  - `src/services/monitorWindow.ts`
  - `src-tauri/tauri.conf.json`
  - `src-tauri/capabilities/monitor.json`
  - `public/mascot/*`
