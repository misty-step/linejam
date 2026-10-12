# Cloudflare Workers production cutover

Parent initiative: `K-20261012-infrastructure-gets-simpler-seen-through`.

Move the frontend, origin, DNS and release owner off DigitalOcean. Hosted Convex
(`amiable-bulldog-848`) remains the database, backend functions and reactive
WebSocket service; Clerk and Sentry retain their existing interfaces. This is
not a Cloudflare database migration.

## Current state and target

The production home is `https://linejam.mistystep.io`, in the active Cloudflare
`mistystep.io` zone. Worker `linejam`, account
`b069014f6a46558ea9146fb6c4ff8f6c`, is configured in `wrangler.jsonc`.
`linejam-staging` remains development-scoped, not production acceptance.
`linejam.app` and `www.linejam.app` are not migration targets. Do not change
their registrar delegation or attach them to this Worker.

DigitalOcean app `1fb85c4b-18eb-441c-940d-5fda33dc5923` retains the old image
for rollback. Keep its auto-build disabled before the Cloudflare release;
Cloudflare headers alone do not prove removal of the old origin/build owner.

## One production release owner

`.github/workflows/cloudflare-production.yml` consumes successful protected-master
push CI, rejects stale source and deploys through `pnpm deploy:cf:production`.
Disable DigitalOcean `web.github.deploy_on_push` before merging the Cloudflare
ingress change: the retained old image trusts its original ingress header,
while the new Worker trusts only `cf-connecting-ip`. Never run both build owners.

The `Production` GitHub environment must contain production-scoped values for:

- Release only: `CLOUDFLARE_API_TOKEN`, `CONVEX_DEPLOY_KEY`. Reuse the existing
  `SENTRY_RELEASE_TOKEN` for the build's `SENTRY_AUTH_TOKEN`.
- Runtime and build: `GUEST_TOKEN_SECRET`, `CLERK_SECRET_KEY`,
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SENTRY_DSN`,
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `SENTRY_AUTOMATION_PROVENANCE_SECRET`.

Do not rely on development-valued repository secrets as production fallbacks.
Recover the existing stable server-action key; never generate or rotate it for
this migration. Reuse the production guest and provenance secrets. Keep recovery
material in pass and transfer through stdin/private temporary files, never argv,
logs, public comments or source.

The workflow runs the existing hosted Convex wrapper through `build:release:cf`.
OpenNext runs only `build:check`, avoiding recursive backend deployment.
Manifest reconciliation
and the zero-write guest-secret parity probe remain unskippable before Worker
activation. Runtime secrets are installed with the Worker version through a
mode-0600 temporary secrets file, removed on exit. The Convex deploy key and
Sentry upload token are not Worker bindings.

For an explicitly authorized release outside the workflow, supply the same
production environment through the existing credential broker and bind the
runtime secrets to the Worker first:

```sh
# NEXT_DEPLOYMENT_ID must be the exact reviewed, merged checkout SHA.
pnpm build:release:cf
pnpm deploy:cf:production
```

A bare `wrangler deploy` is not the release path: it omits backend deployment,
production environment selection, source binding and parity postconditions.
For a bounded local packaging check, `CIRCLE_NODE_TOTAL=2` limits Next's static
build to one worker; this does not change production runtime or host limits.

## Reversible cutover and acceptance

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
`linejam.mistystep.io` routing to the retained DO image. Restore DO auto-build ownership only after
stopping the Cloudflare owner; never rebuild Cloudflare-ingress source on DO.
Later Worker-only rollback uses a recorded healthy Cloudflare version.
Frontend rollback does not restore Convex data. Preserve schema, migration and
retention sequencing; do not roll functions backward across an incompatible
migration or import data without the explicit recovery contract.

Workflow health probes prove served source, Convex connectivity and guest-secret
parity. They do not replace the player walk, authenticated smoke, callback proof
or the controller's four-product deletion gate.
