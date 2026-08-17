# Deployment Guide

Linejam runs on DigitalOcean App Platform. Convex remains the realtime backend,
Clerk remains the optional identity provider, and Sentry is the incident,
monitoring, and release-evidence platform. This guide is the production contract
for the web application and its hosted Convex deployment.

## Production topology

| Component       | App Platform name | Source                                | Runtime contract                      |
| --------------- | ----------------- | ------------------------------------- | ------------------------------------- |
| Web application | `linejam`         | `misty-step/linejam`, branch `master` | buildpack, port `3000`, `/api/health` |

The app deploys automatically from `master`. The public application is
`https://linejam.app`.

[`config/digitalocean-apps.json`](../config/digitalocean-apps.json) is the
canonical, values-free topology contract. It pins components, routes, domains,
health checks, source, build/run commands, environment variable names, and the
single frontend and Convex production deploy owner. The live provider spec must
reconcile with it before a release is accepted.

## Prerequisites

- `doctl` authenticated to the Misty Step DigitalOcean account
- App Platform GitHub access to `misty-step/linejam`
- Convex CLI access to the intended Linejam deployment
- production Clerk, Convex, Sentry, GitHub bridge, and guest-token values
  available through the approved credential plane
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

test -n "$LINEJAM_APP_ID"
```

Read back only non-secret deployment facts:

```bash
doctl apps get "$LINEJAM_APP_ID" -o json |
  jq '.[0] | {name: .spec.name, ingress: .default_ingress, deployment: .active_deployment.id, phase: .active_deployment.phase}'
```

The active deployment must report `ACTIVE` before a release is accepted.

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

| Variable                              | Purpose                                                    |
| ------------------------------------- | ---------------------------------------------------------- |
| `GUEST_TOKEN_SECRET`                  | signs web guest tokens; must match Convex                  |
| `NEXT_PUBLIC_CONVEX_URL`              | production Convex URL                                      |
| `CONVEX_DEPLOYMENT`                   | production Convex deployment selector                      |
| `CONVEX_DEPLOYMENT_URL`               | production Convex deployment URL                           |
| `CONVEX_DEPLOY_KEY`                   | production deploy key used during the hosted build         |
| `LINEJAM_DEPLOY_ENVIRONMENT`          | `production`; fail-closed hosted deploy guard              |
| `NEXT_DEPLOYMENT_ID`                  | `${_self.COMMIT_HASH}`; release and rolling-build identity |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`  | stable 32-byte base64 Server Action key                    |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`   | browser Clerk key                                          |
| `CLERK_SECRET_KEY`                    | server Clerk key                                           |
| `CLERK_JWT_ISSUER_DOMAIN`             | Clerk issuer used by Convex auth                           |
| `NEXT_PUBLIC_SENTRY_ENABLED`          | exact `1`; enables browser and hosted Convex Sentry        |
| `NEXT_PUBLIC_SENTRY_DSN`              | public write-only browser and Convex Sentry destination    |
| `SENTRY_AUTH_TOKEN`                   | build-only source-map upload credential                    |
| `SENTRY_ORG`                          | `misty-step`; source uploads and issue-event API paths     |
| `SENTRY_PROJECT`                      | `linejam`                                                  |
| `SENTRY_WEBHOOK_SECRET`               | signed Sentry webhook verification secret                  |
| `SENTRY_EVENT_WRITE_TOKEN`            | `event:write` token for event reads and GitHub linkage     |
| `SENTRY_AUTOMATION_PROVENANCE_SECRET` | HMAC authority for trusted automation-origin Sentry events |
| `GITHUB_ISSUES_TOKEN`                 | GitHub Issue creation token used by the Convex worker      |
| `SENTRY_EXPECTED_APP_ID`              | allowlisted Sentry integration application ID              |
| `SENTRY_EXPECTED_INSTALLATION_UUID`   | allowlisted Sentry installation UUID                       |
| `SENTRY_EXPECTED_PROJECT_ID`          | allowlisted Linejam Sentry project ID                      |
| `SENTRY_GITHUB_INTEGRATION_ID`        | Sentry GitHub integration ID used for external issue links |
| `GITHUB_REPOSITORY_OWNER`             | `misty-step`                                               |
| `GITHUB_REPOSITORY_NAME`              | `linejam`                                                  |
| `PLAYWRIGHT_CLERK_TEST_EMAIL`         | pre-created production smoke user                          |

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

### Rolling-deploy skew protection

App Platform can briefly serve a browser bundle from one release against a
server from the next release. Two production-only variables make that handoff
recoverable:

- Set `NEXT_DEPLOYMENT_ID` to the App Platform bindable value
  `${_self.COMMIT_HASH}`. Next.js includes it in framework requests and the
  Linejam health receipt exposes the current identifier for a values-free
  client/version comparison.
- Generate `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` once with
  `openssl rand -base64 32`, store it as an encrypted App Platform value, and
  preserve it across releases. Rotating it invalidates outstanding Server
  Action references, so rotate only as a controlled incident operation.

Production builds fail closed when either variable is absent or when the
Server Action key does not decode to exactly 32 bytes. `/api/health` reports
only the deployment identifier and boolean readiness; it never returns the
key or a fingerprint.

During a rollout, keep one pre-deploy room tab open with an unsubmitted line.
After the new deployment becomes `ACTIVE`, the tab must present the Linejam
update banner, reload only on the player's action, and restore the draft. Then
run two consecutive production smokes and inspect activation logs for any
unclassified `Failed to find Server Action` burst.

The deterministic production oracle stages that held room without logging its
code or content, waits up to 30 minutes for a new deployment receipt, then
enters the writing phase on the stale client and verifies the banner,
player-triggered reload, and restored draft. Creating the draft only after the
receipt changes keeps the proof inside the game's 90-second ghost-fill floor.

```bash
PLAYWRIGHT_BASE_URL=https://www.linejam.app pnpm qa:deployment-skew
```

## Convex configuration

Set backend-only values in the production Convex deployment. Omitting the
value makes the CLI prompt for it instead of recording it in shell history:

```bash
pnpm exec convex env set --prod GUEST_TOKEN_SECRET
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

