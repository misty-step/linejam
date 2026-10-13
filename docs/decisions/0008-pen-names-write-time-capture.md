# 0008: Room pen names via write-time capture

- **Status:** accepted
- **Date:** 2026-10-13 (migration; original record undated)
- **Primitives:** poem-game
- **Powder:** none recorded

## Context

One identity can use different names across rooms and rejoin under a new name. A mutable global profile or current room membership cannot prove the byline used for an older contribution.

## Decision

Normalize room creation/join names server-side with `normalizeDisplayName`. Resolve the authenticated writer’s membership through `by_room_user`, never another room or the global profile. Capture that room membership pen name as lines.authorDisplayName on insertion, after game/assignment checks and the accepted-retry return. Only a new insertion requires current room membership. Reader views, poem details, public recaps (including starter names), archive/export attributions and archive collaborators prefer captured bylines; use live lookup and then `Unknown` only for legacy lines without snapshots. Do not rewrite snapshots from current profiles or memberships.

## Consequences

Retries preserve text and byline; roster and reader names remain room roles. The snapshot field remains optional for legacy data. Incorrect snapshots from the former profile-based writer also remain unchanged. Separate pen-name storage or user version history adds unnecessary complexity. Snapshots duplicate names, and corrections require explicit room/line provenance and separately authorized data work. Revisit if that provenance and correction authority are available.
