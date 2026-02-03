## ADDED Requirements

### Requirement: Project Script Configuration
The system SHALL allow users to configure per-project scripts with a name, a start command, and an optional stop command, and persist them with the project data.

#### Scenario: Save script configuration
- **WHEN** a user adds or edits a script in the project detail panel
- **THEN** the script list is saved and restored on next load

### Requirement: Script Run In Workspace
The system SHALL run a script inside the built-in tmux workspace, executing in the project directory.

#### Scenario: Run script from detail panel
- **WHEN** the user clicks Run on a script
- **THEN** the app enters or creates the project workspace and runs the start command after changing to the project path

### Requirement: Script Stop Behavior
The system SHALL stop a running script by sending the configured stop command, or by sending Ctrl+C when no stop command is configured.

#### Scenario: Stop without custom command
- **WHEN** the user clicks Stop on a script that has no stop command
- **THEN** the app sends Ctrl+C to the last known pane running the script

### Requirement: VSCode-Style UI Entry
The system SHALL present a VSCode-style task control in the project detail panel, and expose up to two quick-run buttons on the project card.

#### Scenario: Quick run buttons
- **WHEN** a project has configured scripts
- **THEN** the first one or two scripts appear as quick Run buttons on the project card
