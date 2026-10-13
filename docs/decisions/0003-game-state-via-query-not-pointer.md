# 0003: Game state via query, not mutable pointer

- **Status:** accepted
- **Date:** 2026-10-13 (migration; original record undated)
- **Primitives:** poem-game
- **Powder:** none recorded

## Context

Using room.currentGameId as active-game authority let completion clear the pointer while Player B’s first final-round submission was still in flight (issue #64), causing “Game not found” failures.

## Decision

Query game state through the room/status index and use immutable poem.gameId and assignment references for submissions. Do not make a mutable room pointer the authority. Return silently for an already accepted duplicate. Allow late submissions with `lineIndex <= game.currentRound`. Accept any final-round (round 8) submission even if the game just became `COMPLETED`, including a first submission still in flight.

## Consequences

Use `games.by_room_status`: `getActiveGame` returns the `IN_PROGRESS` game or null, `getCompletedGame` returns the most recent `COMPLETED` game, and `deriveRoomStatus` derives room state (helpers in [`convex/lib/room.ts`](../../convex/lib/room.ts)). Indexed queries add a read per mutation. `room.currentGameId` remains for backward compatibility and `room.status` is semi-redundant. Revisit if the lifecycle or indexing contract changes so that queried state cannot reliably resolve the applicable game.
