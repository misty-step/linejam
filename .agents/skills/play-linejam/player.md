# Player Contract (Autonomous Browser-Play QA)

The Player Contract defines the exact UI actions, CLI commands, word-count rules,
and state assertions for agents executing browser interactions via `agent-browser`.

Every player command **MUST** include `--session <session-name>` to preserve
session isolation.

## 1. Runtime Preflight

Before initiating browser commands:

```bash
pnpm exec agent-browser --version
pnpm exec agent-browser skills get core
```

Confirm the CLI version is `0.27.0`.

After each session's initial `open`, set the product-priority mobile viewport
before taking its first snapshot:

```bash
pnpm exec agent-browser --session <session-name> set viewport 390 844
```

Before every action after navigation, take a fresh interactive snapshot:

```bash
pnpm exec agent-browser --session <session-name> snapshot -i
```

Do not reuse element references after navigation or a visible state transition.
Never join any room except the coordinator-provided code. Never publish, share,
save, or favorite a synthetic poem.

## 2. Host Execution Flow

Session name: `<run-id>-host`

### Step 1: Create Room

1. Open host page:
   ```bash
   pnpm exec agent-browser --session <run-id>-host open <baseUrl>/host
   ```
2. Fill host display name:
   ```bash
   pnpm exec agent-browser --session <run-id>-host find testid host-name-input fill "Host Agent"
   ```
3. Submit form:
   ```bash
   pnpm exec agent-browser --session <run-id>-host find testid host-create-room-button click
   ```
4. Wait for room creation and read the resulting URL:
   ```bash
   pnpm exec agent-browser --session <run-id>-host wait --url "**/room/*"
   pnpm exec agent-browser --session <run-id>-host get url
   ```
5. Extract the terminal 4-letter room code and send
   `ROOM_CREATED: <code>` to the Coordinator.

### Step 2: Lobby Assembly & Start Game

1. Wait in lobby for Guests to join.
2. When Coordinator signals `ALL_READY`, start the game:
   ```bash
   pnpm exec agent-browser --session <run-id>-host find testid lobby-start-game-button click
   ```
3. Wait for writing UI:
   ```bash
   pnpm exec agent-browser --session <run-id>-host wait '[data-testid="writing-phase"]'
   ```

## 3. Guest Execution Flow

Session names: `<run-id>-player-1`, `<run-id>-player-2`, ...

### Step 1: Join Room

1. Receive `JOIN_ROOM: <roomCode>` from Coordinator.
2. Open join page:
   ```bash
   pnpm exec agent-browser --session <session-name> open "<baseUrl>/join?code=<roomCode>"
   ```
3. Fill room code (if not prefilled) and use a seat-specific display name:
   ```bash
   pnpm exec agent-browser --session <session-name> find testid join-room-code-input fill "<roomCode>"
   pnpm exec agent-browser --session <session-name> find testid join-name-input fill "Guest Player <seat>"
   ```
4. Enter the room:
   ```bash
   pnpm exec agent-browser --session <session-name> find testid join-room-button click
   ```
5. Wait for the lobby:
   ```bash
   pnpm exec agent-browser --session <session-name> wait '[data-testid="lobby-waiting-for-host-button"]'
   ```
6. Send `READY` to the Coordinator.

## 4. Nine-Round Gameplay Loop

All players execute Rounds 1 through 9 with target word counts
`[1, 2, 3, 4, 5, 4, 3, 2, 1]`. For each turn, compose a new harmless synthetic
line that responds only to the prior line visible in the UI and has the exact
target word count. Do not reuse stock lines from this skill.

### Round Submission Steps:

1. Wait for `WritingScreen` to mount and record its integer `data-round` as
   `<submitted-round>`:
   ```bash
   pnpm exec agent-browser --session <session-name> wait '[data-testid="writing-phase"]'
   ```
2. Inspect the visible word-slot count, then type text with exactly that many
   words:
   ```bash
   pnpm exec agent-browser --session <session-name> find testid writing-line-input fill "<lineText>"
   ```
3. Seal the line:
   ```bash
   pnpm exec agent-browser --session <session-name> find testid writing-submit-line-button click
   ```
4. Wait for any valid post-submit state: `waiting-phase`, a `writing-phase`
   whose numeric `data-round` is exactly `<submitted-round> + 1`, or — only
   after submitting Round 9 — `reveal-phase`:
   ```bash
   pnpm exec agent-browser --session <session-name> wait --fn "document.querySelector('[data-testid=\"waiting-phase\"]') !== null || Number(document.querySelector('[data-testid=\"writing-phase\"]')?.getAttribute('data-round')) === <submitted-round> + 1 || (<submitted-round> === 9 && document.querySelector('[data-testid=\"reveal-phase\"]') !== null)"
   ```
