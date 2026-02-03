## ADDED Requirements

### Requirement: Open per-project terminal workspace
The system SHALL open a dedicated terminal workspace window when the user double-clicks a project.

#### Scenario: Open terminal workspace
- **WHEN** the user double-clicks a project card
- **THEN** a terminal workspace window for that project is shown and focused

### Requirement: Tab and split layout
The system SHALL support multiple tabs and split panes inside a terminal workspace.

#### Scenario: Split panes
- **WHEN** the user triggers a split action
- **THEN** a new pane is created next to the active pane and the layout ratios are updated

### Requirement: Session recovery
The system SHALL restore terminal workspace layout, sessions, CWD, and scrollback buffer on reopen.

#### Scenario: Restore workspace
- **GIVEN** a project workspace was previously opened and saved
- **WHEN** the user reopens the same project terminal window
- **THEN** tabs, splits, and scrollback content are restored

### Requirement: WebGL renderer toggle
The system SHALL allow toggling WebGL rendering for terminals in settings.

#### Scenario: Disable WebGL
- **WHEN** the user disables WebGL rendering in settings
- **THEN** new terminal panes use the non-WebGL renderer
