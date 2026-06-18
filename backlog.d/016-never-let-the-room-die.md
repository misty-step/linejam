# Never let the room die: presence, turn timeout, and self-heal abandonment

Priority: P0 · Status: in-progress · Estimate: XL

## Goal

No active room can stay `IN_PROGRESS` because a human closed their tab, walked
away, or lost connectivity: every unclaimed human turn auto-fills after a
deterministic timeout, and an abandonment cron finishes any game whose humans
have all gone silent — so a room either completes or returns to a recoverable
state without a manual database fix.

## Oracle

- [x] `roomPlayers` has a `lastSeenAt` field (or equivalent presence signal)
      updated by a client heartbeat; `WaitingScreen` and the lobby render an
      "away" indicator when a player's heartbeat is stale past a threshold.
      (child 1; `convex/presence.ts`, `hooks/usePresence.ts`)
- [x] After a deterministic per-turn timeout (≤ `GHOSTWRITER_OVERTIME_MS`), any
      human-owned poem missing its line for the current round auto-commits a
      ghost line bylined `"<name> (ghost)"` — without the host tapping
      `summonGhostwriter`. (child 2; `game.fillStaleHumanTurns`)
- [x] A scheduled cron detects `IN_PROGRESS` games whose humans have all been
      stale past an abandonment threshold and finishes them: ghost-fills every
      missing line, advances rounds, and lands the room in `COMPLETED` (reveal
      still reachable). (child 3; `convex/crons.ts` + `convex/abandonment.ts`)
- [x] A room whose host has left can still be finished by the remaining
      participants or the abandonment cron; no host-only action is the sole
      path to completion. (child 4; completion path carries no host gate —
      proven by the host-departed integration cases)
- [x] `pnpm ci:prepush` green; new tests cover (a) human-disconnect
      auto-completes a poem within the timeout, (b) all-humans-leave game
      auto-finishes via cron, (c) OpenRouter total outage still completes a
      full game through safety nets, (d) host-departed room completes.
      (a–d in `tests/convex/abandonment.test.ts`, real scheduler/DB via
      convex-test; full `ci:prepush` Dagger contract is the pre-merge gate)
- [~] E2E (`tests/e2e/`) exercises a mid-game player drop end-to-end against a
  live Convex dev target and asserts the remaining player(s) reach reveal
  without a manual nudge. (spec written: `tests/e2e/mid-game-leaver.spec.ts`,
  `@slow`; run via `pnpm test:e2e:leaver`. Waits a real `AUTO_GHOST_FILL_MS`
  timeout, so it is the release-branch / operator live-stack run.)

## Verification System

- **Claim:** A room never strands in `IN_PROGRESS` due to a human abandoning a
  turn or the host leaving; the game always reaches `COMPLETED` within a
  bounded wall-clock from the last human action.
- **Falsifier:** Start a game, submit lines for all but one human poem, close
  that player's browser, and wait. If the room is still `IN_PROGRESS` after
  `abandonment_threshold + per_turn_timeout + slack`, the claim is false. Same
  for the host-only path: kill the host's client and confirm the room still
  completes.
- **Driver:** A Vitest integration case against a real Convex dev instance
  (not fully mocked scheduler/DB) that starts a game, simulates a stale
  `lastSeenAt` for one player, advances the test clock past the timeout, and
  asserts the ghost line lands and the round advances. A second case simulates
  all humans stale and asserts the cron finishes the game.
- **Grader:** The E2E mid-game-leaver scenario in `tests/e2e/` must pass
  against a live Convex dev backend. Unit/integration tests assert the timing
  invariants (timeout fires, cron runs, idempotency holds under double-fire).
- **Evidence packet:** CI green on `pnpm ci:prepush`; the new E2E run
  artifact; a manual repro transcript (start game → drop player → observe
  auto-complete) captured as a screenshot or recording.
- **Cadence:** Run on every PR touching `convex/lib/sessionLifecycle.ts`,
  `convex/ai.ts`, `convex/game.ts`, or the new presence/cron modules; re-run
  the full E2E leaver scenario on release branches.

## Notes

