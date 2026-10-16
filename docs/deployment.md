# Deployment Guide

Linejam's production home is `https://linejam.mistystep.io`. The Cloudflare
frontend release and rollback path is in [the Worker guide](ops/cloudflare-worker.md).
Hosted Convex remains the realtime backend, Clerk the optional identity
provider, and Sentry the incident and monitoring platform.

## Production topology

| Component       | Cloudflare Worker | Source                                | Runtime contract |
| --------------- | ----------------- | ------------------------------------- | ---------------- |
| Web application | `linejam`         | `misty-step/linejam`, branch `master` | `/api/health`    |

The Cloudflare Production workflow releases the exact successful `master` CI
source to the canonical origin without `www`.

The DigitalOcean instructions and [`config/digitalocean-apps.json`](../config/digitalocean-apps.json)
below are retained-provider recovery references, not production release authority.
The values-free rollback contract preserves source/build provenance and the
nonretired domain alias, requires `deployOnPush: false`, and grants no rebuild
permission. Keep DO auto-build disabled; DO destruction remains controller-owned.

## Release ownership and public history

Landmark owns release decisions, technical history, and player-facing note
synthesis. The [Release workflow](../.github/workflows/release.yml) owns the
published Landmark binary revision and checksum pin; consult its current
action configuration rather than copying a version or hash from this guide.
`.landmark.yml` sets Linejam's product context, end-user audience, voice,
and budget. [ADR-0010](adr/0010-release-versions-and-changelog.md) records the
release unit, baseline, pre-1.0 policy and `/changelog` choices under the
shared release convention.

`package.json` is the checked-in semantic version; `lib/appVersion.ts` exposes
that same value to the application and release catalog. It is not a source
identifier. Deployment IDs, Sentry releases, and the rolling-deploy guard remain
source-SHA based. Never replace those identifiers with a semantic version.

