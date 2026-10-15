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
   Parlor ADR 0002, and the adapter is vendored under
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
5. **Fail-closed rollout.** A new backend starts with writes frozen. While
   frozen, the object admits no mutation, action, HTTP action, scheduled
   function or cron, and it cannot be unfrozen while an import is pending
   (Parlor ADR 0002, Operations). Exactly one backend accepts writes at any
   time.
6. **Cutover steps.**
   1. Deploy with the backend dormant, while the web still uses Convex. This
      is the dormant Worker version.
   2. Pause `amiable-bulldog-848`. New function calls fail and crons are
      skipped, so Convex accepts no writes.
   3. Export a snapshot. Import it through the admin routes, which keeps IDs,
      creation times and table numbers: `import/begin` with the snapshot's
      table numbers, then `import/documents` for every page.
   4. Call `import/commit` with the snapshot's canonical per-table counts and
      SHA-256 values. It succeeds only when the object's values are equal.
   5. Unfreeze the object. It is now the only writer.
   6. Deploy the build whose `NEXT_PUBLIC_CONVEX_URL` is `/backend`.
   7. Keep Convex paused and intact as the rollback target.

   If a step before 5 fails, the object stays frozen and Convex is unpaused.
   Nothing is lost, because the object never accepted a write.

7. **Rollback steps.** The object stops accepting writes before anything is
   read from it. Convex is unpaused only once its restored data is proven
   equal to the object's.
   1. Freeze the object with `POST /backend/admin/freeze {"frozen": true}`.
      Record the `ts` it returns, which marks the last accepted write. From
      then on the object refuses every mutation, action, HTTP action,
      scheduled function and cron, and a running action can no longer write.
   2. Quiesce. Poll `GET /backend/admin/status` until `runningActions` is 0
      and `ts` still equals the recorded value. Attempt one public mutation,
      require the read-only error, then confirm `ts` is unchanged.
   3. Export every user table with `GET /backend/admin/export`, passing each
      page's `next` as `after` until it is null. Every page must report the
      recorded `ts` and `writesFrozen: true`; otherwise go back to step 2. The
      pages' canonical counts and SHA-256 values must equal
      `GET /backend/admin/stats`.
   4. Build a Convex snapshot ZIP from the pages and table numbers. Import it
      into the still-paused Convex with `convex import --replace-all`.
   5. Export Convex again. Its canonical per-table counts and SHA-256 values
      must equal the object's from step 3.
   6. Unpause Convex, then redeploy the dormant Worker version. Convex is now
      the only writer.

   If a step before 6 fails, Convex stays paused and the object stays frozen
   while the step is retried. To abandon the rollback instead, unfreeze the
   object. That loses nothing, because the object accepted no write after
   step 1. After step 6 the object stays frozen, so it can only accept writes
   again through a new cutover. A rollback retains accepted writes only when
   every check above passes. Pending scheduled functions are not part of a
   snapshot. Linejam's only one, the abandonment sweep's continuation, is
   re-derived by that sweep's one-minute cron.

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
