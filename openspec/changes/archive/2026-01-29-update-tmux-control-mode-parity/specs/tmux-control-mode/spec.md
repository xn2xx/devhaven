## ADDED Requirements

### Requirement: Control-mode line parsing
The system SHALL parse all tmux `-CC` control-mode notifications defined by tmux(1) and emit structured events.

#### Scenario: Emit output event for %output
- **WHEN** a control line with prefix `%output` is received
- **THEN** the system emits an output event containing the decoded payload and pane id

#### Scenario: Emit output event for %extended-output
- **WHEN** a control line with prefix `%extended-output` is received
- **THEN** the system emits an output event containing the decoded payload and pane id

#### Scenario: Emit state change event for layout, window, session, client, and pane events
- **WHEN** a control line with prefix `%layout-change`, `%window-*`, `%session-*`, `%client-*`, or `%pane-mode-changed` is received
- **THEN** the system emits a state event describing the change with parsed identifiers and names

#### Scenario: Emit state change event for messages and errors
- **WHEN** a control line with prefix `%message` or `%config-error` is received
- **THEN** the system emits a state event containing the message text

#### Scenario: Emit state change event for pause/continue and paste buffer updates
- **WHEN** a control line with prefix `%pause`, `%continue`, `%paste-buffer-changed`, or `%paste-buffer-deleted` is received
- **THEN** the system emits a state event with the related pane id or buffer name

#### Scenario: Emit state change event for subscription updates
- **WHEN** a control line with prefix `%subscription-changed` is received
- **THEN** the system emits a state event containing the subscription name, value, and related identifiers

#### Scenario: Emit state change event for exit with reason
- **WHEN** a control line with prefix `%exit` is received with an optional reason
- **THEN** the system emits a state event containing the reason (if present) and marks the control channel as exiting

### Requirement: Response block tracking
The system SHALL track command response blocks delimited by `%begin` and `%end/%error`, capture response output, and associate completion with the originating command.

#### Scenario: Successful command completion
- **WHEN** a `%begin <time> <num> <flags>` is received followed by a matching `%end <time> <num> <flags>`
- **THEN** the system marks the command as successful and clears the response block

#### Scenario: Command error
- **WHEN** a `%begin <time> <num> <flags>` is received followed by a matching `%error <time> <num> <flags>`
- **THEN** the system marks the command as failed and clears the response block

#### Scenario: Capture command output
- **WHEN** lines are received between `%begin` and the matching `%end/%error`
- **THEN** the system captures the output and attaches it to the completion result

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