Before this cutover, the recorded version was **0.27.0**, matching the then-current
`CHANGELOG.md` entry and [published GitHub Release](https://github.com/misty-step/linejam/releases/tag/v0.27.0).
That release has technical history but no recorded player-facing synthesis.
The public surfaces say so; they do not invent notes for today's unshipped
changes. Historical v1.x entries remain in date order, not sorted above the
newer v0.x release line. The old manifest's `latest: 1.15.1` was stale, not an
authority to bump or relabel the application.

### Prepare, review, then publish

The `Release` workflow runs only after successful `CI` on `master`, and checks
that its checkout is still the exact green source SHA. It uses Landmark's
supported full-mode semantic-release hook adapter in `release.config.cjs`:

1. `landmark run --provider local --dry-run` supplies the version decision.
   There is no local conventional-commit analyzer or second version allocator.
2. If that decision has no matching reviewed candidate, Landmark's `run`,
   `synthesize`, and `write-artifacts` commands prepare the technical changelog
   and, when synthesis succeeds, public markdown and
   `landmark.public-release-notes.v1` JSON. An attempted provider call that
   fails may instead prepare a reviewable **technical-only** candidate with
   `synthesis.json` quality `unavailable`: no invented public notes, no
   `notes.md`, and no native Landmark JSON entry for that version. The adapter
   projects the package version and artifacts into one release PR on
   `landmark/release`. Its `.landmark/release.json` records the analyzed source
   SHA and synthesis quality. No tag or GitHub Release exists yet.
3. `GITHUB_TOKEN` opens the PR and explicitly dispatches the existing full `CI`
   workflow against its exact head SHA. The dispatch is bound to the open
   `landmark/release` PR and runs schema sequencing, all E2E/evidence jobs, and
   the same required `merge-gate`; skipped dependencies cannot pass it.
   GitHub leaves dispatched check suites out of the PR's status rollup, so read
   the head commit's check runs, not the PR badge. The merging agent confirms
   every job passed at the exact head, checks the version against the included
   commits and the notes for private data, then squash-merges promptly. There
   is no auto-merge or protection bypass. A rerun for the same source keeps an
   open release PR from this repository whose candidate matches the source and
   Landmark decision with valid or skipped notes; fork PRs that reuse the branch
   name are ignored. The rerun does not synthesize again or dispatch new CI, so
   re-run a failed dispatched CI run directly. An `unavailable` candidate is
   prepared again.
4. After the merged candidate passes master CI, full mode verifies Landmark's
   decision still matches the candidate, that only release artifacts changed
   since its analyzed source, and that semantic-release agrees on the previous
   tag and next version. Its `prepare` hook checks the committed projections
   before publishing. It creates no new master commit. Post-publication
   synthesis and RSS commits are disabled, so any public notes are synthesized
   during PR preparation and release commits cannot create a release loop.

This ordering is deliberate: the pinned Landmark action normally synthesizes
**after** semantic-release has already run its prepare hooks and published.
Those later artifacts cannot be included in the same prepare commit. A direct
`@semantic-release/git` push also cannot satisfy this repository's protected
branch. Preparing a normal PR commits package version, changelog, any public
notes, manifest, marketing HTML, and feed together before the gate;
publication is a separate remote step, not an invented cross-provider
transaction. A failed publication is visible as a failed workflow, not proof
that a tag shipped.

### Deterministic local preview and check

With the published Landmark binary pinned by the workflow installed on `PATH`:

```sh
# Free: no model call, artifact writes, tags, or remote mutations.
landmark run --provider local --repo-root . --repository misty-step/linejam --dry-run
landmark doctor --repo-root . --format json

# Free, offline projections of already-recorded release content.
pnpm generate:releases --dry-run
pnpm generate:releases
pnpm releases:check
```

The generator no longer accepts `--force` or `--site-only` and has no provider
key, model, prompt, or fallback synthesis. It writes only changed files and
never uses wall-clock time. Commit its outputs together with any source
artifact changes. `pnpm test` fails and names any stale projection, so drift
cannot reach `master` and surface later as a Pages failure. Ordinary app builds
do not run Landmark or contact a provider.

`content/releases/landmark.json` is Landmark's native release-entry JSON array;
markdown lives in `content/releases/{tag}/notes.md`. The catalog validates the
checked-in upstream schema and rejects mismatched JSON/markdown. The generator
also writes `content/releases/catalog.json` for the app's release page and RSS
route: Workers import this checked projection, never the filesystem/Ajv loader.
`synthesis.json` quality distinguishes a deliberate policy `skipped`, a failed
provider attempt `unavailable`, and generated `valid` notes; absent quality and
notes remain explicitly `missing`. Neither `skipped` nor `unavailable` can
coexist with public notes for that version. Malformed records, failed grounding
or integrity checks, and unreconciled public notes fail preparation rather than
taking the technical-only path. A failed local attempt may have written files;
discard them. The workflow does not refresh the release PR after failure.
Whenever a release has no public notes (`skipped`, `unavailable` or `missing`),
the app's `/changelog`, the site changelog, the RSS feed and the GitHub Release
show the explicit status with the technical history open, so the deterministic
history is useful on its own. `/releases` remains an alias of `/changelog`.
Missing or stale projections are detected by `pnpm releases:check` and the
catalog freshness test before deployment; the app does not inspect the manifest
at runtime.

`content/releases/legacy-notes.json` preserves the 39 public entries from the
old `docs/releases/feed.xml`, with the original feed's SHA-256 and recovered
HTML/plaintext. Only the broken nested CDATA transport wrappers were removed;
these notes are labeled as legacy, not newly synthesized by the current
pipeline. Existing per-version legacy markdown is also retained. All release
dates come from recorded technical history, not Landmark's artifact-creation
`published_at` field. Both RSS surfaces use a full deterministic render, not
append-and-reparse CDATA mutation.

### Live prerequisites and recovery

Before the release-PR cutover, the workflow had been **manually disabled**.
The [earlier failed run](https://github.com/misty-step/linejam/actions/runs/31910551340)
stopped in `@semantic-release/git` prepare with `GH006`: changes require a PR
and `merge-gate`. No synthesis ran. This was an observed branch-protection
failure, not a model-provider failure.

The updated workflow is now enabled. Its current two-stage
prepare-then-publish contract requires an exact green source and a normally
reviewed PR. `GITHUB_TOKEN` needs the workflow-declared Contents, Issues,
Pull requests, and Actions write permissions; no new GitHub App or PAT is
required. GitHub documents the
[workflow_dispatch exception for GITHUB_TOKEN](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

The release workflow reads the **repository-owned** `OPENROUTER_API_KEY`
secret. It overrides any inherited organization secret of that name. Its
issuer-owned identity is `misty-step/linejam/ci/release-notes`: USD 5 at each
UTC month boundary, enabled, and restricted to Landmark's balanced model
chain. The repository `.env.pass` names the dedicated pass entry only as
`LINEJAM_RELEASE_OPENROUTER_API_KEY`; it deliberately does **not** export a
generic `OPENROUTER_API_KEY` into other local consumers such as Jev. CI alone
maps its repository secret to Landmark's required input. An authorized
operator can bind that single repository secret securely without printing the
token:

```sh
pass-env run -f .env.pass -- sh -c 'printf %s "$LINEJAM_RELEASE_OPENROUTER_API_KEY" | gh secret set OPENROUTER_API_KEY --repo misty-step/linejam'
```

The [MIS-183 attempt 2](https://github.com/misty-step/linejam/actions/runs/36445103936/attempts/2)
prepared a valid current-source candidate after that binding; its
[candidate CI](https://github.com/misty-step/linejam/actions/runs/36456022124)
passed the full merge gate. Neither action published the release. A missing
key fails preparation unless Landmark's own policy skips synthesis: for
`model.policy: off` in `.landmark.yml`, a low-significance release, or a
release over the manifest's token or cost budget. A skip releases with
Landmark's `skipped` status and technical history only, with no provider
request. Malformed release evidence and failed
grounding or integrity checks remain preparation failures, never a policy skip
or an unavailable-provider candidate. A failed attempted provider call can
produce a technical-only PR with explicit `unavailable` quality for human
review; it does not bypass the full PR CI gate, merge review, master CI, or
publication checks. A deliberate Landmark policy skip remains an explicit
`skipped`.

If a release PR becomes stale, the next green master run updates it and
dispatches its full gate again. If tag history and the Landmark decision
disagree, reconcile the actual published/tagged history before retrying; do not
manually bump package metadata or relabel the retained v1.x archive to force a
pass. A publication failure after merge requires inspection of the exact tag
and GitHub Release before a rerun; no local check proves remote publication.

## Retained DigitalOcean recovery prerequisites

- `doctl` authenticated to the Misty Step DigitalOcean account
- App Platform GitHub access to `misty-step/linejam`
- Convex CLI access to the intended Linejam deployment
- production Clerk, Convex, Sentry, and guest-token values available through
  the approved credential plane
- GitHub Actions access for the hosted quality and smoke gates

Never commit a raw exported App Platform spec or print secret values. Raw
exports can contain encrypted provider values and belong in a mode-`0600`
temporary file only. The committed topology contract is separately constructed
and validated to reject every environment `value` field.

## Inspect the retained DigitalOcean app

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

The retained deployment must report `ACTIVE` before it can be a recovery target.

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

## Retained DigitalOcean environment contract

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
| `SENTRY_AUTOMATION_PROVENANCE_SECRET` | HMAC authority for trusted automation-origin Sentry events |
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

Read the resulting deployment phase and health route before continuing.

### Clerk owner operations and email verification

The workspace-owner Clerk CLI login manages applications without one platform
key per app. Use `npx clerk@latest apps list` to identify Linejam's application,
then read its production domain status with:

```bash
npx clerk@latest api \
  "/platform/applications/<Linejam application ID>/domains/linejam.mistystep.io/status" \
  --platform
```

Require `dns.status`, `ssl.status`, `mail.status`, and overall `status` to be
`complete`. The app-scoped production domain uses `is_secondary: true`, keeping
Clerk infrastructure under `linejam.mistystep.io`, not shared `mistystep.io`.
Read the required DNS records from this existing instance's domain metadata.
Compare each target to the production instance's current requirements; do not
guess records or confuse frontend DNS with email authentication. Before treating
sign-in email as healthy, send a real code to an authorized, controlled mailbox
and confirm receipt and a successful production sign-in. The authenticated
Playwright smoke uses Clerk testing tokens, so its success does not prove email
delivery.

The production runtime secret is held at
`workstation/LINEJAM_PRODUCTION_CLERK_SECRET_KEY`; `.env.pass` names only this
entry for scoped local commands (`pass-env run -f .env.pass -- <command>`). The
CLI owner session is not the app's runtime secret. Never print, rotate, or copy
that secret into the repository or a command argument.

Clerk still requires its Dashboard for analytics and usage, application and
email logs, workspace members/plan/billing, Account Portal branding, Clerk
Protect settings, and custom OAuth provider credentials. For a missing sign-in
email, select the Linejam production instance and open
[Email Logs](https://dashboard.clerk.com/~/email-logs): filter by recipient and
the attempt time, inspect delivery status/provider reason, and check earlier
`bounce`, `spam_report`, or suppression-related `dropped` events for that address.
Do not remove a suppression or resend until its cause is understood. The CLI can
inspect and change supported application configuration and call Backend/Platform
APIs; do not describe the Dashboard-only operations as automated.

### Retained DigitalOcean rolling-deploy reference

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
PLAYWRIGHT_BASE_URL=https://linejam.mistystep.io pnpm qa:deployment-skew
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
Cloudflare can activate the Worker version. A present-but-different
`GUEST_TOKEN_SECRET` therefore fails deployment even though both providers have
a variable with the right name.

Run the production reconciliation before merging any manifest change. Strict
unexpected-name detection intentionally makes undeclared operational variables
a deployment blocker, so add a new name to the manifest before setting it live.
The post-deploy parity probe also reads the selected production function spec's
public deployment URL and refuses a `NEXT_PUBLIC_CONVEX_URL` that points at a
sibling deployment.

The same manifest also drives Convex runtime health. Sentry Uptime's active
`Linejam production health` monitor polls the exact web/Convex pair through
`/api/health` every 60 seconds. The endpoint checks required-name presence and
repeats the zero-write signed parity probe. The old five-minute GitHub
`Production Health Monitor` workflow is disabled; the hourly `Production Smoke`
workflow separately covers player behavior. These checks do not need a
production control-plane credential. See the
[observability contract](ops/observability-ci.md#observability-facts).

`LINEJAM_DEPLOY_ENVIRONMENT` is a non-secret deployment-type marker maintained
by the hosted bootstrap in the target Convex environment. Runtime health uses
it instead of guessing from the `convex.cloud` hostname, which is shared by dev,
preview, and production deployments.

The Cloudflare release build executes the Convex deploy before the OpenNext
build. Local checks never deploy production Convex code; the separately
commissioned shared-dev sync rejects production unconditionally. Production
operations require explicit operator authority and the hosted deployment guards.
The retired `LINEJAM_ALLOW_PROD_CONVEX_SYNC` flag cannot grant that authority.

## Backups and restore

The daily workflow was re-enabled on 2026-10-15 after an encrypted export,
private R2 hash readback, and isolated restore passed. The first restored
[Actions backup](https://github.com/misty-step/linejam/actions/runs/38798868394)
retains encrypted artifact `12002563957` for 30 days. A fresh loopback-only
anonymous restore verified exact equality of all 22 application tables and
118,964 documents, including IDs and creation times; import took 13.639 seconds
and the full drill took 26.608 seconds. Production was never an import target.
The [recovery receipt](https://github.com/misty-step/linejam/issues/564) owns
the ciphertext/R2 hashes, cleanup proof, and current alarm-delivery status.
The [forced-failure run](https://github.com/misty-step/linejam/actions/runs/38799093465)
reached the existing intake and the current standalone production-triage
consumer created and verified its [owned incident receipt](https://powder.mistystep.io/items/prod-triage-58e76f85530a4aed02f61dd408ab099046b42e023e5c861a5119d3e2a7ec7411).
Exact intake readback confirmed the canonical ticket, not merely HTTP success.
A [normal recovery backup](https://github.com/misty-step/linejam/actions/runs/38799277651)
succeeded after the forced failure and retained another encrypted artifact.

The 2026-10-15 UTC audit had found `Convex Backup` manually disabled since
2026-08-16, with no `CONVEX_DEPLOY_KEY_PROD` Actions secret. Its
[last successful run](https://github.com/misty-step/linejam/actions/runs/31939041782)
was on 2026-08-16; the Actions API lists no retained artifacts for that run.
Read-only provider inspection of the production `amiable-bulldog-848`
deployment found an empty cloud-backup list and no periodic-backup configuration.
The initially provisioned deploy key was denied `deployment:backups:create`.
Kaylee approved using the existing team access token from mirrodin pass
`workstation/CONVEX_API_KEY` in the same backup Actions secret instead; no new
credential is minted. The [recovery and drill receipt](https://github.com/misty-step/linejam/issues/564)
owns activation status, real backup/restore results, and failure-delivery proof.
Do not treat this workflow's configured schedule, a synthetic preflight, or a
successful webhook transport as evidence of a recoverable daily backup.

The [`Convex Backup` workflow](../.github/workflows/convex-backup.yml) is configured for
09:17 UTC daily and `workflow_dispatch`. It authenticates only with the GitHub
Actions secret `CONVEX_DEPLOY_KEY_PROD` and retains its fail-closed missing-secret
guard. Despite that legacy name, the secret must contain the approved
export-capable **team access token**, not the production deploy key. The export
passes it only through `CONVEX_OVERRIDE_ACCESS_TOKEN`, clears ambient deployment
keys and target selectors, refuses ambient `.env`/`.env.local` files, and
explicitly selects `--deployment amiable-bulldog-848`. The team token is broader
than a deploy key; moving or replacing it requires credential-owner authority.
The workflow encrypts the export before it leaves the runner. The uploaded
GitHub Actions artifact is named
`linejam-convex-backup`; its encrypted file is
`linejam-convex-<UTC date>-<short SHA>.zip.age` and its retention is 30 days.
No plaintext export is uploaded. A failed default-branch run uses the existing
GitHub `workflow_run` incident path described in the
[observability contract](ops/observability-ci.md#observability-facts).
The native Sentry Cron Monitor `linejam-convex-backup` independently detects
absence: it expects the same 09:17 UTC daily slot, allows 60 minutes for Actions
scheduling and completion, and opens an incident on the first missed or failed
check-in. The workflow reports `ok` only after the encrypted artifact upload
succeeds; earlier failures report `error` when the reporter can run, otherwise
the missing check-in is the backstop. A cancelled run cannot report success.
Sentry continues watching when the GitHub workflow is disabled or never starts.
One normal successful backup recovers the monitor. Its schedule and thresholds
come from `config/sentry-observability.json`, shared with the existing reporter.

The backup detector uses the existing Sentry scheduled-jobs alert
(`6074705`), alongside production smoke, with its existing Kaylee intake action.
It does not add a backup scheduler or a parallel notifier. The Sentry monitor
is owned by the Misty Step team; verify the downstream canonical incident and
owner, not just an accepted check-in or webhook HTTP 200. The 60-minute margin
is a detection tolerance, not an extension or proof of the 24-hour RPO.

The workflow owns the public age recipient. Its matching private identity is
held in mirrodin pass as `workstation/LINEJAM_BACKUP_AGE_IDENTITY`. The old
identity could not be located in the live or archived credential inventory or
repository docs; the replacement was generated directly into pass with Kaylee's
approval. Backups encrypted to the old recipient may not be restorable. Keep
the identity out of GitHub artifacts,
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
2. Resolve `workstation/LINEJAM_BACKUP_AGE_IDENTITY` from the operator
   credential plane into a local identity-file path. Do not paste its value into
   a command, log, issue, or pull request.
3. Use a fresh, protected local drill project with the repository-pinned Convex
   CLI available, no production credentials, and no application functions or
   crons. Initialize it with `CONVEX_AGENT_MODE=anonymous pnpm exec convex init`.
   Start its backend bound to loopback only, with telemetry disabled. Run the
   restore script from that project directory, using its absolute path when
   outside the checkout:

   ```bash
   scripts/ops/restore-convex-backup.sh \
     ./linejam-convex-<UTC date>-<short SHA>.zip.age \
     --identity "$AGE_IDENTITY_FILE" \
     local
   ```

   The local target requires `.convex/local/default/config.json` containing an
   `anonymous-*` deployment name. The script supplies that explicit anonymous
   selection in a controlled environment; it does not use `--deployment local`,
   which resolves through cloud authentication with the pinned CLI.

   For a separately authorized non-production cloud deployment, replace `local` with `dev` or
   `preview:<name>`. The script decrypts to a
   temporary file, runs `pnpm exec convex import --replace-all`, and removes
   the decrypted file on exit. It refuses a target that resolves to production
   unless `--allow-production` is supplied deliberately after confirming
   the target and obtaining operator authorization.

   If `CONVEX_DEPLOY_KEY` or `CONVEX_DEPLOYMENT_TOKEN` is supplied by the
   operator credential plane, omitting the target uses that deployment key.
   Production-shaped keys remain blocked unless `--allow-production` is passed.

4. Run the local or non-production health and representative data checks.
   A fresh local re-export can be compared with the decrypted backup in memory
   to verify every restored document without logging private contents. Stop the
   backend and securely remove the local database, plaintext, and ephemeral
   identity after verification. Record the redacted conclusion on the Kanban
   work item that owns the drill. The receipt must link the backup workflow run and retained
   proof artifact, and name the non-secret target class, backup filename, source
   SHA, observed completion time, and check outcome.

The declared recovery objectives are **RPO 24 hours** (requiring daily exports)
and **RTO 30 minutes** (requiring a timed, successful restore drill). Their
current evidence belongs in the recovery receipt, not an assertion inferred
from the cron expression. The successful backup and timed non-production
restore and failure receipt above establish a recovery checkpoint, not a
sustained daily-run history. Missing-run detection is a separate Sentry
failure-and-recovery acceptance surface below.
Historical drill records do not prove current recovery readiness.
These objectives assume the operator credential plane and a working Convex CLI
are available; they do not authorize a production import.

To test the existing incident route without exporting or mutating production,
dispatch `Convex Backup` on `master` with `failure_drill=true`. This deliberately
fails before export. Verify the completed failed run reaches the existing
`workflow_run` intake and produces a real operator/incident receipt; an HTTP 200
or a still-pending alert is not that receipt. Run a normal backup afterward.

To rehearse absence without interrupting daily backups, temporarily shorten
only the backup Sentry monitor's schedule and margin in an authorized drill,
seed one explicitly diagnostic check-in, then send nothing for a complete
expected slot plus its margin. Read back Sentry's generated `missed` check-in,
the native cron incident, and the existing intake's canonical owned ticket.
Restore the declared daily schedule and margin even if delivery fails. Dispatch
a normal `Convex Backup` on `master` with `failure_drill=false`; verify the new
retained encrypted artifact, its workflow-emitted `ok` check-in, and the same
monitor's recovered state. Never substitute a manual `ok` for recovery proof.
Diagnostic check-ins are not backups. Keep exact run/check-in/incident receipts
with the owning repair work; configuration alone is not acceptance evidence.

Retire this monitor together with the Convex backup only after the migration
owner confirms Convex is retired. A disabled workflow alone is an incident,
not authority to mute monitoring or resurrect an already-retired target.

## Deploy the web application (Cloudflare)

The normal path is the [Cloudflare release workflow](ops/cloudflare-worker.md):

1. Merge a green change to `master`.
2. Cloudflare Production consumes the exact successful protected-master CI source.
3. Confirm the served deployment source SHA.
4. Exercise the public health, host, and join routes.

Acceptance probes:

```bash
curl -fsS https://linejam.mistystep.io/api/health
curl -fsS -o /dev/null -w '%{http_code}\n' https://linejam.mistystep.io/host
curl -fsS -o /dev/null -w '%{http_code}\n' https://linejam.mistystep.io/join
```

All three routes must return HTTP 200. `/api/health` must report the intended
source SHA, connected Convex backend, guest-token parity, and production
observability readiness. Clerk sign-in is exercised separately by the
authenticated production smoke, not inferred from a configured public key.
`guestTokenParity` is a proof result only; neither secret nor a fingerprint is
returned.

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
available. Hosted `merge-gate` (including selector smoke in E2E Mirror),
production smoke, and the live route probes are separate acceptance surfaces;
one does not substitute for the others.

## Troubleshooting

### Guest token verification fails

1. Confirm `GUEST_TOKEN_SECRET` exists on the production Worker.
2. Confirm the same value exists in the production Convex environment.
3. Confirm the active Worker version includes the intended secret bindings.
4. Re-run `/api/guest/session` and inspect value-free runtime logs.

Do not print either value to compare it. Compare secret fingerprints through an
approved one-way check when direct control-plane verification is insufficient.

### Smoke cannot launch Chromium

Confirm the GitHub Actions Playwright installation step completed and its
browser revision matches the lockfile. Do not install an unrelated browser
revision at runtime.

### Clerk-backed host or join hangs

Confirm `clerk.linejam.mistystep.io` resolves to Clerk's frontend API service, the TLS
certificate verifies, and `CLERK_JWT_ISSUER_DOMAIN` matches the production
Clerk instance. Guest mode should remain available when Clerk is degraded.

## Rotation and rollback

For `GUEST_TOKEN_SECRET`, update the Worker and Convex in one bounded window,
then redeploy and replay guest creation. Existing guest tokens become invalid.
Rotate `SENTRY_AUTOMATION_PROVENANCE_SECRET` in the smoke workflow secret stores
and production Convex environment in one bounded window; verify one trusted
event before ending the window.

Production release rollback follows [the Worker guide](ops/cloudflare-worker.md).
If a source release is bad, use a normal `git revert` of the offending commit,
pass the gates, and merge the forward fix to `master`. Never use destructive
Git history to simulate rollback.

The retained App Platform recovery path supports provider-level rollback to a
prior successful deployment only with explicit recovery authority and the
Cloudflare release owner stopped. Keep DO auto-build disabled. This
reuses the already-built container, so recovery is minutes, not a full
pipeline cycle. The 2026-07-17 drill measured 104 seconds to `ACTIVE` for
the rollback and 115 seconds for the roll-forward, with `/api/health`
returning 200 throughout (frontend rollback RTO: about 2 minutes).

```bash
APP_ID="$LINEJAM_APP_ID"
TARGET="$(doctl apps list-deployments "$APP_ID" \
  --format ID,Phase --no-header | awk '$2 == "SUPERSEDED" { print $1; exit }')"

# Validate, then execute only within the authorized recovery operation.
curl -s -X POST "https://api.digitalocean.com/v2/apps/$APP_ID/rollback/validate" \
  -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"deployment_id\":\"$TARGET\",\"skip_pin\":true}"
curl -s -X POST "https://api.digitalocean.com/v2/apps/$APP_ID/rollback" \
  -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"deployment_id\":\"$TARGET\",\"skip_pin\":true}"
```

With `skip_pin: true` there is no pinned rollback state to revert: to return
to the newest release, run the same rollback call against the most recent
healthy retained deployment ID. This does not re-enable auto-build; do not
rebuild current Cloudflare-ingress source on DO. `doctl` 1.163 has no rollback
subcommand; the REST
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
- [ ] for DO recovery only, `pnpm ops:do-drift` reports the retained app clean
- [ ] `pnpm ci:dagger:all` passes or its environment limitation is recorded
- [ ] hosted merge and smoke gates pass
- [ ] the active web deployment matches the intended source SHA
- [ ] production Convex env reconciliation names every required manifest entry
- [ ] `linejam.mistystep.io` health, host, and join routes return 200
- [ ] production Sentry monitors report current check-ins
- [ ] one signed Sentry alert creates or reuses exactly one canonical GitHub Issue
- [ ] Clerk custom-domain DNS and TLS verify
- [ ] runtime log scans contain no new fatal, panic, uncaught, or 5xx errors
- [ ] rollback is a known prior source/config state, not another provider
