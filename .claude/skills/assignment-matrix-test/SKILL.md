---
name: assignment-matrix-test
description: |
  Property-test the derangement constraint in `convex/lib/assignmentMatrix.ts`.
  No player may be assigned consecutive lines on the same poem. Runs M randomized
  generations across N=2..8 players, fails closed with replay seed on any
  violation. Load-bearing for game correctness (ADR 0002, ADR 0004).
  Use when: editing assignment matrix logic, reviewing matrix PRs, chasing a
  "same player twice in a row" bug report, or verifying post-refactor correctness.
argument-hint: '[seed] [iterations]'
---

# /assignment-matrix-test (Linejam)

Property-test the Linejam assignment matrix. One concern: the derangement
constraint in `convex/lib/assignmentMatrix.ts:generateAssignmentMatrix(userIds)`.
Unit tests at `tests/assignmentMatrix.test.ts` cover fixed shapes; they miss
statistical regressions. This skill closes that gap.

## Scope (Linejam-specific — not portable)

This skill is bound to Linejam's exact cadence:

- **9 rounds** per cycle (word-count shape `[1,2,3,4,5,4,3,2,1]` — context only).
- **Matrix shape is 9×N**: `matrix[round][poemIndex] = userId`. Poem count `K = N`
  (every player owns one poem index per round).
- **Target file**: `convex/lib/assignmentMatrix.ts`.
- **Related module**: `convex/lib/assignPoemReaders.ts` (ADR 0004 derangement —
  covered by this skill only when a change to reader-assignment invariants
  reshapes the matrix contract; reader-assignment itself has its own unit tests).
- **ADRs under test**: `docs/adr/0002-assignment-matrix-derangement.md`,
  `docs/adr/0004-reader-assignment-derangement-module.md`.

Applied to any other game's assignment logic, this skill is wrong. The
9-round cadence, the N×N shape, and `Id<'users'>` typing are all load-bearing.

## The Property Under Test (the oracle)

For any matrix `M = generateAssignmentMatrix(userIds)` with `N = userIds.length`:

1. **Derangement (primary):** for all `r ∈ 1..8`, all `j ∈ 0..N-1`,
   `M[r][j] !== M[r-1][j]`. No player writes consecutive lines on the
   same poem.
2. **Row shape:** `M.length === 9`; every `M[r].length === N`.
3. **Row-wise permutation:** each `M[r]` is a permutation of `userIds`
   (every player writes exactly one line per round — no duplicates,
   no missing players).
4. **Column coverage:** each column `j` contains exactly 9 entries, all
   drawn from `userIds`. Repeats across rounds are expected; consecutive
   repeats are forbidden (see property 1).

**N=1 is excluded.** Property 1 is mathematically impossible for a single
player; the algorithm itself warns and allows. Property tests run `N ∈ 2..8`.

**N=2 is in scope.** Property 1 is satisfiable (swap each round), and the
algorithm does satisfy it — regressions here are the whole point.

**Fail-closed.** No statistical tolerance. Every generated matrix must
satisfy all four properties. A single violation fails the suite with a
replayable seed.

## Method

`generateAssignmentMatrix` draws randomness from `crypto.getRandomValues`
(see `convex/lib/assignmentMatrix.ts:secureRandomInt`). There is no seed
parameter. To make failures replayable, the property test stubs
`globalThis.crypto.getRandomValues` with a seeded PRNG (mulberry32 or
xorshift32 inlined in the test — no new dependency) inside a
`vi.spyOn` / `vi.stubGlobal` scope, and restores it after.

- `fast-check` is **not** a dependency of Linejam. Do not add it for this
  skill — plain Vitest loops over seeded iterations are sufficient and
  match the repo's "deletion over addition" doctrine.
- Default iterations `M = 1000`. Iterate `i ∈ 0..M-1`; derive the per-run
  seed as `base_seed ^ i` (or `(base_seed + i) | 0`). Base seed defaults
  to `0xC0DEFACE` for deterministic CI; can be overridden via the
  skill's `[seed]` argument hint when chasing a bug.
- For each seed, randomize `N` across `2..8` uniformly (covers the full
  supported range) and call `generateAssignmentMatrix(mockUserIds(N))`.
  Mock user IDs follow the existing pattern: `` `user_${i}` as Id<'users'>``.
- Assert all four properties. On any violation, push `{ seed, N, round,
column, matrix }` to a failures array; continue so one run surfaces
  multiple bad seeds.
