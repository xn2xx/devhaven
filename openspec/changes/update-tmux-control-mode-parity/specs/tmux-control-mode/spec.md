## ADDED Requirements

### Requirement: Control-mode line parsing
The system SHALL parse tmux `-CC` control-mode lines and emit structured events for output and state notifications.

#### Scenario: Emit output event
- **WHEN** a control line with prefix `%output` is received
- **THEN** the system emits an output event containing the decoded payload and pane id

#### Scenario: Emit state change event
- **WHEN** a control line with prefix `%layout-change` or `%window-*` is received
- **THEN** the system emits a state event describing the change

### Requirement: Response block tracking
The system SHALL track command response blocks delimited by `%begin` and `%end/%error`, and associate completion with the originating command.

#### Scenario: Successful command completion
- **WHEN** a `%begin <id> <num>` is received followed by a matching `%end <id> <num>`
- **THEN** the system marks the command as successful and clears the response block

#### Scenario: Command error
- **WHEN** a `%begin <id> <num>` is received followed by a matching `%error <id> <num>`
- **THEN** the system marks the command as failed and clears the response block

### Requirement: Control-channel command routing
The system SHALL send core tmux operations through the control channel, with CLI fallback on control-channel failure.

#### Scenario: Split pane via control channel
- **WHEN** a pane split is requested
- **THEN** the system sends the split command through the control channel

#### Scenario: Fallback to CLI
- **WHEN** the control channel is unavailable or fails to send a command
- **THEN** the system executes the equivalent tmux CLI command

### Requirement: Recovery behavior
The system SHALL recover from reconnects by safely re-entering control-mode parsing without corrupting state.

#### Scenario: Ignore partial line after reconnect
- **WHEN** the control channel reconnects and the first line is not a `%begin` or `%exit`
- **THEN** the system ignores the line and resumes parsing subsequent lines
