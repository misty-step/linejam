# Add Request Telemetry For Room Flows

Priority: P1
Status: done
Estimate: M

## Goal

Emit structured, scrubbed request-level telemetry for the guest session, health, and room entry flows so production failures can be diagnosed without replaying them locally or leaking bearer/session data.

## Non-Goals

- Full distributed tracing rollout
- Broader observability vendor or analytics stack redesign
- Analytics redesign for every route

## Oracle

- [x] `pnpm vitest run tests/app/api/health.test.ts tests/lib/error.test.ts`
- [x] New room/guest-session request logs include method, route, status, and duration.
- [x] New failure paths capture enough context to correlate request failures in production.
- [x] Canary capture receives only the scrubbed context returned by `scrubCanaryContext`; a regression test proves `guestToken`, display names, and raw request payloads are not sent.
- [x] `/test-error` is deleted or gated to non-production/authenticated use, and `robots.ts` no longer carries a public test-route exception.
- [x] No new silent `catch {}` paths are introduced.

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

## What Was Built

- Added structured JSON request telemetry for `/api/health` and `/api/guest/session` with method, route, status, duration, and safe operation/result metadata.
- Fixed `captureReportedError` so enabled Canary transports receive the scrubbed context rather than the original caller context.
- Extended Canary's safe context allowlist for request status and duration metadata.
- Replaced the guest-session invalid-token silent catch with scrubbed warning telemetry.
- Deleted the public `/test-error` page and removed the matching robots exception.
- Documented the route telemetry privacy contract.

## Verification

- `pnpm vitest run tests/app/api/health.test.ts tests/app/api/guest-session.test.ts tests/lib/error.test.ts tests/lib/canary.test.ts tests/lib/canaryServer.test.ts tests/lib/errorServer.test.ts tests/lib/logger.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:ci`
- `pnpm ci:prepush`

## Workarounds

- None.
