---
name: code-review
description: |
  Parallel multi-agent code review for linejam. Launch the bench, synthesize
  findings against linejam invariants and ADRs, fix blockers, re-review until
  clean. Gate verdict is `pnpm ci:prepush` green plus 85% coverage.
  Use when: "review this", "code review", "is this ready to ship",
  "check this code", "review my changes".
  Trigger: /code-review, /review, /critique.
argument-hint: '[branch|diff|files]'
---

# /code-review (linejam)

Multi-provider, multi-harness code review tuned for the linejam stack
(Next.js 16 + Convex + Clerk + guest JWTs + Playwright + Dagger). You are
the marshal — read the diff, pick reviewers, craft linejam-specific prompts,
dispatch in parallel, synthesize against the repo-brief anchors, fix
blockers, loop until clean.

**Base branch is `master`.** Not `main`. `git diff origin/master...HEAD`.

## Marshal Protocol

1. **Read the diff.** `git diff origin/master...HEAD`. Classify by surface:
   Convex backend / App Router / components / lib / themes / tests / Dagger /
   scripts / ADRs. Note which linejam invariants the diff touches (see below).

2. **Select internal reviewers (static map).** Run the algorithm in
   `references/bench-map.md` against `git diff --name-only origin/master...HEAD`.
   Default bench is `[critic, ousterhout, grug]`; union `add` agents per
   matching rule; cap at 5; `critic` is pinned. For linejam diffs the bench
   usually lands as some subset of:
   - `critic` (always, evidence-based skeptic, ships the score)
   - `ousterhout` (deep modules, information hiding — ADR-0004 reader
     assignment is the canonical example; flag shallow pass-throughs in
     `convex/lib/`)
   - `grug` (complexity hunting — flag premature abstraction in
     `lib/themes/`, `convex/lib/ai/`)
   - `carmack` (shippability + direct implementation — flag ceremony in
     Dagger lanes, over-engineered client components)
   - `beck` (TDD + simple design — flag untested Convex mutations, missing
     ErrorBoundary around `useQuery`)
   - `a11y-auditor` (any `.tsx`/`.jsx` in `app/` or `components/`)

   Only agents that exist in `.claude/agents/`
   may be used: `a11y-auditor`, `a11y-critic`, `a11y-fixer`, `beck`,
   `builder`, `carmack`, `critic`, `grug`, `ousterhout`, `planner`. Do not
   invent reviewers.

3. **Dispatch all three tiers in parallel.**

   | Tier             | What                                                 | How                                                                                                                              |
   | ---------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
   | Internal bench   | 3–5 Explore sub-agents with linejam-specific prompts | Agent tool                                                                                                                       |
   | Thinktank review | 10 agents, 8 providers                               | `thinktank review --base origin/master --head HEAD --output /tmp/thinktank-review --json`. See `references/thinktank-review.md`. |
   | Cross-harness    | Codex + Gemini CLIs (skip whichever harness you are) | See `references/cross-harness.md`. Pass `--base origin/master`.                                                                  |

   Thinktank rule: wait for the process to exit, or for `trace/summary.json`
   to reach `complete` / `degraded` with a `run_completed` event in
   `trace/events.jsonl`. Mid-run directories are not final artifacts.

4. **Synthesize against linejam anchors** (next section). Deduplicate across
   tiers. Rank: blocking (correctness, security, invariant violation) >
   important (architecture, ADR drift, missing tests) > advisory (style).

5. **Verdict.** No blocking findings → **Ship**. Blocking findings → fix loop.

## Linejam Anchors (Reviewer Checklist)

Every reviewer prompt must ground findings in these. The anchors are drawn
from `.spellbook/repo-brief.md` — cite
them verbatim in the synthesis.

### Invariants (hard blockers)

