# Extract Session Transition Core

Priority: high
Status: done
Estimate: L

## Goal

Centralize room, round, reveal, and AI completion transitions behind one typed lifecycle module so gameplay state changes are consistent and testable.

## Non-Goals

- Ship the post-reveal session hub UI
- Rewrite unrelated Convex queries or schema definitions
- Change the poem-generation or persona system

## Oracle

- [x] `pnpm vitest run tests/convex/game.test.ts tests/convex/roomLifecycle.test.ts`
- [x] A shared lifecycle module owns round completion, game completion, reveal readiness, and cycle reset decisions.
- [x] `convex/game.ts` and `convex/ai.ts` no longer duplicate round/game completion branching.
- [x] Retry/idempotency cases remain covered for human and AI submissions.

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

## What Was Built

- Added `convex/lib/sessionLifecycle.ts` to centralize submission-window gating, reveal/cycle readiness checks, round completion detection, round advancement, and terminal game completion side effects.
- Rewired `convex/game.ts` and `convex/ai.ts` to call the shared lifecycle helper instead of carrying duplicate transition branches.
- Added focused lifecycle regression coverage for the shared helper, AI finalization, and the human final-round path.

## Verification

- `pnpm vitest run tests/convex/game.test.ts tests/convex/roomLifecycle.test.ts tests/convex/lib/sessionLifecycle.test.ts tests/convex/aiLifecycle.test.ts`
- `pnpm exec tsc --noEmit`
- `pnpm exec eslint convex/game.ts convex/ai.ts convex/lib/sessionLifecycle.ts tests/convex/game.test.ts tests/convex/lib/sessionLifecycle.test.ts tests/convex/aiLifecycle.test.ts`

## Workarounds

- Thinktank review did not finish within the session window, and Gemini cross-harness review repeatedly failed with provider `429 MODEL_CAPACITY_EXHAUSTED`; ship judgment relied on the internal reviewer bench plus local verification.
