# Engineer tension into every round: clock, sparks, waiting theater

Priority: P1 · Status: done · Estimate: M

## Goal

Every round carries gentle pressure and the waiting room tells a live
story, so the in-room energy never goes flat between reveals.

## Oracle

- [ ] Writing screen shows a soft round clock driven by
      `games.roundStartedAt`: a quiet drain that warms to vermillion in the
      final stretch and never blocks submission (no enforcement — pressure,
      not punishment).
- [ ] Waiting screen names who the room is waiting on (visible without
      hover/tooltips on touch), shows round elapsed time, and shifts tone
      when someone goes into overtime.
- [ ] Sparks: each (poem, round) gets a deterministic micro-prompt from a
      curated list, shown as a subtle, ignorable whisper on the writing
      screen; same player re-opening the screen sees the same spark
      (vitest covers determinism and distribution).
- [ ] Reduced-motion users get a calm equivalent (no pulsing).
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` green.

## Notes

Game-design audit: no pacing mechanic existed anywhere; waiting is dead
air; the placeholder "write three words…" gives no comedy fuel. Sparks are
inspiration, never a requirement — the word-count constraint stays the only
rule. Aesthetic bar: Kenya Hara restraint; the clock is a hairline, not a
scoreboard.

## Children

1. Round clock component + server-time-anchored countdown hook.
2. Spark corpus + deterministic picker (`lib` + convex assignment payload).
3. Waiting screen storytelling states.