- **Invariant #5 — Mocking boundary.** Reject any test that mocks `@/` or
  `../../` paths. Mock only at system boundaries: `convex/react`,
  `@clerk/nextjs`, `fetch`, `localStorage`, `clipboard`, `Date.now`,
  `Math.random`. Mocking `@/lib/wordCount`, `@/hooks/useTheme`,
  `convex/lib/auth`, `lib/posthog/`, avatar/color helpers, `lib/auth.ts`
  `useUser` — all forbidden. This is codified in CLAUDE.md and is
  load-bearing even before any future lint codification.
- **Invariant #6 — Parallel DB writes.** Flag any sequential
  `await ctx.db.patch(...)` / `ctx.db.insert(...)` / `ctx.db.delete(...)`
  inside a `for` / `for...of` loop over independent items. The fix is
  `Promise.all(items.map(item => ctx.db.patch(item._id, ...)))`. For read
  fan-out across multiple keys, batch with `q.or(...)` in a single
  `ctx.db.query(...).filter(...)` call. See ADR-0007.
- **Invariant #7 — Loop termination guard.** Every `while` needs a bounded
  iteration count (`attempts < MAX_ATTEMPTS`). Infinite-loop test hangs have
  cost real time. Reject unguarded `while` on sight — including in
  assignment/derangement retry loops.
- **Invariant #9 — Conventional Commits.** Every commit message must match
  commitlint's `@commitlint/config-conventional` with types restricted to
  `feat|fix|docs|style|refactor|perf|test|chore|revert`. Verify with
  `git log origin/master..HEAD --format='%s'`. Non-compliant messages fail
  lefthook commit-msg; they will fail the pre-push hook too.

### Known debts (flag regressions and fix-on-encounter)

- **N+1 author fetches in `convex/game.ts getRevealPhaseState`.** Any new
  fan-out over authors/lines/poems without `q.or(...)` batching is a
  blocker. If the diff touches this file at all, the reviewer should call
  for batching the existing N+1 too (fix-everything-on-encounter mandate).
- **PostHog vs Vercel Analytics dual-write.** `lib/analytics.ts` is being
  phased out; `lib/posthog/` is canonical. Any new event added to
  `lib/analytics.ts` without a matching PostHog event is a blocker. When
  the diff touches `lib/analytics.ts`, reviewer must require the event be
  migrated to `lib/posthog/`.
- **`useQuery` has no error state.** In Convex 1.x, errors become unhandled
  React exceptions. New `useQuery` call sites in client components must be
  wrapped in an ErrorBoundary ancestor. Reviewer flags bare `useQuery` in
  fresh `.tsx` without a boundary in the render tree.
- **Prompt injection in OpenRouter provider.** User has explicitly
  deprioritized this (`convex/lib/ai/providers/openrouter.ts` interpolates
  `previousLineText` unescaped). Do not re-raise unless the AI surface
  expands beyond trusted-user multiplayer poetry.
- **Cerberus is out.** If the diff revives workflow files or doc references
  to Cerberus, reject.

### ADR compliance (0001–0008)

Reviewers check new code against these decisions. Deviating from an ADR
without a superseding ADR is a blocking finding.