## Backups and restore

The `Convex Backup` workflow runs daily at 09:17 UTC and can also be started
with `workflow_dispatch`. It authenticates only with the GitHub Actions
secret `CONVEX_DEPLOY_KEY_PROD`, exports the production Convex deployment,
and encrypts the export before it leaves the runner. The uploaded GitHub
Actions artifact is named `linejam-convex-backup`; its encrypted file is
`linejam-convex-<UTC date>-<short SHA>.zip.age` and its retention is 30 days.
No plaintext export is uploaded.

The workflow encrypts for the committed age recipient
`age1pyuqjlecesessdwrqvk4hvav7ncrvuy0etus7aqrl6lq30r6g4asrskltu`. The
matching private identity is an operator credential-plane secret named
**linejam backup age identity**. Keep that identity out of GitHub artifacts,
repository files, shell history, and chat. The public repository's artifact
surface is treated as readable by an attacker; age encryption is the boundary
that protects the export if an artifact is downloaded without authorization.

### Restore drill

Before downloading a backup, create or select the GitHub Issue that will own the
redacted drill receipt. Direct operator authority can commission the drill, but
the durable receipt still needs that public, sanitized record.

1. Download one `linejam-convex-backup` artifact from a successful backup run
   into a protected temporary directory. Keep the downloaded `.zip.age` file
   and the identity file mode `0600`.
2. Resolve the private **linejam backup age identity** from the operator
   credential plane into a local identity-file path. Do not paste its value into
   a command, log, issue, or pull request.
