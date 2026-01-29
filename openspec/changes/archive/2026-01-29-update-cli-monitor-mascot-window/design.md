# Design Notes: Mascot-style CLI monitor

## Goals
- Keep monitor functionality intact while making interaction feel like a desktop pet.
- Default to a cute slime mascot that can be replaced easily.
- Keep click-to-expand predictable and minimal.

## Layout
- **Collapsed**: Slime mascot centered near the bottom with a small status badge.
- **Expanded**: A speech-bubble panel appears above the mascot, containing the existing session list and actions.

## Interaction
- Click the mascot to toggle expanded/collapsed.
- Drag handle remains available (non-interactive area) to move the floating window.
- Respect reduced-motion preferences for animations.

## Window Behavior
- Transparent window with no decorations.
- Small size when collapsed; larger size when expanded.
- Maintain always-on-top and cross-workspace behavior on macOS.