| ADR  | Decision                                          | Reviewer checks                                                                                                                                                                                                                                    |
| ---- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------- | --- | --------------------------------------------------------------- |
| 0001 | Hybrid auth: Clerk + HMAC-signed guest tokens     | Any new Convex mutation must call `getUser(ctx, guestToken)` from `convex/lib/auth.ts`, not `ctx.auth.getUserIdentity()` alone. Unsigned `guestId` passed as a string is forbidden. `GUEST_TOKEN_SECRET` must not be referenced in client bundles. |
| 0002 | Assignment matrix generated upfront at game start | Do not replace `convex/lib/assignmentMatrix.ts` with per-round lazy assignment. Matrix is immutable after `startGame`. Derangement retry loop (rounds 1–8) retains its `attempts < 1000` guard.                                                    |
| 0003 | Game state via query, not mutable pointer         | Do not read `room.currentGameId` as source of truth in new code. Use `getActiveGame(ctx, roomId)` / `getCompletedGame(ctx, roomId)` / `deriveRoomStatus(ctx, roomId)` from `convex/lib/room.ts`. Duplicate submissions must remain idempotent.     |
| 0004 | Reader assignment is a deep module                | Callers must `import { assignPoemReaders } from 'convex/lib/assignPoemReaders'` — do not re-implement AI filtering or shuffle logic in `submitLine` / `ai.ts` / new completion paths.                                                              |
| 0005 | AI players via OpenRouter with persona system     | New AI personas go in `convex/lib/ai/personas.ts`. Three-tier resilience (retry → word-count validation → deterministic fallback) must be preserved. No direct-provider integrations.                                                              |
| 0006 | Theme system via CSS custom properties            | New themes are preset files under `lib/themes/presets/` registered in `lib/themes/registry.ts`. All tokens from `ThemeTokens` must be defined for both light and dark. No inline-style hex colors in components — use CSS variables.               |
| 0007 | Parallel DB writes                                | See Invariant #6. Timestamps for batched writes are captured once before `Promise.all`, not per-iteration.                                                                                                                                         |
| 0008 | Pen names captured at write-time                  | `lines.authorDisplayName` is set inside the submit mutation from `user.displayName` at that moment. Display logic uses `l.authorDisplayName                                                                                                        |     | author?.displayName |     | 'Unknown'`. Do not rewrite callers to live-lookup the pen name. |

### Terminology lock-in

Reject renames. The repo vocabulary is:

- **Poem** (not document / entry / thread)
- **Line** (not entry / submission / message)
- **Round** (not step / turn / phase; rounds 0–8)
- **Assignment matrix** (not schedule / roster / rotation)
- **Pen name** (not nickname / display name in user-facing strings)
- **Guest UUID** / **guest token** (not anonymous ID / visitor)
- **Host** (not admin / owner)
- **Cycle** (not session / game-instance; one run through nine rounds)
- **Room code** (not game ID / session ID; four-letter, formatted `AB CD`)
- **Reveal phase** (not reveal / endgame / reading)
- **Dagger** / **Dagger lane** (not "the CI")
- **Canary** (incident sink, not Sentry / Rollbar)

Variable renames that drift vocabulary are advisory unless they surface in
user-facing copy — then they are blocking.

### The ship gate

**`pnpm ci:prepush` is the gate** (= `pnpm ci:dagger:all`). The reviewer
treats the diff as shippable only when this passes. The marshal must
confirm — either by running it at the end of the fix loop, or by citing a
clean run in the branch context. Individual lanes for targeted verification:

- `pnpm ci:dagger:lint`
- `pnpm ci:dagger:format-check`
- `pnpm ci:dagger:typecheck`
- `pnpm ci:dagger:build-check`
- `pnpm ci:dagger:unit-test` (enforces **85% coverage** on lines, branches,
  functions, statements — threshold is load-bearing, do not lower)
- `pnpm ci:dagger:e2e` (Playwright; includes authenticated coverage)
- `pnpm ci:dagger:audit`
- `pnpm ci:dagger:secret-scan`
- `pnpm ci:dagger:all-no-e2e` (~90s — fast smoke)

Red Dagger never ships. Pushing on red requires `--no-verify`, which is
forbidden. If a lane is flaky, the fix is the lane or the test, not a
bypass.

## Review Focus By File Type

Tailor reviewer prompts based on which of these surfaces the diff touches.

### `convex/**` (backend)

- **Auth wrapping.** Every new mutation / query / action reads identity via
  `getUser(ctx, guestToken)` from `convex/lib/auth.ts`. Bare
  `ctx.auth.getUserIdentity()` without guest fallback is a blocker (ADR-0001).
