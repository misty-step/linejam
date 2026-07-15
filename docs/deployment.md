# Deployment Guide

Linejam runs on DigitalOcean App Platform. Convex remains the realtime backend,
Clerk remains the optional identity provider, and Canary remains the incident
sink. This guide is the production contract for the web application and its
Canary responder.

## Production topology

| Component        | App Platform name          | Source                                | Runtime contract                                |
| ---------------- | -------------------------- | ------------------------------------- | ----------------------------------------------- |
| Web application  | `linejam`                  | `misty-step/linejam`, branch `master` | buildpack, port `3000`, `/api/health`           |
| Canary responder | `linejam-canary-responder` | `misty-step/linejam`, branch `master` | `Dockerfile.responder`, port `8787`, `/healthz` |

Both apps deploy automatically from `master`. The public application is
`https://linejam.app`; the responder is currently reachable at
`https://linejam-canary-responder-fdflj.ondigitalocean.app`.

[`config/digitalocean-apps.json`](../config/digitalocean-apps.json) is the
canonical, values-free topology contract. It pins components, routes, domains,
health checks, source, build/run commands, environment variable names, and the
single frontend and Convex production deploy owner. The live provider spec must
reconcile with it before a release is accepted.

The stable Canary API origin is `https://canary.mistystep.io`. Use that custom
hostname in application defaults and provider configuration rather than a
provider-generated hostname.

## Prerequisites

- `doctl` authenticated to the Misty Step DigitalOcean account
- App Platform GitHub access to `misty-step/linejam`
- Convex CLI access to the intended Linejam deployment
- production Clerk, Convex, Canary, and guest-token values available through
  the approved credential plane
- GitHub Actions access for the hosted quality and smoke gates

Never commit a raw exported App Platform spec or print secret values. Raw
exports can contain encrypted provider values and belong in a mode-`0600`
temporary file only. The committed topology contract is separately constructed
and validated to reject every environment `value` field.

## Discover the live apps

Resolve IDs from the provider instead of copying an old deployment ID:

```bash
LINEJAM_APP_ID="$(
  doctl apps list --format ID,Spec.Name --no-header |
    awk '$2 == "linejam" { print $1 }'
)"
LINEJAM_RESPONDER_APP_ID="$(
  doctl apps list --format ID,Spec.Name --no-header |
    awk '$2 == "linejam-canary-responder" { print $1 }'
)"

test -n "$LINEJAM_APP_ID"
test -n "$LINEJAM_RESPONDER_APP_ID"
```

Read back only non-secret deployment facts:

```bash
doctl apps get "$LINEJAM_APP_ID" -o json |
  jq '.[0] | {name: .spec.name, ingress: .default_ingress, deployment: .active_deployment.id, phase: .active_deployment.phase}'

doctl apps get "$LINEJAM_RESPONDER_APP_ID" -o json |
  jq '.[0] | {name: .spec.name, ingress: .default_ingress, deployment: .active_deployment.id, phase: .active_deployment.phase}'
```

Both active deployments must report `ACTIVE` before a release is accepted.

Reconcile every meaningful, non-value provider field against the committed
contract with:

```bash
pnpm ops:do-drift
```

The command performs bounded, read-only `doctl apps get` calls. It discards
provider-generated deployment fields and all environment values before the
comparison. A bounded account inventory also rejects undeclared App Platform
apps sourced from `misty-step/linejam@master`. Workers, jobs, functions, static
sites, databases, and app-level environment blocks fail closed until the
canonical model explicitly supports them. Failures report only sanitized field
paths; provider stdout and stderr are never replayed. A component, build
command, route, source, health check, environment name/type/scope, domain, or
sizing change is meaningful drift.

## Environment contract

`GUEST_TOKEN_SECRET` is load-bearing: the App Platform web service and Convex
must receive the identical value. A mismatch breaks guest-token verification.

### Web application