5. Branch on the observed state. `data-round` of `<submitted-round> + 1` means
   this player was the last submitter and the server advanced directly to its
   next writing turn; submit that new round without waiting for
   `waiting-phase`. A different `data-round` means the round skipped or reset;
   treat it as a blocker instead of continuing. From `waiting-phase`, wait
   semantically for a `writing-phase` at exactly `<submitted-round> + 1`, or —
   only after Round 9 — `reveal-phase`. Enter reveal only after submitting
   Round 9. Repeat through Round 9.

## 5. Reveal Phase Flow

After Round 9, wait for the reveal phase:

```bash
pnpm exec agent-browser --session <session-name> wait '[data-testid="reveal-phase"]'
```

Follow the reading-circle order. When this player becomes the active reader:

```bash
pnpm exec agent-browser --session <session-name> find testid reveal-poem-button click
pnpm exec agent-browser --session <session-name> find testid poem-done-button click
```

Continue until the recap hub reports that every poem was read. Do not send
per-poem progress messages. When the recap hub renders, the Host captures the
successful completed-game surface before leaving it:

```bash
pnpm exec agent-browser --session <run-id>-host wait '[data-testid="session-complete"]'
pnpm exec agent-browser --session <run-id>-host screenshot --full ".qa/runs/<run-id>/artifact-0001.png"
```

The Host confirms that `.qa/runs/<run-id>/artifact-0001.png` exists, then sends
`GAME_COMPLETED`. Guests do not create a second success artifact.

## 6. Room Closure Path (Host)

1. Return to the lobby and wait for its close action:
   ```bash
   pnpm exec agent-browser --session <run-id>-host find text "Back to Lobby" click
   pnpm exec agent-browser --session <run-id>-host wait --text "Close room"
   ```
2. Close the room:
   ```bash
   pnpm exec agent-browser --session <run-id>-host find text "Close room" click
   ```
3. Confirm the room UI exits before sending `ROOM_CLOSED` to the Coordinator.

### Failure cleanup

On `CLEANUP_ROOM`, the Host performs a bounded best-effort return to the lobby:

1. Inspect the current surface. If `session-complete` is already visible,
   click **Back to Lobby** and skip to room closure.
2. If it is a writing turn, submit a valid line for that displayed word count,
   then use the same three-way post-submit branch as the normal round loop.
3. If a writing phase one round higher appears, repeat the bounded valid-line
   submission. On `waiting-phase`, click **End game**, click the confirmation
   **End game**, and wait for the lobby. This abandons the incomplete game
   without revealing partial poems.
4. If `reveal-phase` appears, finish the bounded reading-circle actions until
   `session-complete`, then click **Back to Lobby**.
5. In the lobby, click **Close room** and confirm the room UI exits before
   sending `ROOM_CLOSED`.

If no known surface can be reached, a valid submission cannot reach the waiting
screen, game abandonment fails, or room closure cannot be observed, report a
sanitized `BLOCKER` instead of `ROOM_CLOSED`. The Coordinator records
`room_closure_failed` and still closes every run-owned browser session.

## 7. Verifier Execution Flow

Session name: `<run-id>-verifier` (fresh browser session, never previously connected)

1. Open join page:
   ```bash
   pnpm exec agent-browser --session <run-id>-verifier open "<baseUrl>/join"
   ```
2. Fill closed room code and verifier name:
   ```bash
   pnpm exec agent-browser --session <run-id>-verifier find testid join-room-code-input fill "<closedRoomCode>"
   pnpm exec agent-browser --session <run-id>-verifier find testid join-name-input fill "Verifier"
   ```
3. Attempt join:
   ```bash
   pnpm exec agent-browser --session <run-id>-verifier find testid join-room-button click
   ```
4. Wait for and inspect the rejection:
   ```bash
   pnpm exec agent-browser --session <run-id>-verifier wait '[data-testid="join-error-alert"]'
   pnpm exec agent-browser --session <run-id>-verifier find testid join-error-alert text
   pnpm exec agent-browser --session <run-id>-verifier get url
   ```
5. Confirm the error reports a closed or unavailable room and the URL did not
   enter `/room/<code>`, then send `JOIN_REJECTED`.

## 8. Player Result

After reaching the terminal state, return one sanitized player record for the
Coordinator's `skill://play-linejam/result.schema.json` aggregate. Include only
the documented fields and fixed error codes. Do not write a second manifest,
copy UI or console text, or include a room code, guest token, or poem text.

## 9. Session Cleanup

Every session must be closed before process termination:

```bash
pnpm exec agent-browser --session <session-name> close
```

On failure, capture a private screenshot before cleanup. Report only a
sanitized blocker to the Coordinator; never include the room code, guest token,
or poem text in structured results.
