# Make the launch read paths index-backed and the live game crash-resilient

Priority: P1 · Status: ready · Estimate: L

## Goal

The busiest public surface (landing/auth page) and the live game stay within
Convex read/scan limits and degrade gracefully under load instead of
full-table-scanning or white-screening the whole room.

## Oracle

- [ ] `getRecentPublicPoems` no longer full-table-scans: `rooms` gains a
      `by_status` (or `by_status_completedAt`) index and the poems/lines fan-out
      uses indexed lookups, not `q.or()` `.filter()` scans.
- [ ] A single failing `useQuery` degrades only its panel, not the whole room —
      a per-surface React `ErrorBoundary` around live game panels with retry UX
      (not the `app/error.tsx` full-screen reset).
- [ ] AI generation issues at most one in-flight OpenRouter call per (game, round)
      — a dedup/in-flight marker so re-nudges don't fan out — plus a
      circuit-breaker when OpenRouter is down.
- [ ] History queries (`getMyPoems`, community archive) are page-windowed, not
      lifetime `.collect()`.
- [ ] A synthetic many-room / busy-session load run shows Convex read counts and
      OpenRouter QPS within limits.

## Verification System

- Claim: the app stays responsive and recoverable under launch-scale traffic and
  partial failure.
- Falsifier: the landing query scan grows with total rooms ever created; one
  query error blanks the room; N human submits fan out to N OpenRouter calls for
  one cell.
- Driver: a synthetic load script (many completed rooms + a busy multi-room
  session) + a query-error injection.
- Grader: Convex function read-count dashboard, OpenRouter QPS, observed
  per-panel error isolation.
- Evidence packet: load-run metrics + an error-injection screenshot showing one
  degraded panel.
- Cadence: before launch; the index/error-boundary changes ride the normal gate.

## Notes

From the runtime-reliability lane. `getRecentPublicPoems` (`convex/archive.ts:219`)
runs three full-table scans and is called unauthenticated from
`components/auth/AuthShowcase.tsx` on the landing/auth pages — the busiest surface
at launch. No React `ErrorBoundary` exists anywhere (only `app/error.tsx`);
`useQuery` in Convex 1.x throws on error. AI re-nudge
(`convex/lib/sessionLifecycle.ts:166`) schedules a fresh generation per human
submit. The abandonment/never-die subsystem verified clean — no work there.
Shares the cost-cap/circuit-breaker concern with [020]; coordinate the AI
in-flight marker so it isn't built twice.