3. Restore into the local anonymous deployment (the script's safe default), or
   name a non-production target explicitly:

   ```bash
   scripts/ops/restore-convex-backup.sh \
     ./linejam-convex-<UTC date>-<short SHA>.zip.age \
     --identity "$AGE_IDENTITY_FILE" \
     local
   ```

   For a non-production cloud deployment, replace `local` with `dev` or
   `preview:<name>`. The script decrypts to a
   temporary file, runs `pnpm exec convex import --replace-all`, and removes
   the decrypted file on exit. It refuses a target that resolves to production
   unless `--allow-production` is supplied deliberately after confirming
   the target and obtaining operator authorization.

   If `CONVEX_DEPLOY_KEY` or `CONVEX_DEPLOYMENT_TOKEN` is supplied by the
   operator credential plane, omitting the target uses that deployment key.
   Production-shaped keys remain blocked unless `--allow-production` is passed.

4. Run the local or non-production health and representative data checks.
   Record the redacted restore-drill receipt on the canonical GitHub Issue that
   owns the drill. The receipt must link the backup workflow run and retained
   proof artifact, and name the non-secret target class, backup filename, source
   SHA, observed completion time, and check outcome.

The declared recovery objectives are **RPO 24 hours** (the export is daily) and
**RTO 30 minutes** (the canonical GitHub Issue links the durable restore-drill
receipt and proof). These objectives assume the operator credential plane and a
working Convex CLI are available; they do not authorize a production import.

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
Convex, guest-token, Clerk, AI, and Sentry readiness expected for production.
Its `guestTokenParity` boolean is a proof result only; neither secret nor a
fingerprint is returned.

## Preview smoke

The `Preview Smoke` workflow accepts an explicit App Platform preview URL. It
enforces the Linejam `*.ondigitalocean.app` hostname pattern before running the
same Playwright smoke suite used by the production workflow. Preview
infrastructure must never receive a production Convex deploy key.
Failed preview runs emit a privacy-filtered Sentry issue tagged
`github-actions`, `preview`, and `previewSmoke`. Successful runs remain in
GitHub Actions only: this workflow is event-driven, so it must not create a
Sentry Cron Monitor with an invented schedule.

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

### Sentry webhook is rejected

Confirm the production Convex environment has all bridge variables named in
`config/convex-env-manifest.json`, the Sentry internal integration sends
`event_alert` payloads to `/api/webhooks/sentry`, and the signing secret matches.
The route returns `400 Invalid webhook` for authentication, allowlist, and
payload-schema rejection. It acknowledges a correctly signed event with `202`
when that event's trusted automation provenance is permanently invalid, without
creating a receipt, so Sentry does not retry a hopeless event. Provider,
configuration, and durable-admission failures return `503 Unavailable` so
Sentry retries after the dependency or operator-owned configuration recovers.

### Smoke cannot launch Chromium

Confirm the GitHub Actions Playwright installation step completed and its
browser revision matches the lockfile. Do not install an unrelated browser
revision at runtime.

### Clerk-backed host or join hangs

Confirm `clerk.linejam.app` resolves to Clerk's frontend API service, the TLS
certificate verifies, and `CLERK_JWT_ISSUER_DOMAIN` matches the production
Clerk instance. Guest mode should remain available when Clerk is degraded.

## Rotation and rollback

For `GUEST_TOKEN_SECRET`, update App Platform and Convex in one bounded window,
then redeploy and replay guest creation. Existing guest tokens become invalid.
Rotate `SENTRY_WEBHOOK_SECRET` by updating the Sentry internal integration and
the production Convex environment in one bounded window, then verify one signed
delivery before ending the window.
Rotate `SENTRY_AUTOMATION_PROVENANCE_SECRET` in the smoke workflow secret stores
and production Convex environment in one bounded window. Events signed with the
old value stop at bridge admission; verify one trusted event before ending the
window.

App Platform deployments are source-driven. If a source release is bad, use a
normal `git revert` of the offending commit, pass the gates, and merge the
forward fix to `master`. For a bad environment-only change, restore the prior
entry in the active spec and redeploy. Never use destructive Git history to
simulate rollback.

For immediate mitigation while the forward fix is in flight, App Platform
supports provider-level rollback to a prior successful deployment. This
reuses the already-built container, so recovery is minutes, not a full
pipeline cycle. The 2026-07-17 drill measured 104 seconds to `ACTIVE` for
the rollback and 115 seconds for the roll-forward, with `/api/health`
returning 200 throughout (frontend rollback RTO: about 2 minutes).

```bash
APP_ID="$LINEJAM_APP_ID"
TARGET="$(doctl apps list-deployments "$APP_ID" \
  --format ID,Phase --no-header | awk '$2 == "SUPERSEDED" { print $1; exit }')"

# Validate, then execute. skip_pin keeps master pushes deploying normally.
curl -s -X POST "https://api.digitalocean.com/v2/apps/$APP_ID/rollback/validate" \
  -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"deployment_id\":\"$TARGET\",\"skip_pin\":true}"
curl -s -X POST "https://api.digitalocean.com/v2/apps/$APP_ID/rollback" \
  -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"deployment_id\":\"$TARGET\",\"skip_pin\":true}"
```

With `skip_pin: true` there is no pinned rollback state to revert: to return
to the newest release, run the same rollback call against the most recent
healthy deployment ID. `doctl` 1.163 has no rollback subcommand; the REST
endpoint is the supported path. The rolled-back frontend must remain
compatible with the live Convex functions, which forward deploys guarantee
(`qa:deployment-skew`); never roll back across a Convex schema migration
without restoring data to match.

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
- [ ] `pnpm ops:do-drift` reports the production app clean
- [ ] `pnpm ci:dagger:all` passes or its environment limitation is recorded
- [ ] hosted merge and smoke gates pass
- [ ] the active web deployment matches the intended source SHA
- [ ] production Convex env reconciliation names every required manifest entry
- [ ] `linejam.app` health, host, and join routes return 200
- [ ] production Sentry monitors report current check-ins
- [ ] one signed Sentry alert creates or reuses exactly one canonical GitHub Issue
- [ ] Clerk custom-domain DNS and TLS verify
- [ ] runtime log scans contain no new fatal, panic, uncaught, or 5xx errors
- [ ] rollback is a known prior source/config state, not another provider
