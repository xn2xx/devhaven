# Change: Add Git identity settings for heatmap statistics

## Why
Heatmap statistics currently include all git commits, which makes the data inaccurate for users who have multiple git identities or want to filter by their own author info.

## What Changes
- Add settings UI to manage multiple git identities (name + email)
- Persist configured identities in app state
- Filter git daily aggregation by configured identities
- Refresh git daily cache when identity settings change

## Impact
- Affected specs: configure-git-identity (new)
- Affected code: settings UI, app state models, git daily collector (Rust + JS)
