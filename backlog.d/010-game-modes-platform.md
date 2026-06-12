# Make game rules data and ship two new modes (Rhyme Relay, Quick Jam)

Priority: P0 · Status: ready · Estimate: L

## Goal

A game's shape (round count, word counts, twists) is data keyed by a mode
stored on the game, the lobby offers Classic / Rhyme Relay / Quick Jam, and
adding a fourth mode means adding one rules entry — not shotgun surgery.

## Oracle

- [ ] `games.mode` exists in schema (optional, defaults to classic for legacy
      rows); `convex/lib/gameRules.ts` exposes `getGameRules(mode)` returning
      `{ wordCounts, finalRhyme, label, tagline }` and is the only place a
      round structure literal lives.
- [ ] `generateAssignmentMatrix` takes a `rounds` parameter; grep finds no
      hardcoded `< 9` round loop outside the rules module
      (was `convex/lib/assignmentMatrix.ts:119`).
- [ ] Host can pick a mode in the lobby; all lobby members see the selection
      live (stored on the room, stamped onto the game at start).
- [ ] Rhyme Relay: final-round writers see the poem's opening word as a rhyme
      target in `getCurrentAssignment` and on the writing screen; reveal
      highlights the bookend words. No server-side rhyme validation — the
      room judges out loud.
- [ ] Quick Jam: 5 rounds (1,2,3,2,1) plays end-to-end through the same
      lifecycle, including AI turns and reveal.
- [ ] Vitest covers rules lookup, matrix parameterization, mode stamping,
      rhyme-target payload, and quick-jam completion; `pnpm test`,
      `pnpm typecheck`, `pnpm lint` green.

## Notes

Why this shape: the round structure was duplicated across
`convex/lib/assignmentMatrix.ts` (hardcoded loop), `sessionLifecycle.ts`
(FINAL_ROUND_INDEX), `game.ts`, `ai.ts`, and UI copy. Modes force the
consolidation; the second and third presets prove the abstraction.
Rhyme judgment is social (read-aloud), never mechanical — a phonetics
library rejecting a player's rhyme would be a party-killer.

## Children

1. Rules module: `GameMode` union + `getGameRules`; per-game rules threaded
   through `game.ts`, `ai.ts`, `sessionLifecycle.ts` (no global WORD_COUNTS
   reads on game paths).
2. Schema: `rooms.selectedMode` (lobby intent) + `games.mode` (stamped).
3. Matrix: `generateAssignmentMatrix(userIds, rounds)`.
4. Lobby mode picker (host-set, live for everyone, Kenya-Hara restraint).
5. Rhyme target plumbing: assignment payload + writing screen banner +
   reveal bookend flourish.