| Variable                            | Purpose                                            |
| ----------------------------------- | -------------------------------------------------- |
| `GUEST_TOKEN_SECRET`                | signs web guest tokens; must match Convex          |
| `NEXT_PUBLIC_CONVEX_URL`            | production Convex URL                              |
| `CONVEX_DEPLOYMENT`                 | production Convex deployment selector              |
| `CONVEX_DEPLOY_KEY`                 | production deploy key used during the hosted build |
| `LINEJAM_DEPLOY_ENVIRONMENT`        | `production`; fail-closed hosted deploy guard      |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | browser Clerk key                                  |
| `CLERK_SECRET_KEY`                  | server Clerk key                                   |
| `CLERK_JWT_ISSUER_DOMAIN`           | Clerk issuer used by Convex auth                   |
| `CANARY_ENDPOINT`                   | `https://canary.mistystep.io`                      |
| `CANARY_API_KEY`                    | server-side Canary credential                      |
| `NEXT_PUBLIC_CANARY_ENDPOINT`       | `https://canary.mistystep.io`                      |
| `NEXT_PUBLIC_CANARY_API_KEY`        | browser write-only Canary credential               |
| `PLAYWRIGHT_CLERK_TEST_EMAIL`       | pre-created production smoke user                  |

### Canary responder

