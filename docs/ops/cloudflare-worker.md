# Cloudflare Workers production cutover

Parent initiative: `K-20261012-infrastructure-gets-simpler-seen-through`.

Move the frontend, origin, DNS and release owner off DigitalOcean. The backend
(database, functions and reactive WebSocket service) runs in the same Worker, as
the SQLite Durable Object `LinejamBackend` at `/backend`
([ADR-0011](../adr/0011-backend-on-cloudflare-durable-object.md)). Hosted Convex
(`amiable-bulldog-848`) stays paused and intact as its rollback target. Clerk
and Sentry retain their existing interfaces.

## Current state and target

The production home is `https://linejam.mistystep.io`, in the active Cloudflare
`mistystep.io` zone. Worker `linejam`, account
`b069014f6a46558ea9146fb6c4ff8f6c`, is configured in `wrangler.jsonc`.
`linejam-staging` remains development-scoped, not production acceptance.

DigitalOcean app `1fb85c4b-18eb-441c-940d-5fda33dc5923` retains the old image
for rollback. Its checked-in rollback reference requires auto-build disabled;
Cloudflare headers alone do not prove removal of the old origin/build owner.

## One production release owner

`.github/workflows/cloudflare-production.yml` consumes successful protected-master
push CI, rejects stale source and deploys through `pnpm deploy:cf:production`.
Disable DigitalOcean `web.github.deploy_on_push` before merging the Cloudflare
ingress change: the retained old image trusts its original ingress header,
while the new Worker trusts only `cf-connecting-ip`. Never run both build owners.

The `Production` GitHub environment must contain production-scoped values for:

- Release only: `CLOUDFLARE_API_TOKEN`. Reuse the existing
  `SENTRY_RELEASE_TOKEN` for the build's `SENTRY_AUTH_TOKEN`.
- Runtime and build: `GUEST_TOKEN_SECRET`, `CLERK_SECRET_KEY`,
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SENTRY_DSN`,
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `SENTRY_AUTOMATION_PROVENANCE_SECRET`.

Do not rely on development-valued repository secrets as production fallbacks.
Recover the existing stable server-action key; never generate or rotate it for
this migration. Reuse the production guest and provenance secrets. Keep recovery
material in pass and transfer through stdin/private temporary files, never argv,
logs, public comments or source.

The workflow builds the Worker with `build:cf`; the backend ships inside it, so
nothing deploys to Convex. OpenNext runs only `build:check`. Runtime secrets
are installed with the Worker version through a mode-0600 temporary secrets
file, removed on exit, and the backend reads the same bindings. A test
(`tests/ci/cloudflare-production.test.ts`) requires one `/backend` URL for the
client build, the server and the backend, and a binding for every name the
production env manifest requires. After activation, `verify-production`
requires the exact source, a connected backend and the zero-write guest-secret
parity probe. The Sentry upload token is not a Worker binding.

For an explicitly authorized release outside the workflow, supply the same
production environment through the existing credential broker and bind the
runtime secrets to the Worker first:

```sh
# NEXT_DEPLOYMENT_ID must be the exact reviewed, merged checkout SHA.
pnpm build:cf
pnpm test:worker-routes
pnpm test:worker-images
pnpm deploy:cf:production
```

A bare `wrangler deploy` is not the release path: it omits production
environment selection, source binding and parity postconditions.
`test:worker-routes` runs the built artifact in local workerd before deployment,
using the deployed compatibility settings and `ROUTE_TEMPLATES` inventory. Its
[pass conditions](../../scripts/qa/worker-route-contracts.ts) cover every route;
missing conditions fail typecheck. HTML, feeds, images, API responses and the
disabled preview drill have explicit status/content checks. Runtime error logs
and streamed render errors fail even when HTTP status is 200. The only accepted
5xx is `/api/health` reporting `convex: unreachable` with no capability report.
All outbound fetches are blocked, no runtime credentials are loaded, guest
session reads use `?existing=1`, and probes use an unknown poem/room. Backend
fallbacks and Clerk's unauthenticated shell are intentional, not live backend or
authenticated journey acceptance. The same gate runs in PR CI's existing Worker
build job, without another build; a failure prevents `merge-gate` and deployment.
For a bounded local packaging check, `CIRCLE_NODE_TOTAL=2` limits Next's static
build to one worker; this does not change production runtime or host limits.

## History: the frontend cutover from DigitalOcean

This section records how the frontend left DigitalOcean. It does not describe
the backend: backend cutover and rollback follow
[ADR-0011](../adr/0011-backend-on-cloudflare-durable-object.md) decisions 5–7.
Once the backend serves from `/backend`, the frontend rollback below no longer
applies, because the retained image talks to the paused Convex deployment.

The initiative's private `do-linejam` evidence owns exact provider/DNS payloads,
credential references and observed deployment/version IDs. Capture the DO spec
in the credential plane before changing it. Keep its current successful image
and all resources; deletion remains the global controller's operation.

Order: verify recovered production inputs; independently review the exact source
and operation payload; freeze DO auto-builds; install production credentials;
merge green source; verify the release at `linejam.mistystep.io`.
Acceptance requires real multiplayer UI through nine rounds, reveal,
rematch/reconnect, room closure, fresh-session join rejection and session cleanup,
with inspected private artifacts. Verify browser requests/WebSockets use Convex,
database changes persist, Clerk DNS/TLS and callbacks work, Sentry attribution is
source-bound, and neither Worker origin nor production release steps call DO.

Rollback: disable the Cloudflare Production workflow and restore captured
`linejam.mistystep.io` routing to the retained DO image. Keep DO auto-build disabled even after
stopping the Cloudflare owner; never rebuild Cloudflare-ingress source on DO.
Later Worker-only rollback uses a recorded healthy Cloudflare version.
Frontend rollback does not restore Convex data. Preserve schema, migration and
retention sequencing; do not roll functions backward across an incompatible
migration or import data without the explicit recovery contract.

Workflow health probes prove served source, Convex connectivity and guest-secret
parity. They do not replace the player walk, authenticated smoke, callback proof
or the controller's four-product deletion gate.
