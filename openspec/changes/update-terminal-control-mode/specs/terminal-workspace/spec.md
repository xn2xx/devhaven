## ADDED Requirements
### Requirement: Tmux control mode toggle
The system SHALL provide a setting to enable or disable tmux control mode for workspace terminals.
The default value SHALL be disabled.

#### Scenario: Default is raw mode
- **WHEN** the user opens the app with default settings
- **THEN** workspace terminals start in raw tmux client mode (non-control)

#### Scenario: User enables control mode
- **WHEN** the user enables the control mode toggle and opens a workspace terminal
- **THEN** the terminal uses tmux control mode behavior

### Requirement: Raw tmux client mode behavior
When control mode is disabled, the system SHALL attach to tmux sessions using standard client mode (non -C).
The system SHALL keep window list and split actions available in the workspace UI.

#### Scenario: Split in raw mode
- **WHEN** control mode is disabled and the user triggers a split action
- **THEN** the active tmux session is split and the terminal view reflects the new layout

#### Scenario: Window list in raw mode
- **WHEN** control mode is disabled and the user opens the window list
- **THEN** the list reflects current tmux windows from the session

### Requirement: Raw mode renders a single terminal surface
When control mode is disabled, the workspace terminal SHALL render a single terminal surface for the active session.
Per-pane overlays and drag-resize controls SHALL be disabled in raw mode.

#### Scenario: Raw mode UI constraints
- **WHEN** control mode is disabled
- **THEN** the workspace shows a single terminal surface without pane overlays or drag handles
