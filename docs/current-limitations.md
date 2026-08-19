# Current Limitations

This page records limitations of the current implementation. It is a factual status document, not a commitment that every item will become a future feature.

## Gameplay

- The selected time controls are stored with the invite, but clocks are not implemented.
- Draw claims for threefold repetition and the fifty-move rule are not implemented; automatic draw results are supported.
- There is no rematch, resign, draw offer, chat, spectator mode, or move-history review UI.
- The database stores the full accepted move history, but the current API exposes only `lastMove`.

## Synchronization

- Match updates use authenticated WebSocket snapshots with two-second HTTP polling as a recovery mechanism.
- WebSocket clients are tracked in process memory; multiple application instances do not share broadcasts.
- Stale responses are guarded by `moveCount`, but the UI is not a real-time push system.

## Identity and sessions

- There are no accounts or persistent user profiles.
- Player tokens are anonymous credentials stored in browser `localStorage`.
- Clearing browser storage removes the local session needed to reopen a match in that browser.

## Operations

- SQLite is the current persistence layer.
- The application has not been designed or validated for multi-instance production deployment.
- No deployment configuration is provided.
- There is no formal versioned migration or rollback system; startup uses lightweight additive schema backfills.
