# Never let the room die: rescue stalls, unblock continuation

Priority: P0 · Status: ready · Estimate: L

## Goal

A live room always has a path forward: a vanished player's turn can be
passed to a ghostwriter, a finished game can be continued by anyone in the
room, and AI turns always land even after infra hiccups.

## Oracle

- [ ] `games.roundStartedAt` is set at game start and on every round
      advance (vitest asserts both transitions).
- [ ] Ghostwriter rescue: when a round has been stuck past the overtime
      threshold, the host sees a rescue affordance on the waiting screen;
      triggering it fills the missing line via the AI pipeline (fallback
      guaranteed) with honest attribution ("ghostwriter" marker, not
      impersonation), and the round advances. Server rejects rescue before
      the threshold and for non-hosts (vitest).
- [ ] Self-healing AI: if a round is blocked only by AI-assigned poems, any
      human submission re-nudges `scheduleAiTurn` (idempotent) so a dead AI
      action cannot strand the room (vitest).
- [ ] Rematch gate: once a completed game exists, any participant — not
      just the host — can start the next game or return the room to lobby
      (`convex/game.ts:113` was host-only; SessionRecapHub no longer tells
      non-hosts to wait). First game start stays host-only.
- [ ] WaitingScreen never claims "Room not found" for a participant whose
      game just completed; null progress renders neutral copy.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` green.

## Notes

Party-killer audit evidence: host-only `startNewCycle` strands non-hosts at
recap; `isRoundComplete` (convex/lib/sessionLifecycle.ts:142) waits forever
on a vanished player; `generateLineForRound` is an action with no retry if
the action itself dies (generateLine already always falls back —
convex/lib/ai/providers/openrouter.ts:146 — so the residual risk is action
infra failure). Same-room trust justifies the relaxed rematch gate: the
room self-polices.

## Children

1. `roundStartedAt` plumbing (start + advance).
2. Ghostwriter rescue mutation + scheduled generation + waiting-screen
   affordance with overtime gating.
3. AI re-nudge inside the line lifecycle transition.
4. Rematch gate relaxation + recap copy.
5. Waiting-screen null-state copy fix.
