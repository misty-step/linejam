# ADR-0011: Backend on a Cloudflare Durable Object

## Status

Accepted (2026-10-15). The backend ships dormant. Production cutover follows
the steps below.

## Context

Linejam's web app runs on the Cloudflare Worker `linejam` (OpenNext). Its
backend runs on Convex Cloud (`amiable-bulldog-848`). The Misty Step hosting
contract (t_85dd26dc) puts every app-serving boundary on Cloudflare, including
hosted databases and realtime backends. The Convex modules in `convex/` hold
all game rules, rate limits, retention and abandonment logic, and the clients
use `convex/react` and `convex/browser`.

## Decision

1. **Same modules, new host.** Serve the unchanged `convex/` modules, schema,
   crons, HTTP routes and `auth.config.ts` from one SQLite Durable Object, using
   Parlor's `@parlor/cloudflare` adapter. The adapter's protocol contract is
   Parlor ADR 0001, and the adapter is vendored under
   `vendor/parlor/integrations/cloudflare`. It keeps Convex document IDs,
   transactions, indexes, reactive queries, the scheduler and crons.
2. **Same Worker, same origin.** `cloudflare/worker.ts` is the Wrangler entry.
   It sends `/backend/*` to the `LinejamBackend` object
   (`cloudflare/backend.ts`) and everything else to the OpenNext build. The
   clients' Convex URL becomes `https://linejam.mistystep.io/backend`, so no DNS
   change, zone or CORS rule is needed. Convex env names the Worker already
   holds under web names (`SENTRY_DSN`, `SENTRY_RELEASE`) are aliased in
   `cloudflare/backend.ts`. The static ones are Wrangler vars.
3. **Lazy modules.** `scripts/generate-backend-modules.mjs` writes
   `cloudflare/modules.generated.ts`, which lazily imports each module, as
   Convex loads them. A module that fails at import, such as `lib/guestToken.ts`
   without `GUEST_TOKEN_SECRET`, then fails only its own functions, not the
   Worker.
4. **Proof by the existing suite.** `pnpm test:backend:cloudflare` runs every
   test in `tests/convex` against the adapter, with `convex-test` aliased to
   `@parlor/cloudflare/testing`.
5. **Fail-closed rollout.** A new backend starts with writes frozen.
6. **Cutover steps.**
   1. Deploy with the backend dormant, while the web still uses Convex.
   2. Pause `amiable-bulldog-848`, which stops its writers and crons.
   3. Export a snapshot and import it through the admin routes, which keeps
      IDs and creation times.
   4. Require the canonical per-table SHA-256 values of the snapshot and the
      object to be equal.
   5. Unfreeze the object.
   6. Deploy the build whose `NEXT_PUBLIC_CONVEX_URL` is `/backend`.
   7. Keep Convex paused and intact as the rollback target. A rollback exports
      from the object, imports into Convex with `--replace`, unpauses it, and
      redeploys the previous Worker version, so accepted writes are retained.

## Consequences

- One Worker deploy now ships the web and backend versions together, so they
  cannot skew.
- Linejam's backend capacity is that of one Durable Object. That is ample for
  party-game write rates, but it is not horizontally scalable.
- `RETENTION_GC_ENABLED` must be carried over at cutover. While it is unset,
  retention runs in dry-run mode and deletes nothing.
- A new or changed Convex module needs `node scripts/generate-backend-modules.mjs`.
  `pnpm backend:modules:check` catches a stale map.

## Alternatives considered

- **Rewrite on D1 and a bespoke Worker API.** This forks every game rule,
  breaks the realtime client and loses transactional reactivity.
- **Self-host the Convex backend.** That is not Cloudflare hosting, and the
  contract rules out exe.dev hosting.
- **A separate backend Worker on its own hostname.** This adds a deploy unit, a
  CORS surface and version skew for no gain.
