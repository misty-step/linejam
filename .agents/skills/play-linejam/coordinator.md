# Coordinator Contract (Autonomous Browser-Play QA)

The Coordinator is the parent agent responsible for orchestrating multi-player
browser gameplay, managing phase progression with sparse messaging, enforcing
the room closure and join rejection verification path, persisting sanitized
evidence, and ensuring unconditional browser teardown.

## 1. Setup & Preflight

1. **Target Authority**:
   - Determine `baseUrl` from `LINEJAM_PLAY_BASE_URL` or `PLAYWRIGHT_BASE_URL`
     (default: `http://localhost:3333`).
   - **CRITICAL**: NEVER treat `NEXT_PUBLIC_CONVEX_URL` as a web target.
   - Treat only a loopback/local target as authorized by default. Before using
     shared development, preview, staging, production, or any other remote
     target, require explicit operation authority naming that target. A
     configured URL does not grant mutation authority.
2. **Generate Run ID & Directory**:
   - Format: `<timestamp>-<target>-play` (matches `^[a-zA-Z0-9._-]+$`).
   - Create evidence folder: `.qa/runs/<run-id>/`.
3. **Preflight Check**:
   - Verify `pnpm exec agent-browser --version` outputs `0.34.0`.
   - Run `pnpm exec agent-browser skills get core`.
4. **Player Scale & Session Naming**:
   - Support 2 to 6 players; default to 4 players (1 host and 3 guests).
   - Register the host as `<run-id>-host`.
   - Register guests as `<run-id>-player-1` through
     `<run-id>-player-<player-count-minus-one>`.
   - Allocate `<run-id>-verifier` only for the post-closure check.
   - Track every allocated session name for unconditional teardown.

## 2. Sparse Hub Messaging Protocol

Coordinator coordinates player subagents with sparse, lifecycle-only messages.
There is **no** per-round or per-poem messaging chatter.

```
Host -> Coordinator:       "ROOM_CREATED: <roomCode>"
Coordinator -> Guests:     "JOIN_ROOM: <roomCode>"
Guests -> Coordinator:     "READY"
Coordinator -> Host:       "ALL_READY"
Host -> Coordinator:       "GAME_COMPLETED"
Coordinator -> Host:       "CLOSE_ROOM"
Host -> Coordinator:       "ROOM_CLOSED"
Coordinator -> Verifier:   "VERIFY_CLOSED: <roomCode>"
Verifier -> Coordinator:   "JOIN_REJECTED"
Any -> Coordinator:        "BLOCKER: <sanitized description>" (only on fatal error)
```

## 3. Orchestration Lifecycle

### Phase 1: Concurrent Spawning & Lobby Assembly

1. Spawn the **Host** and all **Guest** agents concurrently in a single `tasks[]` batch.
   - Host receives role `host` and session `<run-id>-host`.
   - Guests receive role `guest`, session `<run-id>-player-N`, and wait for the room code.
2. Host navigates to `/host`, creates room, captures the 4-letter room code, and sends `ROOM_CREATED: <code>` to Coordinator.
3. Coordinator sends `JOIN_ROOM: <code>` to waiting Guests.
4. Guests navigate to `/join?code=<code>` and enter the room.
5. When in lobby, each Guest sends `READY` to Coordinator.
6. Once all Guests are ready, Coordinator sends `ALL_READY` to Host.
7. Host clicks the **Start Game** button.

### Phase 2: Autonomous 9-Round Gameplay & Reveal

1. All players autonomously play Rounds 1 through 9 matching target word counts `[1, 2, 3, 4, 5, 4, 3, 2, 1]`.
2. Players wait semantically for UI state transitions (writing screen mounting, word slots, round advance).
3. Upon Round 9 completion, the game enters Reveal Phase. Players read their assigned poems in reading circle order until all poems are revealed.
4. When the reveal phase is complete and the recap hub renders, Host sends `GAME_COMPLETED` to Coordinator.

### Phase 3: Room Closure & Rejection Verification

1. Coordinator sends `CLOSE_ROOM` to Host.
2. Host clicks **Back to Lobby** on the recap hub.
3. Room transitions back to the Lobby.
4. Host clicks **Close room** in the Lobby and sends `ROOM_CLOSED` to Coordinator.
5. Coordinator spawns or signals the **Verifier** agent in a fresh session (`<run-id>-verifier`).
6. Verifier navigates to `/join`, inputs the closed room code, and attempts to enter.
7. Verifier confirms join is rejected (error alert displayed, URL stays on `/join`) and reports `JOIN_REJECTED`.

## 4. Execution Bounds & Error Policy

- **Global Execution Bound**: 15 minutes for gameplay, closure, verification,
  and cleanup.
- **Semantic Waits**: Use UI state indicators such as element presence, URL
  navigation, and form readiness. Do not poll with fixed sleeps.
- **Error Policy**: Record benign console warnings without failing the run.
  Fail only on an observable functional blocker such as failed navigation,
  uncaught page failure, rejected valid interaction, or expired semantic wait.

## 5. Unconditional Session Teardown

The Coordinator **MUST** close each tracked session in a `finally` path, even
after failure or interruption. Invoke this command once for every allocated
session; do not rely on `close --all`, which could terminate another run:

```bash
pnpm exec agent-browser --session <session-name> close
```

Then inspect `pnpm exec agent-browser session list`. Set
`verification.allSessionsCleanedUp: true` only when no run-owned session
remains. Set `verification.roomClosed: true` only after the host confirms
closure, and set `verification.closedRoomJoinRejected: true` only after the
fresh verifier observes rejection.

## 6. Result Aggregation & Evidence

1. Format aggregate output according to
   `skill://play-linejam/result.schema.json`.
2. Save it to `.qa/runs/<run-id>/result.json`.
3. Never put room codes, guest tokens, or poem text in structured evidence.
4. Keep screenshots and video private. Inspect each retained artifact for
   credentials and unrelated user data. An artifact that exposes the room code
   is not safe to retain until the host closes that room.
