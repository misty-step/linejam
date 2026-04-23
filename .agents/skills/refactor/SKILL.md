---
name: refactor
description: |
  Branch-aware simplification workflow tailored to linejam. On feature branches,
  simplify the diff before merge against `master`. On `master`, scan hot files
  cross-referenced with ADRs 0001-0008 and `backlog.d/` debts to pick one
  highest-leverage simplification and shape it into a backlog item.
  Use when: "refactor this", "simplify this diff", "clean this up",
  "reduce complexity", "pay down tech debt", "make this easier to maintain".
  Trigger: /refactor.
argument-hint: '[--base master] [--scope <path>] [--report-only] [--apply]'
---

# /refactor

Reduce complexity without reducing correctness, without violating linejam's
ADRs, and without breaking `pnpm ci:prepush`. Deletion first, then
consolidation, then abstraction, then mechanical cleanup. Every refactor ends
green on the Dagger gate — a red lane rejects the refactor.

## Load-Bearing Anchors (cite verbatim, never paraphrase)

**ADRs are load-bearing.** Refactors that change these shapes require a new
ADR in `docs/adr/`, not a silent rewrite:

- **0001 — Hybrid auth**: Clerk + signed guest JWT in localStorage. Never
  collapse `convex/lib/auth.ts` `getUser()` into a single-path function.
- **0002 — Assignment matrix derangement**: `convex/lib/assignmentMatrix.ts`
  is the correctness kernel. Simplifying the algorithm changes the game.
- **0003 — Game state via query, not pointer**: state is derived each query
  call. Don't refactor into a stored state pointer.
- **0004 — Reader assignment derangement module**: reveal-phase reader
  assignment is its own derangement pass; don't merge with 0002.
- **0005 — AI players via OpenRouter personas**: `convex/lib/ai/personas.ts`
  - `convex/lib/ai/providers/openrouter.ts`. Do not generalize the provider
    abstraction on one caller.
- **0006 — Theme system via CSS variables**: `lib/themes/presets/*.ts`
  emit CSS custom properties. Don't refactor to styled-components / object
  styles.
- **0007 — Parallel DB writes**: `Promise.all` for independent Convex
  mutations; `q.or()` for N+1 reads. Any sequential `await`-in-loop on DB
  calls is a refactor target on sight.
- **0008 — Pen names captured at write-time**: pen name stored on the line
  record. Don't refactor into a join against users.

**Invariant #5 (CLAUDE.md)**: no mocking `@/` or `../../` paths. During any
refactor that touches tests, rip out internal-module mocks and use the real
implementation. This is a hard rule, not a preference.

**Invariant #6**: `Promise.all` for independent DB writes; `q.or()` for N+1.
Flag and fix every sequential `await`-in-loop encountered.

**Gate**: refactor is done only when `pnpm ci:prepush` is green. Any Dagger
lane red = reject. No `git push --no-verify`, ever.

## Terminology Lock-in (never rename during refactor)

Poem / Line / Round (0–8) / Assignment matrix / Cycle / Pen name / Host /
Guest UUID / Guest token / Room code / Reveal phase / Dagger lane / Canary.
Rename proposals are out of scope — refactor moves structure, not vocabulary.

## Branch-Aware Routing

