## ADDED Requirements

### Requirement: Mascot-style monitor UI
The CLI monitor window SHALL present a mascot-style interface with a default slime mascot and a compact status badge.

#### Scenario: Mascot view on open
- **WHEN** the monitor window is opened
- **THEN** the mascot view is visible with a status badge showing session count or sync state

### Requirement: Click-to-expand session panel
The monitor window SHALL toggle a speech-bubble panel containing the session list when the user clicks the mascot.

#### Scenario: Expand and collapse
- **WHEN** the user clicks the mascot
- **THEN** the session panel toggles between expanded and collapsed states

### Requirement: Transparent floating window
The monitor window SHALL render with a transparent background to avoid a rigid window frame feel.

#### Scenario: Transparent appearance
- **WHEN** the monitor window is displayed
- **THEN** the window background is transparent and only the mascot/panel are visible

### Requirement: Collapsed and expanded sizes
The monitor window SHALL support small (collapsed) and large (expanded) sizes to reinforce the mascot interaction.

#### Scenario: Size change on toggle
- **WHEN** the user expands or collapses the mascot
- **THEN** the window resizes to the corresponding collapsed or expanded size

### Requirement: Replaceable mascot asset
The default mascot asset SHALL live under `public/mascot/` to allow easy replacement.

#### Scenario: Asset customization
- **WHEN** a user replaces the asset file in `public/mascot/`
- **THEN** the mascot appearance updates without code changes
