# 0008: Room pen names via write-time capture

- **Status:** accepted
- **Date:** 2026-10-13 (migration; original record undated)
- **Primitives:** poem-game
- **Powder:** none recorded

## Context
One identity can use different names across rooms and rejoin under a new name. A mutable global profile or current room membership cannot prove the byline used for an older contribution.

## Decision
Capture the normalized room membership pen name as lines.authorDisplayName on insertion, after game/assignment checks and the accepted-retry return. Display captured bylines first, with live lookup only for legacy lines without snapshots. Do not rewrite snapshots from current profiles or memberships.

## Consequences
Retries preserve text and byline; roster and reader names remain room roles. Snapshots duplicate names, and corrections require explicit room/line provenance and separately authorized data work. Revisit if that provenance and correction authority are available.
