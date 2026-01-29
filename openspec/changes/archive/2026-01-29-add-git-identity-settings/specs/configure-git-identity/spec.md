## ADDED Requirements
### Requirement: Configure git identities for heatmap
The system SHALL allow users to configure multiple git identities (name and email) used to filter heatmap statistics.

#### Scenario: Configure multiple identities
- **WHEN** the user adds one or more identities in settings
- **THEN** the identities are saved and used for git daily aggregation

#### Scenario: No identities configured
- **WHEN** the user has no identities configured
- **THEN** git daily aggregation includes all commits
