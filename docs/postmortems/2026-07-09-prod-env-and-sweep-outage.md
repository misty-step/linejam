# Postmortem: prod AI surface dead + abandonment backstop wedged (2026-07-09)

**Status:** resolved (env restored 2026-07-09 ~22:05 UTC; code fixes in PR #328)
**Severity:** P0 product degradation + P0 reliability-system failure, zero paging
**Author:** orchestrator (Claude Code), incident diagnosis session 2026-07-09

## Summary

Production Linejam ran for at least two days with the Convex prod deployment
missing `OPENROUTER_API_KEY` and `CANARY_API_KEY`. Every AI-player and
ghostwriter line silently degraded to the canned fallback wordlist — the AI
surface, a headline feature, was 100% dead while the app looked healthy.
Independently, the "never let the room die" abandonment sweep
(`abandonment:sweepAbandonedGames`, shipped 2026-06-21 in PR #264) had **never
completed a single successful production tick**: a backlog of 1000+ stranded
games (accumulated since December 2025, before the backstop existed) pushed
the unbounded sweep over Convex's 1,000-scheduled-functions-per-mutation
limit. The mutation threw every minute, and the transaction rollback erased
every finisher it had scheduled — so it completed zero games, forever. No
alert fired for either failure: backend Canary reporting required the missing
`CANARY_API_KEY`, _and_ both mutations scheduled their error report and then
rethrew — a throwing Convex mutation rolls back its scheduled functions, so
the report could never fire even with the key present. `/api/health` only
proved Convex connectivity, so the 5-minute Production Health Monitor and
prod smoke stayed green throughout.

The human-only game loop was never down: rooms, rounds, reveal, ghost-fill
fallbacks all worked (verified by a full live playthrough, room `IXSL`).

## Timeline (UTC)

| When               | What                                                                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-12 → 2026-06  | Stranded `IN_PROGRESS` games accumulate (no backstop exists yet); oldest observed game `_creationTime` ≈ 2025-12-02                                                                                                                                |
| 2026-06-21         | PR #264 ships the abandonment sweep. First prod tick meets a >1000-game backlog, exceeds the scheduler limit, throws; every subsequent tick fails identically. The scheduled Canary error report is rolled back with the transaction — silence     |
| ≤2026-07-07 18:19  | Prod Convex env is missing `OPENROUTER_API_KEY` and `CANARY_API_KEY` (module-load log stamp `2026-07-07T18:19:29Z` marks functions loading with the key already absent; removal mechanism unconfirmed — see follow-up F1)                          |
| 2026-07-07 → 07-09 | All AI/ghostwriter lines come from `fallbacks.ts`; logs spam `OPENROUTER_API_KEY not configured at module load` on every function call; sweep fails every minute; all monitors green                                                               |
| 2026-07-09 ~21:40  | Operator reports "Linejam fully busted in production"                                                                                                                                                                                              |
| 2026-07-09 21:53   | Diagnosis confirms: prod env has only 3 vars; sweep throwing `Too many functions scheduled by this mutation (limit: 1000)`; `amiable-bulldog-848.convex.site/api/health` returning 500 `aiLineGeneration: missing_required` with nobody polling it |
| 2026-07-09 22:04   | Mitigation: `OPENROUTER_API_KEY` (from dev deployment) and `CANARY_API_KEY` (from `.env.local`) set on prod. Convex env health flips to 200                                                                                                        |
| 2026-07-09 22:07   | Live verification: fresh bot game (room `XGCN`) produces `AI response received` from `google/gemini-2.5-flash-lite`                                                                                                                                |
| 2026-07-09 ~22:30  | PR #328: bounded sweep + report-without-rethrow + health federation; auto-merge armed on merge-gate                                                                                                                                                |

## Root causes

1. **ROOT (config): prod Convex env missing required keys.** How they went
   missing is unconfirmed (no repo commit correlates; Convex dashboard audit
   log check is follow-up F1). The system had no defense: nothing validated
   the prod env against a manifest of required keys, at deploy time or after.
2. **ROOT (code): unbounded fan-out in `sweepAbandonedGames`.** The design
   review explicitly considered scan starvation and rejected a batch cap —
   optimizing against the wrong failure. Platform limits (1,000 scheduled
   functions per mutation) made unboundedness a hard cliff, and the
   transactional rollback made partial progress impossible: over the cliff,
   the sweep does _nothing_ rather than _something_.
3. **ROOT (code): schedule-then-throw error reporting.** In a transactional
   mutation, scheduling the incident report and then rethrowing guarantees the
   report is rolled back. The error path was structurally incapable of ever
   reporting. This is invisible in unit tests that assert "report was
   scheduled" — only the transactional semantics kill it.
4. **ROOT (observability design): health checks proved liveness, not
   capability.** `/api/health` checked Next.js env booleans + Convex
   connectivity. The Convex deployment had a self-aware env-health endpoint
   returning 500 the whole time — unfederated, unpolled. Green dashboards
   measured "the process is up", not "the product works".

## Five whys (condensed)

Why was the AI surface dead? → prod env lost its key. Why did that persist
for days? → no monitor gated on capability, only on liveness. Why did the
sweep failure persist for weeks? → its error reporting rolled back with its
transaction, and Canary ingest lacked its key anyway. Why did a
"thermonuclear-reviewed" reliability feature never work in prod? → review
tested logic against small fixtures, never against production-scale data or
platform limits; there was no first-tick-in-prod verification. Why did no
gate catch any of this? → every gate (unit, E2E, smoke, health) exercised
fresh, small, correctly-configured state; none measured degraded-but-alive.

## What went well

- The layered "never let the room die" design meant the _user-facing_ floor
  held: idempotent `commitAssignedLine` + per-turn ghost-fill kept live games
  completing even with the cron backstop dead and the LLM gone.
- The fallback wordlist made LLM loss invisible to players mid-game (also a
  what-went-wrong: it made it invisible to us).
- Convex module-load logging left an exact timestamp for when the env went
  bad — that stamp was the single best forensic artifact.

## What went wrong

- Silent degradation everywhere: fallbacks without alerts, health without
  capability checks, error reports that structurally couldn't fire.
- A reliability feature shipped without proof it worked against real
  production state ("validates is not acceptance").
- Prod env vars are unmanaged state: hand-set, unversioned, unaudited,
  unreconciled.

## Fixes (this incident)

- Env keys restored on prod (verified live; see timeline).
- PR #328: sweep bounded (`MAX_FINISHERS_PER_SWEEP=200`/tick, scan capped at
  1000, oldest-first drain); both abandonment mutations report-then-return
  instead of report-then-throw; `/api/health` now federates the Convex
  capability report and 503s on `missing_required` — the existing 5-minute
  monitor now pages on missing prod env with no new infrastructure.

## Prevention follow-ups

- **F1 (operator):** check the Convex dashboard audit log for
  `amiable-bulldog-848` to date/attribute the env-var loss.
- **F2:** env manifest reconciliation — CI/deploy step that diffs prod Convex
  env _names_ against a committed manifest (`convex env list` is already
  agent-safe) and fails loudly on drift, so a missing key is caught at the
  next deploy rather than by a player.
- **F3:** alert on fallback-rate — a fallback line is an incident signal, not
  just a UX blur; emit a Canary event when `getFallbackLine` covers an LLM
  failure in prod, alert past a threshold.
- **F4:** drain-verification — after #328 deploys, watch
  `Abandonment sweep scheduled stranded games for completion` until the
  backlog reads 0; then the sweep's steady-state `scheduled` should be ≈0.
- **F5 (doctrine):** for any scheduled/cron mutation: (a) every fan-out is
  bounded and the bound is tested; (b) error reporting must survive the
  failure it reports (never schedule-then-throw in a transaction); (c) a
  feature that exists to handle pathological state must be verified against
  production-scale pathological state before "done".
