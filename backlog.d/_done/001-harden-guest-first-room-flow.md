# Harden Guest-First Room Flow

Priority: high
Status: done
Estimate: M

## Goal

Make guest auth and room-state failures fail loud with actionable recovery instead of silent redirects, blank states, or stale token behavior.

## Non-Goals

- Redesign lobby, reveal, or archive layouts
- Extract the full game-transition orchestrator
- Change the guest-token format or Convex auth model
- Add new third-party observability vendors

## Oracle

- [x] `pnpm vitest run tests/lib/auth.test.ts tests/app/api/guest-session.test.ts tests/app/auth-callback-page.test.tsx tests/app/room-page.test.tsx`
- [x] Failed guest-to-user migration keeps the user on `/callback`, shows a recovery state, and captures the error.
- [x] Unexpected room status renders an explicit recovery UI instead of falling through to an empty page.
- [x] Guest-session bootstrap failures clear stale local guest state before surfacing the existing connection error message.

## Notes

- Primary evidence:
  `app/(auth)/callback/page.tsx`, `app/room/[code]/page.tsx`, `lib/auth.ts`, `lib/guestSession.ts`, `app/api/guest/session/route.ts`.
- Existing tests already cover the hook and API route; this item should add page-level tests rather than widening end-to-end scope.
- Keep the fix surgical: explicit state handling, no broad auth refactor.

## Implementation Sequence

1. Add failing tests for callback failure handling and unexpected room status rendering.
2. Clear stale guest session state on guest bootstrap failure.
3. Replace silent callback redirect-on-error with explicit recovery UI and instrumentation.
4. Add an explicit unexpected-status room fallback that guides the player back to safety.

## Repo Anchors

- `app/(auth)/callback/page.tsx`
- `app/room/[code]/page.tsx`
- `components/AuthErrorState.tsx`
- `lib/auth.ts`
- `lib/guestSession.ts`

## What Was Built

- Cleared stale guest session state in `useUser()` whenever guest bootstrap fails.
- Reworked `/callback` to keep migration failures on-page with explicit recovery actions instead of silently redirecting home.
- Added an explicit fallback state for unknown room statuses and capture that state for observability.
- Added page-level tests for callback recovery and unknown room status handling.

## Verification

- `pnpm vitest run tests/lib/auth.test.ts tests/app/api/guest-session.test.ts tests/app/auth-callback-page.test.tsx tests/app/room-page.test.tsx`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Workarounds

- `pnpm build:check` still requires real environment variables (`GUEST_TOKEN_SECRET`, `NEXT_PUBLIC_CONVEX_URL`). The code change did not introduce a new build failure, but this check cannot pass in an unconfigured worktree.
