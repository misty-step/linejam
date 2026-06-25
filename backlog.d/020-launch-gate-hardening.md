# Harden the app for public exposure: security headers, abuse + cost controls

Priority: P0 · Status: ready · Estimate: L

## Goal

Linejam can be promoted publicly without a runaway OpenRouter bill,
clickjacking/XSS exposure, or a blind outage — meeting the project.md Quality
Bar gate "security headers and rate limits in place before public promotion."

## Oracle

- [ ] A fresh production request returns CSP, HSTS, X-Frame-Options/frame-ancestors,
      X-Content-Type-Options, Referrer-Policy, and a tight Permissions-Policy
      (set once in `next.config.ts` `headers()`).
- [ ] A scripted loop of guest-session-mint → createRoom → addAiPlayer → startGame
      is throttled (429 / ConvexError) and cannot drive more than a fixed budget
      of OpenRouter calls: a per-IP throttle on `GET /api/guest/session` plus a
      global daily AI call/cost budget that flips new AI turns to the
      deterministic fallback when exceeded.
- [ ] Rate limiting covers the abuse-relevant mutations (createRoom, joinRoom,
      startGame, submitLine, addAiPlayer), IP-bucketed — not only `user._id`
      (which a guest can mint for free).
- [ ] The guest token is no longer mirrored into localStorage (httpOnly cookie is
      the sole carrier); its 30-day TTL is shortened and a revocation path exists.
- [ ] A `rateLimits` cleanup cron sweeps expired rows (`by_reset_time`).
- [ ] `/api/health` is polled by a committed external monitor that pages on 503.

## Verification System

- Claim: a public, unauthenticated attacker cannot run up unbounded LLM cost,
  clickjack the app, or take it down unseen.
- Falsifier: a script minting N guests creates N rooms each firing ~9 OpenRouter
  calls with no global cap; or curl shows missing security headers; or an outage
  emits no page.
- Driver: an abuse script (mint→create→start loop) + a header curl + a forced
  budget-breach test.
- Grader: header assertion passes; the budget counter flips new turns to
  fallback; the throttle returns 429.
- Evidence packet: curl header dump, abuse-script run showing throttle,
  budget-breach test output, monitor screenshot.
- Cadence: re-run before public launch; the header check rides the merge-gate.

## Notes

Convergent finding across the security, runtime-reliability, and ops grooming
lanes. Today: zero security headers (`next.config.ts` has no `headers()`); rate
limiting covers only 2 of 16 mutations keyed on `user._id`
(`convex/lib/rateLimit.ts`, `convex/rooms.ts:43`); `GET /api/guest/session` mints
guests unthrottled (`app/api/guest/session/route.ts`); no global OpenRouter
budget or circuit-breaker (`convex/ai.ts`, `convex/lib/ai/providers/openrouter.ts`);
guest token mirrored to localStorage (`lib/guestSession.ts`), 30-day TTL, no
revocation; `rateLimits` table never swept; no uptime poller.

NOTE: the 2 critical + 11 high Dependabot alerts are STALE false positives —
already remediated via `pnpm.overrides` (verified one-version-per-package in
`pnpm-lock.yaml`). The action is an ops re-trigger of the Dependabot scan, NOT
engineering work; explicitly out of scope. The openrouter prompt-injection
(`previousLineText` unescaped) remains an accepted/deprioritized risk — out of
scope.

## Children

1. (S, ship first) Global OpenRouter daily call/cost budget + per-IP throttle on
   `/api/guest/session` — the real-money launch blocker.
2. (S) Security headers in `next.config.ts` `headers()`.
3. (S) Extend rate limiting to abuse-relevant mutations, IP-bucketed.
4. (S) Drop the localStorage guest-token mirror; shorten TTL; add revocation.
5. (XS) `rateLimits` cleanup cron.
6. (S) Wire an external uptime monitor polling `/api/health` with paging.