- **Parallel writes.** `for` loops over independent `ctx.db.patch` calls →
  `Promise.all(items.map(...))` (ADR-0007, Invariant #6).
- **Batched reads.** N+1 fan-out → `q.or(...)` inside a single query.
  `convex/game.ts:getRevealPhaseState` is the known offender; any new code
  in this path must batch.
- **Indexes.** Queries using `.filter(q.eq(...))` on a non-indexed field are
  a perf blocker. Confirm a matching index exists in `convex/schema.ts`
  (`by_code`, `by_room`, `by_poem`, `by_user`, etc.). If not, the diff
  must add one.
- **Typed mutations.** `args: { ... }` uses `v.` validators. Untyped args
  is a blocker.
- **Idempotency.** `submitLine`-style mutations remain idempotent on
  duplicate (ADR-0003). No new throws on "already submitted".
- **Structured logging.** Use `log` / `logError` from `convex/lib/errors.ts`,
  not `console.*` (eslint's `no-console` is `error` everywhere except
  `lib/logger.ts`, `lib/error.ts`, `convex/lib/errors.ts`, `scripts/**`,
  `tests/**`).
- **No server spawning.** Review prompts may not suggest running
  `convex dev` locally — the user runs it in a separate terminal.

### `app/**` and `components/**` (frontend)

- **`'use client'` discipline.** Every interactive component declares
  `'use client'` at the top. React Server Components are not in use; a
  silent default to server-component semantics on an interactive file
  is a blocker.
- **ErrorBoundary around `useQuery`.** Convex 1.x `useQuery` throws on
  error. Any new component with `useQuery` needs an ErrorBoundary ancestor
  in the render tree (or a `data === undefined && !isLoading` pattern).
- **Theme context cleanup.** Tests touching `ThemeProvider` clean up
  between tests (context is global). Components read tokens via CSS vars
  (`var(--color-primary)`), not hard-coded hex.
- **No inline `console.*`.** Use `log` from `lib/logger.ts` or
  `captureError` from `lib/error.ts`. eslint blocks console in components.
- **Analytics routing.** New events go through `lib/posthog/`. Touching
  `lib/analytics.ts` triggers a migration requirement (see Known debts).
- **a11y.** `a11y-auditor` is automatic on any `.tsx` / `.jsx` diff. Alt
  text, semantic elements, focus management, keyboard nav on interactive
  widgets.
- **Pen name display.** Author labels use the captured
  `authorDisplayName` from the line record, not a live user lookup
  (ADR-0008).

### `lib/wordCount.ts`

- **Client+server parity.** This file is imported on both the Next.js
  frontend AND inside Convex mutations for submission validation. Any
  change must keep the two validation paths in lock-step. Tests must
  cover both call sites. Hyphenated words count as one (per the brief's
  gotcha). Changing the tokenizer is a correctness blocker — re-test
  `submitLine`'s word-count assertions.

### `lib/themes/**`

- **REQUIRED_TOKENS parity.** All four presets (`kenya.ts`, `mono.ts`,
  `vintage-paper.ts`, `hyper.ts`) must define every token in the
  `ThemeTokens` type, for both light and dark modes. `defineTheme()`
  validates at runtime; a missing token surfaces as a dev-time failure.
  If the diff adds a token, it adds it to all four — no partial rollouts.
- **Registry.** New presets register in `lib/themes/registry.ts`. A
  preset file that isn't registered is dead code.
- **SSR flash.** Theme selection happens in the blocking `<head>` script
  reading localStorage. Don't move this to a client-only effect — it
  reintroduces flash-of-wrong-theme.
- **Philosophy comment.** Each preset documents its design philosophy
  (Kenya/Ma, brutalist mono, aged paper, cyberpunk neon). Don't strip.

### `tests/**`

- **No `@/` or `../../` mocks** (Invariant #5). If the diff introduces
  `vi.mock('@/...')` or `vi.mock('../../lib/...')`, it is a blocker. The
  fix is to use the real implementation. System-boundary mocks are fine
  (`vi.mock('convex/react')`, `vi.mock('@clerk/nextjs')`, `fetch`,
  `localStorage`, `clipboard`).
- **ErrorBoundary in `useQuery` test branches.** If the component under
  test uses `useQuery`, the test either wraps in an ErrorBoundary or
  asserts the loading branch — don't let unhandled exceptions leak into
  vitest output.
- **Coverage.** Vitest threshold is 85% on lines/branches/functions/statements.
  If the diff drops coverage, fix the tests, don't lower the threshold.
- **Vitest config.** Pool is `threads`, `maxWorkers: 1` to avoid Node 22
  fork teardown hang. Don't speculatively change it.
- **Bounded loops.** Tests that drive retry logic use bounded iteration
  counts (Invariant #7). Unguarded `while (true)` in tests has hung CI
  before.
- **Playwright.** E2E specs in `tests/e2e/`. Flake is usually Clerk
  smoke-account drift or Convex dev out-of-sync — reviewers should
  suggest investigating those before blaming the test.

### `dagger/**`, `scripts/**`, `.github/workflows/**`

- **Gate authoritativeness.** Dagger is the source of truth. GitHub
  Actions mirrors. A change that makes hosted CI diverge from Dagger is a
  blocker — fix both or fix neither.
- **No `--no-verify`.** Any script or doc suggesting `git push --no-verify`
  is a blocker.
- **Prod Convex safety.** Code that sync-pushes to prod Convex without
  gating on `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1` is a blocker.
- **Canary keys.** `NEXT_PUBLIC_CANARY_ENDPOINT` / `NEXT_PUBLIC_CANARY_API_KEY`
  must be real in build-bearing lanes — no placeholder substitution.

### `docs/adr/**`

- New ADRs follow the template in `000-template.md`. Status / Context /
  Decision / Consequences / Alternatives-considered.
- Numbering is monotonic; the next ADR is `0009-*`.
- Superseding a prior ADR requires explicit `Supersedes ADR-NNNN` and a
  corresponding status update on the old ADR.

## Fix Loop

For each blocking finding, spawn a **builder** sub-agent with the specific
file:line and fix instruction, grounded in the invariant or ADR it violates.
Builder follows TDD (red → green → refactor), commits atomically with a
Conventional Commits message (Invariant #9), and runs `pnpm ci:dagger:all-no-e2e`
as a quick self-check before handing back.

After all fixes land, **re-dispatch all three review tiers.** Full re-review
against the new HEAD SHA. Loop until no blocking findings remain. Max 3
iterations — escalate to the user if still blocked.

## Live Verification

**Trigger:** diff touches user-facing surfaces — `app/**/page.tsx`,
`components/**/*.tsx`, `app/api/**/route.ts`, route handlers, theme
presets, or any file rendered on `/host`, `/join`, `/room/[code]`,
`/poem/[id]`, `/me`.

**Rule:** at least one reviewer (or the marshal) exercises the affected
routes/components via Playwright (`pnpm test:e2e` or
`pnpm test:e2e:smoke`) or by confirming the E2E lane ran green in
`pnpm ci:dagger:all`. Ship is blocked until live verification passes.

**Skip:** pure Convex refactors with no schema changes, config-only,
test-only, `dagger/**` internals, `scripts/**` with no user-facing
surface, `docs/**`.

## Plausible-but-Wrong Patterns (linejam flavor)

LLMs optimize for plausibility. Reviewers hunt for:

- **Wrong auth path.** New mutation uses `ctx.auth.getUserIdentity()` and
  looks correct, but skips the guest-token verification. `getUser(ctx,
guestToken)` is the single entry point (ADR-0001).
- **Lazy assignment regression.** Diff "simplifies" the assignment matrix
  by assigning per round lazily. This reintroduces races fixed in ADR-0003
  and violates ADR-0002. Plausible-looking, breaks concurrency.
- **Stale `room.currentGameId` reads.** New code reads it as source of
  truth instead of `getActiveGame(ctx, roomId)`. Works in single-player
  dev, breaks in prod under concurrent submissions.
- **Serial DB loop disguised.** `for (const x of xs) await ctx.db.patch(...)`
  wrapped in a helper function. Grep the helper body — sequential writes
  inside a named function still count.
- **Mock-creep.** New test mocks `@/lib/wordCount` because "the real one
  is slow" — it's not slow, and the mock lies about behavior. Always
  blocker (Invariant #5).
- **Pen name live-lookup.** Display logic does `users.get(authorUserId)`
  at render instead of reading `line.authorDisplayName`. Plausible refactor,
  violates ADR-0008.
- **Theme token drift.** One preset adds a token, others don't.
  `defineTheme()` throws at runtime, but only when that preset loads.
  Reviewer must check all four.
- **N+1 wearing a disguise.** `await Promise.all(items.map(async (i) => {
const x = await ctx.db.get(i.xId); ... }))` looks parallel but still
  fires one query per item. Batch with `q.or(...)` where index allows.
- **`useQuery` without boundary.** New component looks clean, tests pass,
  but any Convex error triggers a white-screen crash in prod.

## Simplification Pass

After review passes, if diff > 200 LOC net:

- Look for deletable code (remember: code is a liability)
- Collapse shallow pass-throughs in `convex/lib/`
- Simplify theme preset boilerplate via shared helpers in `lib/themes/schema.ts`
- Remove dead Vercel Analytics events when their PostHog counterparts land
- Retire compatibility shims that survived past their transition window
  (e.g. legacy unsigned `guestId`, if the shim is no longer exercised)

## Review Scoring

After the final verdict, append one JSON line to `.groom/review-scores.ndjson`
at the repo root (already exists — do not recreate):

```json
{
  "date": "2026-04-20",
  "pr": 42,
  "correctness": 8,
  "depth": 7,
  "simplicity": 9,
  "craft": 8,
  "verdict": "ship",
  "providers": ["claude", "thinktank", "codex", "gemini"]
}
```

- Scores (1–10) reflect cross-provider consensus, not any single reviewer.
- `pr` is the PR number, or `null` when reviewing a branch without a PR.
- `verdict`: `"ship"`, `"conditional"`, or `"dont-ship"`.
- `providers`: which tiers contributed.
- File is committed (not gitignored). `/groom` and `/flywheel` read it for
  quality trends.

## Verdict Ref

`scripts/lib/verdicts.sh` does not exist in linejam. Skip the
`verdict_write` step entirely — it is a Spellbook-only feature. Do not
attempt to source it; do not fabricate the script.

If `scripts/lib/verdicts.sh` is added in the future, record the verdict
as `refs/verdicts/<branch>` with SHA pinning per the Spellbook pattern.
Until then, `.groom/review-scores.ndjson` is the persistent record.

## Gotchas

- **Base branch is `master`, not `main`.** Cross-harness CLIs and Thinktank
  default to `main`; pass `--base origin/master` explicitly.
- **Self-review leniency.** Reviewers must be separate sub-agents, not the
  builder re-evaluating itself. The marshal never reviews its own fix.
- **Reviewing the whole repo.** Scope is `git diff origin/master...HEAD`,
  not the repo.
- **Skipping tiers.** Internal bench alone is same-model groupthink.
  Thinktank + cross-harness is the diversity guarantee; don't skip for
  speed.
- **Misreading a live Thinktank run.** `review.md`, `summary.md`, and
  `agents/*.md` appear late. Watch `trace/summary.json` and
  `trace/events.jsonl` for `run_completed`, not directory listings.
  `thinktank review eval` is broken in 6.3.0 — consume final stdout JSON
  or finished files.
- **Treating all concerns equally.** Blocking (correctness, security,
  invariant violation, ADR drift) gates shipping. Advisory doesn't.
- **Monoculture.** Same model across tiers defeats the point. Harness
  diversity matters.
- **Convex dev drift.** If the diff touches `convex/schema.ts` or
  `convex/_generated/api.d.ts` looks stale, ask the user to run
  `pnpm dev:convex` — never spawn a Convex dev process yourself.
- **Playwright flake ≠ code bug.** Before blaming the diff, check Clerk
  smoke-account drift and Convex dev deployment sync.
- **Fix-everything-on-encounter.** If the review surfaces a pre-existing
  issue in the same area as the diff (N+1 in `getRevealPhaseState`,
  unmigrated `lib/analytics.ts` event, missing ErrorBoundary on an
  adjacent component), require the fix in-PR. No "pre-existing, not my
  scope" excuses — boil the ocean.
