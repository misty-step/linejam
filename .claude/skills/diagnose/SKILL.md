---
name: diagnose
description: |
  Investigate, audit, triage, and fix in linejam. Four-phase protocol (root
  cause → pattern → hypothesis → fix) anchored on Canary (incident sink),
  Convex dashboard logs, Dagger lane output, and `/api/health`. Use for any
  bug, test failure, Canary event spike, Dagger lane red, Playwright flake,
  reveal-phase lag, guest-join drop, or "why is this broken".
  Trigger: /diagnose.
argument-hint: <symptoms or domain> e.g. "guest join drops" or "audit auth"
---

# /diagnose (linejam)

Find the root cause in linejam's stack. Fix it. Prove it with Canary events,
Convex logs, or a green Dagger lane.

## Execution Stance

You are the executive orchestrator.

- Keep hypothesis ranking, root-cause proof, and fix selection on the lead model.
- Delegate bounded evidence gathering to focused `Explore` subagents.
- Run parallel hypothesis probes when multiple plausible causes exist.
- **Never spawn long-running processes yourself.** `pnpm dev`, `pnpm dev:convex`,
  `pnpm canary:responder` — ask the user to start these. Spawning a duplicate
  `convex dev` kills schema sync and breaks everyone's terminal.

## Routing

| Intent                                         | Sub-capability                           |
| ---------------------------------------------- | ---------------------------------------- |
| Debug a bug, test failure, unexpected behavior | This file (below)                        |
| Flaky Playwright/Vitest test                   | `references/flaky-test-investigation.md` |
| Canary-triggered incident lifecycle            | `references/triage.md`                   |
| Domain audit (auth, themes, AI provider)       | `references/audit.md`                    |
| Audit then fix highest priority issue          | `references/fix.md`                      |
| File findings into `backlog.d/`                | `references/log-issues.md`               |

If first argument is "triage", "incident", "postmortem", "production down",
or a Canary alert ID → `references/triage.md`.
If "flaky", "flake", "intermittent", "nondeterministic test" →
`references/flaky-test-investigation.md`.
If first argument matches a domain (auth, themes, ai, canary, dagger, convex) →
`references/audit.md`.
If "fix" → `references/fix.md`. If "log issues" → `references/log-issues.md`.
Otherwise, continue below.

**The user's symptoms:** $ARGUMENTS

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## Rule #1: Config Before Code

Linejam failures are usually **env-var drift across Vercel / Convex / local**,
not app bugs. Check in this order before reading any source file:

1. **Convex env vars** — `npx convex env list` (dev) or `npx convex env list --prod`.
   The critical four: `GUEST_TOKEN_SECRET`, `OPENROUTER_API_KEY`,
   `CLERK_JWT_ISSUER_DOMAIN`, `NEXT_PUBLIC_CONVEX_URL`.