**Why this is P0 and ready:** Three independent swarm lanes (RuntimeReliability,
TestsVerification, ExemplarPremise) converged on the same load-bearing gap.
`applyLineLifecycleTransition` (`convex/lib/sessionLifecycle.ts:194-259`)
returns without advancing when any poem is missing a line, and only re-nudges
the AI scheduler when the missing turn belongs to an AI
(`renudgeAiIfBlocking`, lines 166-192). `leaveLobby` and `closeRoom`
(`convex/rooms.ts:240-310`) refuse to run while a game is `IN_PROGRESS`. There
is no `lastSeen`/presence field on `roomPlayers` (`convex/schema.ts:43-49`), no
disconnect handler, no turn auto-timeout, and no abandonment cron. The only
human-stall affordance is the host manually tapping `summonGhostwriter` after
90s — which fails if the host is the one who left. TestsVerification confirmed
zero coverage of mid-game leaver scenarios.

**Constraints:**

- Keep the existing manual `summonGhostwriter` path as an override; the auto
  timeout is a floor, not a replacement for host agency.
- Ghost lines stay honestly bylined `"<name> (ghost)"` — do not silently
  attribute abandoned turns to the human.
- The abandonment cron must be idempotent and safe to fire repeatedly
  (re-use the `ensureAiLine` / `commitAssignedLine` idempotency pattern in
  `convex/ai.ts`).
- Presence heartbeats must be cheap on the Convex scheduler; prefer a single
  mutation per heartbeat, throttled client-side, over WS lifecycle hooks if
  those are unavailable in the current Convex version.
- Do not break the guest-first flow: presence must work for signed-JWT guests,
  not just Clerk users.

**Open questions:**

- Should the abandonment threshold be mode-aware (shorter for `quick` than
  `classic`)? Default: one threshold, tuned to the longest reasonable party
  pause; revisit if telemetry shows false fires.
- Should host migration (promoting another participant) land here or as a
  follow-up? Default: follow-up ticket; this epic guarantees completion
  without a host, which is the correctness floor.
- Convex cron vs. scheduler `runAfter`: cron is the right primitive for the
  abandonment sweep; per-turn timeouts can use `runAfter` on round start.

## Children

1. **Presence:** add `lastSeenAt` to `roomPlayers`, client heartbeat mutation,
   "away" indicator in `WaitingScreen` and lobby.
2. **Per-turn timeout with auto ghost fill:** on round start, schedule a
   `runAfter` that ghost-fills any human poem still missing its line past
   `GHOSTWRITER_OVERTIME_MS`; re-use `commitAssignedLine` idempotency.
3. **Abandonment cron:** a Convex cron that sweeps `IN_PROGRESS` games whose
   humans are all stale past the abandonment threshold, ghost-fills missing
   lines, advances rounds, and lands the room in `COMPLETED`.
4. **Host-departed completion:** ensure no host-only mutation is the sole path
   to reveal/complete; participants (or the cron) can finish the game.
5. **Verification:** integration tests against a live Convex dev target for
   (a) human-disconnect auto-complete, (b) all-humans-leave cron finish,
   (c) OpenRouter outage full-game completion, (d) host-departed completion;
   E2E mid-game-leaver scenario.

## Delivery (children 3–5)

- **Child 3 — abandonment cron:** `convex/crons.ts` runs `sweepAbandonedGames`
  every minute; it scans the new `games.by_status` index, gates on an idle-age
  floor (`roundStartedAt`) plus all-humans-stale presence, and schedules a
  per-game `finishAbandonedGame` that deterministically ghost-fills to
  `COMPLETED` via the idempotent `commitAssignedLine` (no LLM). Honest bylines
  preserved. The sweep does **not** depend on the per-turn `runAfter` chain
  surviving, so it heals games the floor missed (action death, legacy games).
- **Child 4 — host-departed:** the `IN_PROGRESS → COMPLETED` path carries no
  host gate (`summonGhostwriter` stays an optional override). Proven by the two
  host-departed integration cases (participant-finishes and cron-finishes).
- **Child 5 — verification:** `tests/convex/abandonment.test.ts` runs a–d on
  the **real** Convex scheduler/DB via convex-test, which this work unblocked
  (`tests/helpers/convexTest.ts` — the long-deferred `import.meta.glob` blocker
  was self-inflicted; backlog 014 groundwork). E2E grader at
  `tests/e2e/mid-game-leaver.spec.ts` (`pnpm test:e2e:leaver`).
- **Refactor:** extracted `isPresenceStale()` into `gameRules.ts`, unifying the
  four copies of the staleness predicate (away indicators + sweep).
- **Follow-ups filed:** host migration (017), convex-test migration of the
  remaining mock-DB suites (018).
