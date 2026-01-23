## Context
Heatmap data is derived from per-project git daily stats. The current collector does not filter by author identity, causing the heatmap to include commits from other users.

## Goals / Non-Goals
- Goals:
  - Allow configuring multiple git identities (name + email) in settings
  - Filter git log aggregation by configured identities
  - Recompute cached git daily stats when identity settings change
- Non-Goals:
  - No changes to git repository discovery
  - No server-side data sync

## Decisions
- Decision: Store git identities in app state settings and include a derived signature for cache invalidation.
- Decision: Pass identities to the Tauri command and apply filters in Rust using git log --author.
- Alternatives considered: Filter in JS after collecting all commits (rejected due to higher processing overhead).

## Risks / Trade-offs
- Filtering by multiple identities may slightly increase git log cost due to OR regex, but keeps data accurate.

## Migration Plan
- Add default empty identity list to settings
- If identity list changes, recompute git daily stats for git projects

## Open Questions
- Should identity matching support partial email/name or exact matches only?