2. **Vercel env vars** — `vercel env ls` (needs `vercel link`). Confirm
   `GUEST_TOKEN_SECRET` matches Convex byte-for-byte. Mismatch silently drops
   guest joins (Invariant #8).
3. **Local `.env.local`** — same parity check. Dagger loads `.env.local`
   after `.env.production.local`, so local overrides win.
4. **`/api/health`** — `curl -s http://localhost:3000/api/health | jq`.
   Reports Convex reachability, env-var presence, and Canary readiness
   **separately**. `observability.status: degraded` ≠ gameplay outage
   (known debt: health/Canary conflation).
5. **Canary endpoint reachable?** — `curl -I $CANARY_ENDPOINT`. If missing,
   browser errors never reach the sink.
6. **Then** examine code.

## The Four Phases

### Phase 1: Root Cause Investigation

Reproduce against live state before forming a hypothesis.

1. **Read full error** — stack trace, Convex request ID, Canary event ID.
   Don't truncate.
2. **Reproduce**:
   - Frontend bug → browser + `/api/health` + Canary event in the Canary dashboard.
   - Convex mutation bug → Convex dashboard logs (parsed JSON from
     `convex/lib/errors.ts` `log`/`logError`).
   - Dagger lane failure → run the specific lane, not the full `ci:dagger:all`.
     Example: `pnpm ci:dagger:unit-test` or `pnpm ci:dagger:e2e`.
   - Playwright flake → `pnpm test:e2e:ui` and watch the actual browser.
3. **Check recent changes** — `git log --oneline -10`,
   `git log --grep=<symptom> --all`, and `docs/adr/` for related decisions.
4. **Trace data flow to source**:
   - Frontend errors: `captureError()` in `lib/error.ts` →
     `lib/canary.ts` → Canary dashboard. Browser globals bridged by
     `components/CanaryClientObserver.tsx` (`window.error` +
     `unhandledrejection`). Request failures auto-captured in
     `instrumentation.ts` `onRequestError`.
   - Backend errors: `log`/`logError` in `convex/lib/errors.ts` emit
     structured JSON to stdout; Convex dashboard parses it. `service: 'convex'`
     tag distinguishes from Next.js logs (which use `lib/logger.ts`).
5. **Live-state verification** — any claim from before a compaction (e.g.
   "the Dagger lane was red") is a frozen hypothesis. Re-run the lane, re-read
   the Canary event, re-query `/api/health`. 30 seconds of verification beats
   an hour chasing a dead cause.

### Phase 2: Pattern Analysis

1. **Search prior fixes** — `git log --grep=<symptom>`,
   `git log --all -S '<specific-string>'`. Linejam has 90 days of
   `fix:` commits with useful precedent.
2. **Find working examples** — a broken Convex mutation usually has three
   working siblings in the same file. A broken `useQuery` call has a working
   one two components up.
3. **Check `docs/adr/`** — eight ADRs filed. If the behavior you're debugging
   is governed by a decision record, read it before deviating.
4. **Check `backlog.d/`** — authoritative backlog (not GitHub Issues).
   The bug may already be filed with a fix plan.

### Phase 3: Hypothesis and Testing

Scientific method. One experiment at a time. No stacking.

1. **Form single hypothesis** — "I think X causes Y because Z."
2. **Design experiment** — what would prove or disprove this? Smallest
   possible change, one variable only.
3. **Run experiment**:
   - Convex logic → `pnpm test --run <path>` (single file).
   - Dagger gate → the specific lane, not `ci:dagger:all`.
   - Real user flow → ask the user to reproduce with the app they already
     have running (do not start a second `pnpm dev`).
4. **Evaluate**:
   - **Disproved** → eliminate, form new hypothesis. Progress.
   - **Supported** → next experiment to increase confidence.
   - **Ambiguous** → experiment was too broad. Narrow and rerun.
5. **Repeat** until the full causal chain is explainable.

"Just try X" is a red flag. If you can't explain what you'll learn, you
don't understand the problem yet.

### Phase 4: Implementation

1. **Write failing test first** (unit or Playwright). Mock at system
   boundaries only — never mock `@/` or `../../` paths (Invariant #5).
2. **Verify test fails for the right reason** — not a syntax error, not a
   typo in the mock.
3. **Implement single fix** addressing the root cause.
4. **Verify**:
   - Unit: `pnpm test --run <path>`.
   - Gate: the relevant Dagger lane. Full `pnpm ci:prepush` before the
     commit goes out.
5. **Ship as `fix(<scope>): ...`** — Conventional Commits, base branch
   `master`. Never `git push --no-verify` (Invariant #1).

## Linejam Symptom Library

| Symptom                                                            | Likely root cause                                                                                             | Where to look                                                                                                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Guest join silently drops / guest appears in lobby then disappears | `GUEST_TOKEN_SECRET` mismatch across Vercel / Convex / local `.env.local` (Invariant #8)                      | `npx convex env list`, `vercel env ls`, `.env.local`. Validate byte-for-byte.                                                                          |
| `useQuery` returns `undefined` forever, no error                   | Convex dev not running (user's terminal) **or** schema mismatch in `convex/schema.ts` (Gotcha #1)             | Ask user to confirm `pnpm dev:convex` is running and the terminal is green. Do **not** spawn it yourself (Invariant #2).                               |
| Clerk redirect loop on protected route                             | `CLERK_JWT_ISSUER_DOMAIN` missing in Convex env, or the `convex` JWT template not provisioned in Clerk        | `npx convex env list \| grep CLERK`; Clerk dashboard → JWT templates. Dagger auto-provisions if `LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE=1`.          |
| Playwright E2E flake on auth (smoke or e2e lane)                   | Clerk smoke-account drift **or** Convex dev deployment out-of-sync with the branch (Gotcha #8)                | `PLAYWRIGHT_CLERK_TEST_EMAIL` value + the target Clerk tenant. Check both before blaming the test.                                                     |
| `pnpm ci:dagger:audit` red                                         | osv-scanner advisory on a dependency                                                                          | Read lane output for the CVE + package. Route to `/deps` for patching. Do not downgrade the gate.                                                      |
| Canary ingest silence (no new events despite errors)               | Webhook subscription lost or responder down                                                                   | `pnpm canary:webhook:setup` is rerunnable and converges on one subscription. Ask user if `pnpm canary:responder` is running.                           |
| `pnpm test` hangs indefinitely                                     | Infinite `while` loop without termination guard (Invariant #7)                                                | Binary-search the suite: `pnpm vitest run <path>`, comment out half, repeat.                                                                           |
| Word-count validation disagreement between client and server       | `lib/wordCount.ts` parity drift — usually a space-split edge case on hyphens or curly apostrophes (Gotcha #3) | One file. Client and server import the same module; if they're using different helpers, that **is** the bug.                                           |
| Reveal-phase UI lag                                                | Known N+1 author fetches in `getRevealPhaseState`                                                             | `convex/game.ts` `getRevealPhaseState`. Batch with `q.or()`; see Known Debts.                                                                          |
| Assignment matrix produces consecutive same-poem lines             | Derangement algorithm in `convex/lib/assignmentMatrix.ts` regressed                                           | That one file. Read it fully; this is load-bearing for game correctness.                                                                               |
| Theme flicker / wrong tokens on mount                              | `ThemeProvider` hydration race **or** test leakage between files (Gotcha #6)                                  | `lib/themes/` + `tests/setup.ts`. Theme context is global; tests must clean up.                                                                        |
| Vitest fork teardown hang on Node 22                               | Pool config regression                                                                                        | `vitest.config.ts` — pool must stay `threads` with `maxWorkers: 1` (Gotcha #7). Do not change speculatively.                                           |
| "Git push is failing. Investigate and fix."                        | Pre-push hook ran `pnpm ci:prepush` and a Dagger lane went red                                                | Read the Dagger lane output, not the hook output. Never propose `--no-verify`. The gate **is** the contract.                                           |
| `/api/health` reports `unhealthy` but app works                    | Convex ping timed out (1500ms) or an env check returned false                                                 | `app/api/health/route.ts` — `convex` field vs `env` block. `canaryIngestKey: false` is degraded observability, **not** a gameplay outage (known debt). |
| Canary event arrived but no evidence bundle                        | Responder didn't persist (disk full, retention pruned)                                                        | `.canary/deliveries/`, `.canary/contexts/`, `.canary/smoke/`, `.canary/summaries/`. Retention is `LINEJAM_CANARY_RETENTION_DAYS` (default 14).         |

## Sub-Agent Patterns

### Quick investigation (default)

Spawn one `Explore` subagent with a bounded objective: reproduce the symptom,
trace data flow from the failure point backward to the source, and report
root cause + evidence + proposed fix. **It does not implement.** You review,
decide if the root cause is proven, then dispatch `builder` for the fix.

### Multi-Hypothesis Mode

When >2 plausible causes and a single investigation would anchor on one,
dispatch parallel `Explore` subagents — one per hypothesis. Each proves or
disproves by tracing a specific subsystem (Convex logs, Canary events,
Dagger lane, Playwright trace). They report confirmed/disproved + evidence.
You synthesize into a consensus root cause, then dispatch `builder`.

Use when: ambiguous stack trace, multiple services implicated, Canary event
with unclear origin, Playwright flake that could be Clerk or Convex.
Don't use when: obvious single cause, config drift, simple regression
with a `git blame` pointing at one commit.

### What you keep vs what you delegate

| You (lead)                           | Sub-agents (investigators)                               |
| ------------------------------------ | -------------------------------------------------------- |
| Ranking hypotheses                   | Tracing one subsystem end-to-end                         |
| Declaring root cause proven          | Comparing working vs broken call sites                   |
| Choosing the fix                     | Gathering Canary events, Convex logs, Dagger lane output |
| Deciding when evidence is sufficient | Running targeted single-file tests                       |

Available named subagents: `planner`, `builder`, `critic`, `beck`, `carmack`,
`grug`, `ousterhout`, `a11y-auditor`, `a11y-critic`, `a11y-fixer`. For
ad-hoc investigation, use `Explore` type (read-only).

## Instrumented Reproduction Loop

When the bug is auth-gated, timing-dependent, or only reproduces in the
user's session (you cannot trigger it yourself):

```
INSTRUMENT → USER REPRODUCES → READ LOGS → REFINE → REPEAT
```

1. **Hypothesize** — form 2–3 candidate causes from symptoms.
2. **Instrument** — use the repo's existing logging surfaces, not ad-hoc
   `console.log`:
   - Frontend: `log.debug()` / `log.info()` from `lib/logger.ts` (structured
     JSON, parsed by Vercel).
   - Backend: `log.debug()` / `log.info()` / `logError()` from
     `convex/lib/errors.ts` (structured JSON, parsed by Convex dashboard).
   - Tag each line with the hypothesis it tests:
     `log.debug('guest-join', { hypothesis: 'H1', tokenExp: token.exp })`.
   - For frontend errors you want in Canary, call `captureError(err, { ... })`
     from `lib/error.ts` — do not call `captureCanaryException` directly from
     app code (Canary lives behind the `lib/error.ts` facade for a reason).
3. **Hand off** — tell the user: "Reproduce the bug, then share the Convex
   dashboard URL / Canary event ID / browser console / `/api/health` response."
4. **Read & analyze** — for each hypothesis: supported → narrow further;
   disproved → eliminate and remove its instrumentation; insufficient →
   add targeted logging at the next layer.
5. **Iterate** — max 3 rounds. If still ambiguous, escalate to
   Multi-Hypothesis Mode with parallel subagents.
6. **Clean up** — remove all instrumentation before shipping the fix.
   Instrumentation is diagnostic, not production code. Commit the cleanup
   atomically.

## Root Cause Discipline

For each hypothesis, categorize:

- **ROOT** — fixing this removes the fundamental cause.
- **SYMPTOM** — fixing this masks an underlying issue.

Post-fix question: "If we revert in 6 months, does the problem return?"
If yes, you fixed a symptom.

Fix-everything-on-encounter mandate applies: if you touched a file, fix the
pre-existing issues in that file too. Never ship a PR that says "pre-existing,
not my scope". If it's broken and you touched it, fix it.

## Demand Observable Proof

Before declaring "fixed", show at least one:

- Canary event type that was firing now stopped (dashboard screenshot or
  event-ID timeline).
- Convex log pattern that changed (structured JSON from `logError` no longer
  appearing at the same cadence).
- Dagger lane transition red → green (`pnpm ci:dagger:<lane>` exit 0).
- `/api/health` field that flipped (e.g. `convex: "unreachable" → "connected"`).
- Failing test now green and a new test that pins the regression closed.

Mark as **UNVERIFIED** until observables confirm. "Looks right to me" is
not proof.

## Classification

| Type                      | Signals                                              | Approach                                                                                          |
| ------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Vitest failure            | Assertion error                                      | Read test, trace expectation, fix code or fix test (not both)                                     |
| Playwright flake          | Pass-on-retry, Clerk redirect                        | Gotcha #8 first (Clerk account drift or Convex out-of-sync)                                       |
| Convex runtime error      | `convex/lib/errors.ts` `logError` JSON in dashboard  | Read the `context` block; it carries `roomId`/`userId`/`round`                                    |
| Type error                | `pnpm typecheck` complaint                           | Check if `convex/_generated/api.d.ts` is stale — ask user to confirm `pnpm dev:convex` is running |
| Dagger lane red           | `pnpm ci:dagger:<lane>` non-zero exit                | Read the lane output. Do not propose local workarounds. The gate is the contract.                 |
| Canary event spike        | New event type or frequency jump in Canary dashboard | `references/triage.md` — create an INCIDENT entry                                                 |
| `/api/health` degraded    | Endpoint returns 503                                 | Check `convex` field first, then env block. Canary `degraded` alone is not a 503 trigger.         |
| Guest-join regression     | Players can't join room                              | `GUEST_TOKEN_SECRET` parity (Invariant #8) before anything else                                   |
| Reveal-phase slow         | Users report lag on round 9                          | Known N+1 in `convex/game.ts getRevealPhaseState` — batch with `q.or()`                           |
| AI player doesn't respond | No AI line generated                                 | `OPENROUTER_API_KEY` in Convex env; retries in `convex/ai.ts`; OpenRouter rate limit              |

## Investigation Work Log (non-trivial incidents)

For Canary-escalated incidents or anything that takes >30 minutes, file
`INCIDENT-{timestamp}.md` in the working copy (do not commit; artifacts are
for the session):

- **Timeline** (UTC) — Canary event time, first repro, each hypothesis test.
- **Evidence** — Canary event IDs, Convex request IDs, Dagger lane runs,
  `/api/health` snapshots.
- **Hypotheses** — ranked, with categorization (ROOT vs SYMPTOM).
- **Actions** — what tried, what learned, what was eliminated.
- **Root cause** — once proven.
- **Fix** — the commit that resolved it, plus the observable that confirms.

After resolution, if the incident revealed a gap in this skill, patch this
file. Session errors are system errors (Norman Principle).

## Red Flags — STOP and Return to Phase 1

- "Quick fix for now, investigate later."
- "Just try changing X and see."
- Multiple simultaneous changes in one experiment.
- Proposing solutions before tracing data flow.
- "One more fix attempt" (when 2+ already failed — 2-failure rule).
- Third edit to the same file this session (3-edit rule — re-read and plan).
- Excusing a broken thing as "pre-existing, not my scope" (user mandate:
  fix-everything-on-encounter).
- Proposing `git push --no-verify` (Invariant #1 — forbidden).
- Proposing to spawn `pnpm dev` / `pnpm dev:convex` yourself (Invariant #2
  — ask the user).

## Toolkit

- **Incident sink**: Canary dashboard + `.canary/` evidence artifacts
  (`deliveries/`, `contexts/`, `smoke/`, `summaries/`).
- **Convex dashboard**: parsed structured logs from `log`/`logError`.
- **`/api/health`**: `curl -s localhost:3000/api/health | jq` — app health,
  Convex reachability, env-var presence, Canary readiness.
- **Dagger lanes**: `pnpm ci:dagger:{lint,typecheck,unit-test,e2e,audit,
secret-scan,smoke,all-no-e2e,all}` — run the narrowest lane that
  reproduces the failure.
- **Git archaeology**: `git log --grep=<symptom>`, `git log -S '<string>'`,
  `git bisect` for regressions across a known-good range.
- **Subagents**: parallel `Explore` for multi-hypothesis, `builder` for
  implementation, `critic` for review.
- **`/research thinktank`**: multi-model hypothesis validation for
  architectural calls.

## Output

- **Root cause** — what's actually wrong, with the file/line or env-var
  citation.
- **Fix** — the commit + the change, in one or two sentences.
- **Verification** — the observable: Canary event stopped, Convex log
  pattern gone, Dagger lane green, `/api/health` field flipped, new test
  pins the regression.

## Gotchas

- **Fixing before investigating.** The #1 failure mode. If you haven't
  traced data flow from the failure back to the source, you don't know
  the root cause.
- **Stacking changes.** One variable per experiment. Multiple simultaneous
  changes make results uninterpretable.
- **Confusing symptom for root cause.** "The Playwright test fails" is a
  symptom. "The Clerk smoke account was manually deleted from the dev tenant
  last Tuesday" is a root cause.
- **Skipping reproduction.** If you can't reproduce it against live state,
  you can't verify the fix. Gather more data first.
- **Missing Canary ≠ gameplay outage.** `/api/health`
  `observability.status: degraded` with `status: ok` and
  `convex: connected` means the incident sink is down, not the app.
  Don't page on degraded observability as if the game is offline.
- **`convex/_generated/api.d.ts` drift.** If types suddenly mismatch the
  call site, the generated file is stale. Ask the user to confirm
  `pnpm dev:convex` is running and the terminal is green — don't spawn
  it yourself.
- **Playwright flake ≠ test bug.** Clerk smoke-account drift and Convex
  dev out-of-sync cause 9 out of 10 flakes. Check those before opening
  the Playwright trace.
- **Dagger red is the contract, not a nuisance.** Don't propose
  `--no-verify`. Read the failing lane's output and fix what it says.
- **PostHog is not an error tracker.** It's product analytics.
  `captureError` → Canary. If you find yourself reaching for PostHog to
  diagnose an error, you're looking at the wrong surface.
