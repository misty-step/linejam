# Cloudflare Workers deployment target (cutover in progress)

Standing policy `2026-09-18-hosting-and-autonomy.md`: the public product is
Cloudflare. Linejam currently serves `linejam.app`, `www.linejam.app`, and
`linejam.mistystep.io` from DigitalOcean App Platform (`linejam-6qoir`).
This document describes the OpenNext-on-Cloudflare replacement and the
remaining cutover steps. The App Platform app stays running until each
production hostname is served by the Worker.

## Artifacts

- `open-next.config.ts` — OpenNext Cloudflare adapter config.
- `wrangler.jsonc` — Worker config: `staging` (workers.dev only) and
  `production` (custom domains) environments.
- Scripts: `build:cf`, `deploy:cf:staging`, `deploy:cf:production`.

## Build and deploy

The build must run with the deployment's environment values exported
(public values from the env record; secrets never printed):

```sh
# staging (development-scoped backends)
set -a; . ./.env.local; set +a
export NEXT_PUBLIC_SENTRY_ENABLED=1 LINEJAM_SENTRY_ENABLED=true
export NEXT_DEPLOYMENT_ID="$(git rev-parse HEAD)"
pnpm build:cf
pnpm deploy:cf:staging

# bind staging key material (piped from the env record; never printed)
# GUEST_TOKEN_SECRET, CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
# via: printf %s "$NAME" | pnpm exec wrangler secret put NAME --env staging
```

```sh
# production (after secrets are bound — see below)
set -a; . ./.env.production.local; set +a
export NEXT_DEPLOYMENT_ID="$(git rev-parse HEAD)"
pnpm build:cf
pnpm deploy:cf:production
```

Always deploy with the scripts above; they pass `--env`. A bare
`wrangler deploy` would apply the routeless top-level config to the
production-named Worker and detach its custom domains.

## Environment contract

`NEXT_PUBLIC_*` values are inlined at build time and must also exist as
Worker bindings. Committed `vars` carry only non-key values (Convex URLs,
Sentry org/project, environment markers). Key material — including the
Clerk publishable key, which the repo secret scanner treats as a secret —
is bound at deploy time with
`wrangler secret put <NAME> --env <staging|production>` from the approved
store; it is never committed.

Production secret names (what the runtime and build read; the App Platform
mirror is `config/digitalocean-apps.json`):
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `GUEST_TOKEN_SECRET` (must equal the
production Convex deployment value), `CLERK_SECRET_KEY`,
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (stable 32-byte base64; reuse across
deploys), `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_EVENT_WRITE_TOKEN`,
`SENTRY_WEBHOOK_SECRET`, `SENTRY_AUTOMATION_PROVENANCE_SECRET`,
`SENTRY_AGENT_LOOP_SECRET`.
`NEXT_DEPLOYMENT_ID` is the source commit SHA and is set per deploy.

## Remaining cutover steps (operator-owned decisions)

1. Bind the production secrets above to the `linejam` Worker.
2. Attach `linejam.mistystep.io` (zone already active on Cloudflare).
3. For `linejam.app` / `www.linejam.app`: the Cloudflare zone exists but is
   pending while DigitalOcean nameservers are authoritative. Stage the zone
   records (apex, `www`, `clerk` CNAME, SPF TXT) first, then the registrar
   NS flip is an explicit operator decision. Do not flip early; an empty
   pending zone black-holes the name.
4. Soak, then delete the App Platform app and its domains.

## Verification

- Staging: workers.dev URL returns 200, page title marker (`Linejam`),
  `server: cloudflare`, `cf-ray`.
- `/api/health` reports the real configuration state; do not mask missing
  environment values.
- Production: custom-domain hostnames return 200 with `cf-ray`, and the
  old App Platform origin stays reachable until the soak completes.
