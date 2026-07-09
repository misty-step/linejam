---
title: Convex scheduled functions roll back with a throwing mutation — cap fan-out, never schedule-then-throw
tags:
  [
    convex,
    scheduler,
    mutation,
    transaction,
    rollback,
    cron,
    fan-out,
    error-reporting,
  ]
module: convex/abandonment.ts
problem_type: silent-total-failure
applies_when: a Convex mutation (especially a cron) schedules other functions via ctx.scheduler.runAfter, or reports errors by scheduling a reporter function
severity: P0
date: 2026-07-09
---

## Learning

`ctx.scheduler.runAfter` calls are part of the mutation's transaction. If the
mutation throws, every function it scheduled is rolled back along with its
writes. Two failure modes follow:

1. **Schedule-then-throw error reporting can never report.** A `catch` block
   that schedules an incident-reporter function and then rethrows guarantees
   the reporter is erased by the rollback. The error path is structurally
   silent, and unit tests that assert "reporter was scheduled" pass anyway.
   Report, then **return** an error result — in a cron, rethrowing buys
   nothing (the next tick retries regardless).
2. **Unbounded fan-out fails totally, not partially.** Convex rejects a
   mutation that schedules more than 1,000 functions. Over the limit, the
   throw + rollback means the sweep accomplishes _nothing_ each tick — not
   "the first 1,000". Cap scheduling per tick (a recurring cron drains the
   remainder) and bound the scan (`.take(N)`, index-ordered so the queue
   drains front-to-back).

## Evidence

- Incident: prod 2026-07-09. `abandonment:sweepAbandonedGames` (shipped
  2026-06-21, PR #264) met a 1000+ stranded-game backlog on its first prod
  tick, threw `Too many functions scheduled by this mutation (limit: 1000)`
  every minute for ~3 weeks, and completed zero games; its own catch block
  scheduled `internal.errors.reportBackendErrorToCanary` then rethrew, so no
  report ever fired.
- Fix: PR #328 (`misty-step/linejam`), commits b21c3b0 (branch) → squashed to
  master 2026-07-09. See `convex/abandonment.ts` (`MAX_FINISHERS_PER_SWEEP`,
  `MAX_SWEEP_SCAN`, report-then-return catch blocks).
- Verification: oldest stranded games (`_creationTime` ≈ 2025-12-02) read
  `COMPLETED` via `npx convex data games --prod --order asc` within ~15 min of
  deploy; no scheduler-limit errors in prod logs after.
- Regression test: `tests/convex/abandonment.test.ts` — "caps finishers per
  tick and drains the backlog across ticks".
- Doctrine: repo `AGENTS.md` Invariant 11 + "Scheduler Fan-Out and Error
  Reporting" code pattern.
- Postmortem: `docs/postmortems/2026-07-09-prod-env-and-sweep-outage.md`.

## Retrieval terms

convex scheduler rollback, runAfter transaction, too many functions scheduled,
schedule-then-throw, cron fan-out cap, error report rolled back
