# Add Request Telemetry For Room Flows

Priority: medium
Status: ready
Estimate: M

## Goal

Emit structured request-level telemetry for the guest session, health, and room entry flows so production failures can be diagnosed without replaying them locally.

## Non-Goals

- Full distributed tracing rollout
- Broader observability vendor or analytics stack redesign
- Analytics redesign for every route

## Oracle

- [ ] `pnpm vitest run tests/app/api/health.test.ts tests/lib/error.test.ts`
- [ ] New room/guest-session request logs include method, route, status, and duration.
- [ ] New failure paths capture enough context to correlate request failures in production.
- [ ] No new silent `catch {}` paths are introduced.

## Notes

- Observability exists, but there is no request-level access signal for the critical guest/session flows.
- Keep logging targeted: enough to debug production issues, not noisy exhaust.

## Repo Anchors

- `app/api/health/route.ts`
- `app/api/guest/session/route.ts`
- `lib/logger.ts`
- `lib/error.ts`
