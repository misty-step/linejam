# ADR-0003: Game State via Query, Not Mutable Pointer

## Status

Accepted

## Context

Early implementation used `room.currentGameId` as the source of truth for "which game is active." This created race conditions:

1. Player A submits final line, completing round 8
2. `submitLine` mutation sets `game.status = 'COMPLETED'` and `room.currentGameId = undefined`
3. Player B's submission (in flight) reads stale `room.currentGameId`
4. Player B's mutation fails with "Game not found"

Issue #64 documented this race causing sporadic submission failures.

## Decision

Apply Ousterhout's principle: **define errors out of existence**.

1. **Query game state directly** using compound index `games.by_room_status`:
   - `getActiveGame(ctx, roomId)`: returns IN_PROGRESS game or null
   - `getCompletedGame(ctx, roomId)`: returns most recent COMPLETED game
   - `deriveRoomStatus(ctx, roomId)`: derives room state from game state

2. **Use immutable references** in mutations:
   - `poem.gameId` is set at creation and never changes
   - `game.assignmentMatrix` is immutable
   - Submissions reference `poem.gameId` directly, not `room.currentGameId`

3. **Make duplicate submissions idempotent**:
   - If line already exists, silently return (no error)
   - Allow "late" submissions: `lineIndex <= game.currentRound`

4. **Accept graceful degradation for edge cases**:
   - For final round (8), accept submissions even if game just became COMPLETED

## Consequences

**Positive:**

- Eliminates race condition entirely (tested with E2E concurrent submissions)
- Cleaner code: no defensive null checks for stale pointers
- Easier reasoning: game state is always queryable, not cached

**Negative:**

- Extra query per mutation (compound index makes this ~1ms)
- `room.currentGameId` kept for backward compatibility (could be removed)
- `room.status` is now semi-redundant (derived from game state)

**Helpers Created:**

- `convex/lib/room.ts`: `getActiveGame`, `getCompletedGame`, `deriveRoomStatus`, `requireRoomByCode`