- At end of loop: if failures non-empty, `expect(failures).toEqual([])`
  after logging pass count, fail count, and the **first 10 failing
  seeds** in replay form (`pnpm test --run tests/convex/assignmentMatrix.property.test.ts -- --seed=0xDEADBEEF`
  style — actual replay is via env var or a dedicated test case that
  takes the seed literal).

## Where the Test Lives

- **Path:** `tests/convex/assignmentMatrix.property.test.ts`. Rationale:
  the existing unit test is at `tests/assignmentMatrix.test.ts` (top-level
  for historical reasons), but new convex-module tests land under
  `tests/convex/` (see `tests/convex/lib/auth.test.ts`,
  `tests/convex/lib/sessionLifecycle.test.ts`). Match the current
  convention.
- **Do not delete or duplicate** the existing `tests/assignmentMatrix.test.ts`
  fixed-shape cases — they cover different ground (N=0, getMatrixRound
  bounds, explicit N=2/N=8 spot-checks). The property test supplements.

## Running It

```bash
# Single file, default seed, M=1000
pnpm test --run tests/convex/assignmentMatrix.property.test.ts

# Watch mode while hacking on the algorithm
pnpm test:watch tests/convex/assignmentMatrix.property.test.ts

# Replay a specific failing seed (expose via env var in the test)
LINEJAM_MATRIX_SEED=0xDEADBEEF pnpm test --run tests/convex/assignmentMatrix.property.test.ts

# Longer soak before merging an algorithm change
LINEJAM_MATRIX_ITERATIONS=10000 pnpm test --run tests/convex/assignmentMatrix.property.test.ts
```

## Gate Integration

- The file matches the `**/*.test.ts` include in `vitest.config.ts` and
  runs automatically under `pnpm ci:dagger:unit-test` — no separate lane,
  no new script.
- Coverage contributes to the repo-wide **85% threshold** (lines,
  branches, functions, statements). Do not lower it.
- `pnpm ci:prepush` (== `pnpm ci:dagger:all`) is the gate. A property
  violation red-lights prepush; the pre-push hook blocks the push.
- Respect `maxWorkers: 1` and the 10s `testTimeout`. With M=1000 across
  N=2..8 the suite should finish in well under a second; if it doesn't,
  either the algorithm regressed or M was raised — diagnose, don't bump
  the timeout.

## When To Run It

Mandatory before committing any of:

1. Edits to `convex/lib/assignmentMatrix.ts` (algorithm, helpers,
   `secureShuffle`, `findSwapTarget`, `MAX_ATTEMPTS`).
2. Edits to `convex/lib/assignPoemReaders.ts` that change the derangement
   contract or shuffle injection interface (ADR 0004).
3. New ADR or ADR amendment touching ADR 0002 or ADR 0004 — the property
   test ratifies the invariant the ADR claims.
4. Convex `Id<'users'>` typing changes that flow through the matrix
   signature.

Non-mandatory but recommended: bumps to the `crypto` / `node` version
in `.nvmrc` or `package.json` `engines` — the PRNG stub and the
production `crypto.getRandomValues` path both deserve re-validation.

## Failure Handling

- **Red on a specific seed.** Do not rerun until green. Replay with
  `LINEJAM_MATRIX_SEED=<seed>`, reproduce locally, trace into
  `generateAssignmentMatrix`. Most likely failure modes: `findSwapTarget`
  regression, `MAX_ATTEMPTS` reached without warning surfaced, or a
  shuffle bias introduced by a refactor of `secureRandomInt`.
- **Red with the warning path hit.** The algorithm currently `console.warn`s
  and _allows_ a conflicting permutation after `MAX_ATTEMPTS = 1000`.
  The property test must treat that as a **test failure** — the warning
  is a known hazard, not a sanctioned escape hatch. If the warning fires
  on N ≥ 2 the algorithm needs a fix, not a test relaxation.
- **Blocker.** If the property cannot be satisfied for a supported N
  under any seed, raise a blocker — do not weaken the property. The
  matrix is load-bearing for game correctness; ADR 0002's whole
  justification is that the constraint holds.

## Delegate

- **Implementation & TDD rigor:** `beck` (red-green-refactor discipline
  for the property harness itself).
- **Algorithmic debugging on a replay seed:** `carmack` (direct,
  mechanical — no speculative redesign of the matrix algorithm).
- **Cross-model sanity on invariant phrasing:** `ousterhout` if the
  property list itself is in flux (it shouldn't be — the four
  invariants above are the complete set).

No other agents. No a11y, no planner (the plan is this skill), no
critic (the oracle is the property assertions).
