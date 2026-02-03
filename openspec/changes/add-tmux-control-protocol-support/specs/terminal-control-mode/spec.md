## ADDED Requirements
### Requirement: Control mode flow control flags
The system SHALL configure tmux control mode clients with refresh-client -f to enable flow control (pause-after).
The system SHALL apply the configured flags when attaching a control mode client.

#### Scenario: Flow control flags are applied
- **WHEN** a control mode client is created
- **THEN** the client receives refresh-client -f with pause-after enabled

### Requirement: Pane-level flow control actions
The system SHALL support refresh-client -A for pane-level flow control actions (on/off/pause/continue).
The system SHALL automatically send a continue action after receiving %pause once output is safe to resume.

#### Scenario: Output resumes after pause
- **WHEN** tmux emits %pause for a pane
- **THEN** the client issues refresh-client -A <pane>:continue and output resumes

### Requirement: Control mode subscriptions
The system SHALL support refresh-client -B to add or remove subscriptions for control mode clients.
The system SHALL forward %subscription-changed notifications with the subscription metadata and value.

#### Scenario: Subscription update is delivered
- **WHEN** a subscription is added via refresh-client -B
- **THEN** changes trigger %subscription-changed and the notification is delivered to the frontend
