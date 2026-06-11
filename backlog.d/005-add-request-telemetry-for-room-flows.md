# Add Request Telemetry For Room Flows

Priority: P1
Status: ready
Estimate: M

## Goal

Emit structured, scrubbed request-level telemetry for the guest session, health, and room entry flows so production failures can be diagnosed without replaying them locally or leaking bearer/session data.

## Non-Goals

- Full distributed tracing rollout
- Broader observability vendor or analytics stack redesign
- Analytics redesign for every route

## Oracle

- [ ] `pnpm vitest run tests/app/api/health.test.ts tests/lib/error.test.ts`
- [ ] New room/guest-session request logs include method, route, status, and duration.
- [ ] New failure paths capture enough context to correlate request failures in production.
- [ ] Canary capture receives only the scrubbed context returned by `scrubCanaryContext`; a regression test proves `guestToken`, display names, and raw request payloads are not sent.
- [ ] `/test-error` is deleted or gated to non-production/authenticated use, and `robots.ts` no longer carries a public test-route exception.
- [ ] No new silent `catch {}` paths are introduced.

## Notes

- Observability exists, but there is no request-level access signal for the critical guest/session flows.
- Keep logging targeted: enough to debug production issues, not noisy exhaust.
- Current bug-level risk: `lib/errorCore.ts` computes `scrubbedContext` but calls `captureCanaryException(error, context)`, while `app/host/page.tsx` passes `guestToken` on create-room failure.

## Repo Anchors

- `app/api/health/route.ts`
- `app/api/guest/session/route.ts`
- `app/test-error/page.tsx`
- `app/robots.ts`
- `lib/errorCore.ts`
- `lib/canaryCore.ts`
- `lib/logger.ts`
- `lib/error.ts`
