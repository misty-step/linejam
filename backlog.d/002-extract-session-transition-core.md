# Extract Session Transition Core

Priority: high
Status: ready
Estimate: L

## Goal

Centralize room, round, reveal, and AI completion transitions behind one typed lifecycle module so gameplay state changes are consistent and testable.

## Non-Goals

- Ship the post-reveal session hub UI
- Rewrite unrelated Convex queries or schema definitions
- Change the poem-generation or persona system

## Oracle

- [ ] `pnpm vitest run tests/convex/game.test.ts tests/convex/roomLifecycle.test.ts`
- [ ] A shared lifecycle module owns round completion, game completion, reveal readiness, and cycle reset decisions.
- [ ] `convex/game.ts` and `convex/ai.ts` no longer duplicate round/game completion branching.
- [ ] Retry/idempotency cases remain covered for human and AI submissions.

## Notes

- Primary evidence:
  `convex/game.ts` and `convex/ai.ts` both own overlapping transition logic and are top churn hotspots.
- This item is intentionally backend-first. Keep UI untouched except where strict contracts force clearer error handling.
- Land after item `001` so the player-facing failure contract is already explicit.

## Implementation Sequence

1. Identify duplicated transition branches and codify the shared contract.
2. Add failing tests for duplicated drift-prone cases.
3. Extract the lifecycle helper into `convex/lib/`.
4. Migrate human and AI callers to the helper, then remove dead branches.

## Repo Anchors

- `convex/game.ts`
- `convex/ai.ts`
- `tests/convex/game.test.ts`
- `tests/convex/roomLifecycle.test.ts`
