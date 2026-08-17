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
   - Canonicalize `baseUrl` to its URL origin. Reject credentials, paths,
     queries, and fragments.
   - Format the UTC timestamp as `YYYYMMDDTHHmmssZ`.
   - Convert the origin to lowercase, replace each non-alphanumeric run with
     `-`, and trim leading or trailing `-` to form `<target-slug>`.
   - Generate 128 random bits independently for this run and encode them as
     exactly 32 lowercase hexadecimal characters in `<run-entropy>`. Do not
     derive this value from the timestamp, process ID, target, or player names.
   - Set the run ID to
     `<timestamp>-<target-slug>-<run-entropy>-play`; it must match
     `^[0-9]{8}T[0-9]{6}Z-[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{32}-play$`.
     The entropy component keeps evidence directories and browser session names
     isolated when multiple coordinators start during the same second.
   - Create evidence folder: `.qa/runs/<run-id>/`.
3. **Preflight Check**:
   - Verify `pnpm exec agent-browser --version` outputs `0.27.0`.
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

```text
Host -> Coordinator:       "ROOM_CREATED: <roomCode>"
Coordinator -> Guests:     "JOIN_ROOM: <roomCode>"
Guests -> Coordinator:     "READY"
Coordinator -> Host:       "ALL_READY"
Host -> Coordinator:       "GAME_COMPLETED"
Coordinator -> Host:       "CLOSE_ROOM"
Coordinator -> Host:       "CLEANUP_ROOM" (failure-only finally path)
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
3. Upon Round 9 completion, the game enters Reveal Phase. Players read their
   assigned poems in reading circle order until all poems are revealed.
4. When the recap hub renders, Host saves a full-page screenshot directly to
   `.qa/runs/<run-id>/artifact-0001.png`, confirms the file exists, then sends
   `GAME_COMPLETED` to Coordinator. Capture failure fails the run; a passed run
   must not synthesize or omit this artifact.

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

## 5. Unconditional Room and Session Cleanup

The Coordinator **MUST** run this ordered `finally` path after every run,
including a blocker, timeout, or interrupted gameplay:

1. If a room may exist — the Coordinator tracked a room code or an allocated
   host session — but `ROOM_CLOSED` was not received, send `CLEANUP_ROOM` and
   use the tracked host session to return the active game to the lobby and
   close the room. If the Host agent cannot respond, the Coordinator drives
   that same session directly. Follow the failure cleanup path in `player.md`;
   bound the attempt and never invent a closure receipt.
2. After confirmed closure, allocate a fresh `<run-id>-verifier` session if
   needed and perform `VERIFY_CLOSED`. A failed gameplay run still attempts this
   join-rejection check.
3. Record `room_closure_failed` when closure cannot be confirmed, or
   `join_rejection_failed` when a closed room accepts the verifier or the check
   cannot complete. Such a run cannot pass.
4. Only after those attempts, close every tracked browser session. Invoke this
   command once per allocated session; do not use `close --all`, which could
   terminate another run:

   ```bash
   pnpm exec agent-browser --session <session-name> close
   ```

5. Inspect `pnpm exec agent-browser session list`.

Set `verification.allSessionsCleanedUp: true` only when no run-owned session
remains. Set `verification.roomClosed: true` only after the host session
confirms closure, and set `verification.closedRoomJoinRejected: true` only
after the fresh verifier observes rejection.

## 6. Result Aggregation & Evidence

1. After room closure, inspect
   `.qa/runs/<run-id>/artifact-0001.png` and every other retained screenshot,
   video, trace, or log for credentials, room codes, and unrelated user data.
   Delete unsafe artifacts; a missing safe screenshot means the run cannot pass.
   Use opaque, sequential names such as `artifact-0001.png` for every retained
   file; never retain a UI-derived filename.
2. Create a candidate matching `skill://play-linejam/result.schema.json` in a
   temporary file outside `.qa/`. Use only the schema's fixed error codes;
   never copy UI or console text into structured evidence.
3. Validate and persist it through the repository-owned writer:

   ```bash
   pnpm qa:play-linejam:result < /tmp/<run-id>-candidate.json
   ```

   The writer rejects invalid pass claims, pass receipts without screenshot or
   video evidence, non-origin targets, foreign session or artifact paths,
   missing or non-regular artifact files, uninspected artifacts, and free-form
   errors. It writes `.qa/runs/<run-id>/result.json` exactly once.

4. Delete the temporary candidate after the writer exits.