1. Current: `git rev-parse --abbrev-ref HEAD`
2. Primary: `master` (linejam convention; Invariant #9).

If current branch == `master`: **Primary Branch Mode**.
Else: **Feature Branch Mode** (base = `master` unless `--base` overrides).

If current branch resolves to `HEAD` or is ambiguous, stop and require
`--base <branch>`. Fail closed rather than compute the wrong diff.

- `--base master` — override detected base.
- `--scope <path>` — limit to one subtree (e.g. `convex/`, `lib/posthog/`).
- `--report-only` — disable file edits.
- `--apply` — allow edits in primary-branch mode (default is report + backlog
  shaping only).

Detailed simplification methodology: `references/simplify.md`.

## Feature Branch Mode (default on PR branches)

Goal: simplify `master...HEAD` before merge.

### 1. Map the delta

- `git diff --stat master...HEAD`
- `git diff master...HEAD --name-only` — list touched files
- For each touched file, cross-reference:
  - Is it in `convex/` and does it loop `await ctx.db.*`? (Invariant #6)
  - Does it touch `lib/analytics.ts`? (PostHog migration debt — see below)
  - Does it touch `convex/game.ts`? (Known N+1 in `getRevealPhaseState`)
  - Does it mock `@/` or `../../`? (Invariant #5 — rip out)
  - Does it change an ADR-anchored shape? (Stop, escalate, don't silently
    rewrite.)

### 2. Identify simplification targets

- **Shallow modules**: pass-through wrappers, thin re-exports. Linejam prior
  art: `lib/cn.ts` is _correctly_ thin (stable convention); new 3-line
  wrappers with one caller are not.
- **Temporal coupling**: ordering requirements not encoded in types.
  Canonical example: call `addAiPlayer` before `startGame`; if ordering is
  implicit, encode it in the mutation signature.
- **Speculative abstractions**: interface with one implementation, provider
  pattern with one provider. ADR 0005 deliberately constrains this — don't
  generalize `openrouter.ts` into a `providers/` interface on one caller.
- **Sequential DB writes**: any `for (const x of xs) { await ctx.db.patch }`
  — batch with `Promise.all`.
- **Internal mocks**: any `vi.mock('@/...')` or `vi.mock('../../...')` —
  swap to real implementation.
- **Tests asserting implementation not behavior**: snapshot tests on
  internal helpers, tests that reach into private state.

### 3. Parallel exploration bench

Launch three configured subagents in parallel:

- **grug** (Explore): complexity-demon hunt in the diff. What's thrashing?
  What's easier to delete than to understand?
- **ousterhout** (Explore): shallow modules, information leakage,
  pass-throughs, temporal decomposition in the changed files.
- **carmack** (Explore): does the diff make the happy path shorter or
  longer? Are there states the machine doesn't need?

Each returns: top findings, one recommended change, confidence, risk.

### 4. Synthesize and choose

Rank by `(complexity removed * confidence) / implementation risk`. Break ties
toward the ADR-aligned option.

Priority order:

1. Deletion (dead code, unused exports, one-caller abstractions)
2. Consolidation (two-nearly-identical-things → one parameterized)
3. State-space reduction + invariant tightening (encode ordering in types)
4. Naming clarification (only within terminology lock-in)
5. Abstraction (only when pattern appears 3+ times)
6. Mechanical cleanup

### 5. Execute (unless `--report-only`)

Dispatch **builder** for exactly one bounded refactor. Include:

- behavior-preserving tests (new or updated, no internal mocks)
- ADR citation if the refactor touches an anchored shape
- doc updates only for changed contracts (don't rewrite unchanged prose)
- fix-what-you-touch: if you cross a sequential-DB-write or an internal
  mock in the changed area, fix it in the same commit (doctrine + Invariant
  #5/#6)

### 6. Verify

- `pnpm typecheck` — clean
- `pnpm test --run <changed paths>` — green
- `pnpm ci:prepush` — full Dagger gate green (authoritative)
- Diff stat: net LOC ≤ 0, or positive only if offset by genuine
  state-space reduction

Reject if complexity moved rather than removed.

## Primary Branch Mode (default on `master`)

Goal: one highest-leverage simplification for the codebase. Safe for
scheduled runs — default is report + shape, not edit.

### 1. Build a hotspot map

```bash
git log --since=60.days --name-only --pretty=format: | sort | uniq -c | sort -rn | head -15
```

Cross-reference hotspots with:

- **ADR coverage** (`docs/adr/0001`–`0008`): high churn against an
  anchored shape is a refactor target only if the ADR itself is wrong.
- **Known debts** (from repo-brief):
  1. **N+1 in `convex/game.ts getRevealPhaseState`** — batch with `q.or()`.
     Highest leverage; unpatched.
  2. **PostHog migration**: when touching `lib/analytics.ts` (6 Vercel
     Analytics events), migrate the event to `lib/posthog/`.
  3. **`useQuery` error-boundary gaps**: Convex 1.x has no error state;
     wrap call sites in ErrorBoundary.
  4. **`/api/health` vs Canary readiness conflation**: health should
     report app health separately from Canary ingest.
- **Backlog slices 010–015** (CI redesign): don't duplicate in-flight work.

### 2. Parallel strategy bench

Three subagents in parallel:

- **grug** (Explore): where does the complexity demon live in the hottest
  files? What's one thing we could delete today?
- **ousterhout** (Explore): deepest module vs. shallowest pass-through in
  the codebase. Name both.
- **carmack** (Plan): if we rebuilt the top hotspot today given ADRs
  0001–0008 as constraints, what's the minimal shape?

### 3. Diverge before converge

Per the repo doctrine and `feedback_divergence_for_design_decisions.md`:
produce **three structurally distinct simplification shapes**, not one with
variants. Each shape must fail differently. Example axes:

- Delete-and-inline vs. consolidate vs. encode-in-types.
- Touch one module deeply vs. thin sweep across many.
- Backlog item vs. single PR vs. sequence of bounded PRs.

User ratifies the shape before implementation. Silent absorption of a
proposed shape is not ratification.

### 4. Produce outcome

Default (safe): no code edits. Instead:

- Winning candidate with explicit oracle (how do we know the refactor
  worked?).
- Shape it as a numbered markdown file in `backlog.d/` (NNN-kebab-title.md)
  with Priority / Status / Estimate / Goal / Oracle (per Invariant #10,
  `backlog.d/` is source of truth, not GH Issues).

If `--apply`:

- Dispatch **builder** for exactly one low-risk, bounded simplification.
- Verify `pnpm ci:prepush` green.
- Record residual risk and follow-up items.

## Required Output

```markdown
## Refactor Report

Mode: feature-branch | primary-branch
Target: <branch or scope>
Base: master

### ADR Alignment

[ADRs touched, if any — refactor preserves or escalates with new ADR]

### Candidate Opportunities

1. [winning candidate] — complexity removed, risk, confidence, ADR/debt citation

### Runners-Up (optional, max 2)

1. [runner-up]
2. [runner-up]

### Selected Action

[what was applied, or `backlog.d/NNN-*.md` item created with Goal + Oracle]

### Verification

- `pnpm typecheck`: [result]
- `pnpm test --run <paths>`: [result]
- `pnpm ci:prepush`: [result — authoritative]
- LOC delta (net): [number]

### Residual Risks

[what remains and why]
```

## Gotchas

- **Complexity moved, not removed**: splitting one complex module into two
  equally complex modules is not simplification. Verify net function-level
  cyclomatic complexity decreases.
- **Silent ADR violation**: if the refactor changes a shape anchored in
  `docs/adr/`, stop and file a new ADR. Never rewrite an ADR-anchored
  shape under "cleanup".
- **Terminology drift**: don't rename Poem → Document, Line → Entry,
  Round → Phase. Refactor is structural, not vocabulary.
- **Speculative interfaces**: ADR 0005 constrains the AI provider to one
  concrete caller. Do not introduce `providers/` abstraction until there
  is a second provider.
- **Sequential DB writes left in place**: if you touch a Convex mutation
  that loops `await ctx.db.*`, fix it (Invariant #6). Don't excuse it as
  pre-existing.
- **Internal mocks left in place**: if you touch a test that mocks `@/`
  or `../../`, rip it out (Invariant #5). No "not my scope".
- **Skipping the gate**: `pnpm ci:prepush` is the contract. A green
  `pnpm test` alone is not sufficient.
- **Refactoring across ADR boundaries**: keep each refactor bounded to one
  subtree. Cross-cutting simplifications should be three sequential PRs,
  not one.
- **Aesthetic churn**: clearer names and fewer states matter; style-only
  motion is noise. Prettier already runs on pre-commit.
- **Parallelizing dependent edits**: only parallelize disjoint slices.
  A refactor touching `convex/game.ts` and its tests is not two slices,
  it's one.