| Variable                              | Required value or role            |
| ------------------------------------- | --------------------------------- |
| `LINEJAM_CANARY_RESPONDER_PORT`       | `8787`                            |
| `LINEJAM_CANARY_WEBHOOK_PATH`         | `/canary/webhook`                 |
| `LINEJAM_CANARY_STORE_DIR`            | `/tmp/canary`                     |
| `LINEJAM_SMOKE_RUNNER`                | `playwright`                      |
| `PLAYWRIGHT_BASE_URL`                 | `https://www.linejam.app`         |
| `PLAYWRIGHT_REQUIRE_AUTH_SMOKE`       | `1`                               |
| `LINEJAM_ENFORCE_SMOKE_URL_ALLOWLIST` | `1`                               |
| `LINEJAM_ALLOWED_SMOKE_ORIGINS`       | `https://www.linejam.app`         |
| `CANARY_ENDPOINT`                     | `https://canary.mistystep.io`     |
| `CANARY_API_KEY`                      | responder query credential        |
| `LINEJAM_CANARY_SERVICE`              | `linejam`                         |
| `LINEJAM_CANARY_WEBHOOK_SECRET`       | signed-delivery secret            |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`   | production Clerk key              |
| `CLERK_SECRET_KEY`                    | production Clerk key              |
| `PLAYWRIGHT_CLERK_TEST_EMAIL`         | pre-created production smoke user |

Update environment configuration in App Platform without copying values into
the repository. For a scripted change, export the current spec into a protected
temporary file, change only the intended entry, apply it, and remove the file:

```bash
umask 077
doctl apps spec get "$LINEJAM_APP_ID" > /tmp/linejam-app.yaml
# Edit only the intended field, preserving encrypted secret entries.
doctl apps update "$LINEJAM_APP_ID" --spec /tmp/linejam-app.yaml --wait
rm /tmp/linejam-app.yaml
```

Repeat with `LINEJAM_RESPONDER_APP_ID` for responder-only configuration. Read
the resulting deployment phase and health route before continuing.

## Convex configuration

Set backend-only values in the production Convex deployment. Omitting the
value makes the CLI prompt for it instead of recording it in shell history:

```bash
pnpm exec convex env set --prod GUEST_TOKEN_SECRET
pnpm exec convex env set --prod OPENROUTER_API_KEY
pnpm exec convex env list --prod --names-only
```

[`config/convex-env-manifest.json`](../config/convex-env-manifest.json) is the
repo-owned declaration of required and optional Convex environment variable
names for development, preview, and production. It never stores values. Run a
bounded, values-free readback with:

```bash
node scripts/ci/reconcile-convex-env.mjs --target production
```

The reconciler invokes only `convex env ... list --names-only`, rejects any
non-name output without echoing it, and fails on either a missing required name
or an undeclared live name. The hosted production build runs this reconciliation
after `convex deploy` and then runs the signed guest-token parity dry run before
App Platform can activate the web build. A present-but-different
`GUEST_TOKEN_SECRET` therefore fails deployment even though both providers have
a variable with the right name.

Run the production reconciliation before merging any manifest change. Strict
unexpected-name detection intentionally makes undeclared operational variables
a deployment blocker, so add a new name to the manifest before setting it live.
The post-deploy parity probe also reads the selected production function spec's
public deployment URL and refuses a `NEXT_PUBLIC_CONVEX_URL` that points at a
sibling deployment.

The same manifest also drives Convex runtime health. The five-minute Production
Health Monitor reaches the exact web/Convex pair through `/api/health`, which
checks required-name presence and repeats the zero-write signed parity probe.
That catches drift introduced after a successful deployment without giving the
scheduled workflow a production control-plane credential.

`LINEJAM_DEPLOY_ENVIRONMENT` is a non-secret deployment-type marker maintained
by the hosted bootstrap in the target Convex environment. Runtime health uses
it instead of guessing from the `convex.cloud` hostname, which is shared by dev,
preview, and production deployments.

The production App Platform build executes the Convex deploy before the Next.js
build. Local agents must not push production Convex code unless
`LINEJAM_ALLOW_PROD_CONVEX_SYNC=1` was set deliberately for that operation.

## Deploy the web application

The normal path is declarative:

1. Merge a green change to `master`.
2. App Platform detects the source update and deploys `linejam`.
3. Confirm the active deployment source SHA and `ACTIVE` phase.
4. Exercise the public health, host, and join routes.

To rebuild the current `master` source without changing configuration:

```bash
doctl apps create-deployment "$LINEJAM_APP_ID" --force-rebuild --wait
```

Acceptance probes:

```bash
curl -fsS https://linejam.app/api/health
curl -fsS -o /dev/null -w '%{http_code}\n' https://linejam.app/host
curl -fsS -o /dev/null -w '%{http_code}\n' https://linejam.app/join
doctl apps logs "$LINEJAM_APP_ID" web --type run --tail 200
```

All three routes must return HTTP 200. `/api/health` must report the core app,
Convex, guest-token, Clerk, AI, and Canary readiness expected for production.
Its `guestTokenParity` boolean is a proof result only; neither secret nor a
fingerprint is returned.

## Deploy the Canary responder

App Platform builds [`Dockerfile.responder`](../Dockerfile.responder) from
`master`. A source merge therefore updates both App Platform apps; the web and
responder health gates decide independently whether each deployment becomes
active.

To rebuild only the responder from the current source:

```bash
doctl apps create-deployment "$LINEJAM_RESPONDER_APP_ID" --force-rebuild --wait
```

Register or converge the signed Canary subscription on the App Platform URL:

```bash
export CANARY_ENDPOINT=https://canary.mistystep.io
export LINEJAM_CANARY_WEBHOOK_URL=https://linejam-canary-responder-fdflj.ondigitalocean.app/canary/webhook
# Resolve CANARY_API_KEY into this shell from the approved credential plane.
: "${CANARY_API_KEY:?CANARY_API_KEY must be resolved before webhook setup}"
pnpm canary:webhook:setup
```

`pnpm canary:webhook:setup` is idempotent. It preserves one exact active
subscription and replaces duplicate or stale subscriptions for the same URL.
Use `-- --emit-secret` only during an intentional signing-secret rotation, then
write the new value directly to the credential plane and App Platform without
recording it in shell output, chat, or Git.

Responder acceptance probes:

```bash
curl -fsS https://linejam-canary-responder-fdflj.ondigitalocean.app/healthz
curl -fsS https://linejam-canary-responder-fdflj.ondigitalocean.app/readyz
doctl apps logs "$LINEJAM_RESPONDER_APP_ID" responder --type run --tail 200
```

Both routes must return HTTP 200, and readiness must be `ok`. For an intentional
end-to-end delivery drill, set `CANARY_WEBHOOK_SEND_TEST=1` for one setup run
after readiness passes, then verify the delivery and persisted smoke result.

## Preview smoke

The `Preview Smoke` workflow accepts an explicit App Platform preview URL. It
enforces the Linejam `*.ondigitalocean.app` hostname pattern before running the
same Playwright smoke suite used by the responder. Preview infrastructure must
never receive a production Convex deploy key.

Run it only after a temporary preview app is ready, and remove that app after
the review is complete.

## Quality gates

Before merging a deployment-bearing change:

```bash
pnpm ci:prepush
pnpm ci:dagger:all
```

The first command is the required host gate. The Dagger command is the complete
local parity gate when Docker and the required browser/auth environment are
available. Hosted `merge-gate`, early smoke, production smoke, and the live
route probes are separate acceptance surfaces; one does not substitute for the
others.

## Troubleshooting

### Guest token verification fails

1. Confirm `GUEST_TOKEN_SECRET` exists on the App Platform web service.
2. Confirm the same value exists in the production Convex environment.
3. Confirm the active deployment was built after the App Platform change.
4. Re-run `/api/guest/session` and inspect value-free runtime logs.

Do not print either value to compare it. Compare secret fingerprints through an
approved one-way check when direct control-plane verification is insufficient.

### Responder is live but not ready

`/healthz` is process liveness; `/readyz` fails closed until both
`LINEJAM_CANARY_WEBHOOK_SECRET` and `CANARY_API_KEY` are configured. Read the
App Platform environment-name inventory and runtime logs, repair the missing
entry, then redeploy and probe both routes.

### Smoke cannot launch Chromium

The responder image pins Playwright and sets
`PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`. Confirm that variable reaches the
smoke child process and that the installed browser revision matches the package
version. Do not install an unrelated browser revision at runtime.

### Clerk-backed host or join hangs

Confirm `clerk.linejam.app` resolves to Clerk's frontend API service, the TLS
certificate verifies, and `CLERK_JWT_ISSUER_DOMAIN` matches the production
Clerk instance. Guest mode should remain available when Clerk is degraded.

## Rotation and rollback

For `GUEST_TOKEN_SECRET`, update App Platform and Convex in one bounded window,
then redeploy and replay guest creation. Existing guest tokens become invalid.
Rotate the Canary webhook secret by creating the converged subscription,
updating App Platform, proving a test delivery, and deleting any stale
subscription only after the new responder accepts it.

App Platform deployments are source-driven. If a source release is bad, use a
normal `git revert` of the offending commit, pass the gates, and merge the
forward fix to `master`. For a bad environment-only change, restore the prior
entry in the active spec and redeploy. Never use destructive Git history to
simulate rollback.

Convex has no state rollback. Redeploying prior function source is a forward
deployment, while restoring data requires an explicit export/import operation.
Before any import, verify the target deployment and preserve a fresh export:

```bash
pnpm exec convex export --path ./convex-backup.zip --prod
# Destructive restore; verify the target and obtain operator confirmation first.
pnpm exec convex import --replace-all ./convex-backup.zip --prod
```

## Release checklist

- [ ] `pnpm ci:prepush` passes
- [ ] `pnpm ops:do-drift` reports both production apps clean
- [ ] `pnpm ci:dagger:all` passes or its environment limitation is recorded
- [ ] hosted merge and smoke gates pass
- [ ] web and responder active deployments match the intended source SHA
- [ ] production Convex env reconciliation names every required manifest entry
- [ ] `linejam.app` health, host, and join routes return 200
- [ ] responder liveness and readiness return 200
- [ ] Canary uses `https://canary.mistystep.io`
- [ ] the signed webhook targets the App Platform responder URL
- [ ] Clerk custom-domain DNS and TLS verify
- [ ] runtime log scans contain no new fatal, panic, uncaught, or 5xx errors
- [ ] rollback is a known prior source/config state, not another provider
