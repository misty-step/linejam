# Isolated local development and QA

This is a real Next.js + self-hosted Convex environment. It does not use the
shared development backend, deploy a preview, contact Clerk, or require provider
credentials. Guest room creation, realtime writing, reveal, and rematch use the
normal product code and the local Convex database.

## Prerequisites

- Node.js 22 or newer on the host. The application image pins Node **22.23.2**.
- A reachable **local Linux-container Docker daemon**, including rootless Docker
  or Docker Desktop on a Linux/macOS host.
- Docker Compose **2.32 or newer**, and BuildKit/buildx. Install CLI plugins where
  Docker can discover them independently of a personal Docker configuration.
- Registry/package/browser-download access for the initial image builds. No
  registry login is imported. After images are built, application, backend, sync,
  and browser QA containers use a per-project Docker bridge with loopback-only
  published ports. Runtime egress is not firewall-blocked; hosted integrations are
  disabled and their credentials are absent. Repository checks run with networking
  disabled entirely.

The image installs the package manager pinned in this repository:
**pnpm 10.22.0**, with `pnpm install --frozen-lockfile`. Chromium is installed from
the lockfile's **Playwright 1.58.2**, not a moving browser image. Convex is the
[official backend image](https://github.com/get-convex/convex-backend/tree/main/self-hosted),
pinned by a verified published multi-platform digest in `compose.yaml`. A source
commit is not necessarily a published image tag.

A daemon permission error is a missing capability, not permission to change
system groups, socket modes, or another person's services. Use an already
available local daemon. To select an authorized rootless daemon, set
`DOCKER_HOST` to its absolute `unix:///.../docker.sock` endpoint. The CLI records
that socket with the project and refuses to switch existing state to another
socket. It rejects remote Docker endpoints and non-default named contexts.
The CLI does not start or stop the Docker daemon.

Keep the daemon's data directory outside the watched checkout. The acceptance
run encountered filesystem watch-queue overflow with a co-located temporary
Docker store; source sync, hot reload and clean interruption were then verified
with that store outside the checkout. Do not change system watch limits to mask
an in-checkout container data directory.

## Start from a fresh checkout

No host dependency installation, dotenv copying, Convex login, or Clerk setup is
needed for these direct Node commands:

```sh
node scripts/local/cli.mjs up --project studio
node scripts/local/cli.mjs status --project studio
```

Open **http://127.0.0.1:3333**. Use two independent browser profiles or a normal
window plus a private window for two distinct guests. Create a room, join its
code in the second browser, play the nine writing rounds, reveal both poems,
then start the next round to rematch.

`up` performs these operations in order:

1. Validate project/port authority and acquire this project's operation lock.
2. Build the isolated application image from the checkout, excluding host
   secrets and generated output.
3. Start the pinned Convex backend and wait for its real `/version` healthcheck.
4. Capture the backend's generated admin key without printing it.
5. Set the local development marker, disabled telemetry, and a generated
   matching guest HMAC secret on **this local backend only**.
6. Run the installed Convex CLI with an explicit self-hosted env file and
   `dev --once --typecheck disable --codegen disable`. This pushes the actual
   checked-in functions; it does not select a cloud project or mutate the
   checkout's generated files.
7. Start Next and wait for `/api/health` to prove real Convex connectivity,
   environment compatibility, and frontend/backend guest-secret parity.
8. Write a secret-free source/readiness receipt.

These backend configuration/code writes are intentional local writes; `up` is
not a read-only check. It does **not** run the deployment-oriented `pnpm build`,
`convex deploy`, shared-development synchronization, or provider reconciliation.

The package aliases are equivalent:

```sh
pnpm local:up --project studio
pnpm local:status --project studio
```

Without `--project`, the suffix is derived from the checkout's absolute path, so
different worktrees get different default project names. An explicit suffix
`studio` becomes the Docker project `linejam-local-studio`. Lowercase letters,
digits, and hyphens are accepted, up to 32 characters; deployment-like names and
path traversal are rejected.

## Hot reload without mounting host environment files

```sh
node scripts/local/cli.mjs dev --project studio
```

`dev` first performs the same one-shot synchronization and readiness checks as
`up`. It then runs a separate real Convex development watcher and Compose Watch
for both source copies. Next handles frontend hot reload. Backend edits are
pushed by `convex dev` to the isolated local service. Dependency and local-tool
changes rebuild the images. For changes to `compose.yaml`, stop and restart
`dev` so the new composition is loaded.

There is **no checkout bind mount into Next or Convex CLI containers**. Docker
build exclusions also apply to Compose Watch. Root and nested dotenv files,
personal tool/provider configuration, dependency folders, and `.qa` are excluded;
only `.env.example` is allowed as documentation. Source synchronization never
mounts `.env.local` or `.env.production.local`.

Press **Ctrl-C** to stop watch mode and tear down this project's containers and
network, preserving its database, generated secrets, and evidence. Do not run
another mutating command against the same project while `dev` owns its lock.
Use another project for concurrent automated QA. `status` remains available.

The readiness receipt describes the exact **last one-shot synchronization**.
It is not a claim that subsequent watch edits have been deployed successfully.
Stop `dev` and run `up` or `qa` again when an exact source-to-runtime receipt is
needed.

## Concurrent projects and endpoint ownership

```sh
node scripts/local/cli.mjs up --project review-a \
  --app-port 3334 --convex-port 3220 --site-port 3221
node scripts/local/cli.mjs up --project review-b \
  --app-port 3335 --convex-port 3230 --site-port 3231
```

All three ports must be distinct integers from 1024 through 65535. Published
ports bind **127.0.0.1 only**. Each project has its own database volume, generated
secrets, image names, network, artifacts, operation lock, and ownership marker.
Existing project ports are immutable: select a fresh project or explicitly
reset the old one to change them. Later `status`/`down`/`reset` commands only need
the project name; its recorded ports are reused.

Use a separate browser profile/context for each player. Different local projects
can share a profile: their guest cookies are namespaced by the validated public
backend origin, because browser cookies themselves do not isolate ports.

| Consumer                     | Default endpoint        | Purpose                         |
| ---------------------------- | ----------------------- | ------------------------------- |
| Human browser                | `http://127.0.0.1:3333` | Next application                |
| Browser Convex client        | `http://127.0.0.1:3210` | Public realtime/API endpoint    |
| Browser HTTP actions/storage | `http://127.0.0.1:3211` | Convex site endpoint            |
| Next server and local sync   | `http://convex:3210`    | Container-only backend endpoint |

`NEXT_PUBLIC_CONVEX_URL` is the browser origin. `CONVEX_SERVER_URL` is the separate
server-only Docker endpoint. Convex reports the public browser origin through
its built-in `CONVEX_CLOUD_URL`, because its `CONVEX_CLOUD_ORIGIN` is configured
with the selected loopback port.

Both local flags, `LINEJAM_LOCAL=1` and `NEXT_PUBLIC_LINEJAM_LOCAL=1`, and
`LINEJAM_DEPLOY_ENVIRONMENT=development` are explicit. Local runtime code rejects
cloud browser endpoints or conflicting deployment markers. Production guards
are not relaxed for production deployments. Local guest keys remain required.

## One-shot repository checks

```sh
node scripts/local/cli.mjs check --project checks
```

This builds the isolated application image, then runs these **repository-owned**
commands in a disposable container with `network_mode: none`:

1. `pnpm format:check`
2. `pnpm ci:prepush` — the existing fast gate, rather than a second copy of its
   provider-retirement/typecheck/lint/unit-test composition
3. `pnpm test:ci` — coverage collection and the repository's coverage threshold
4. `pnpm build:check` — Next compilation, **not** the deployment wrapper

The coverage command intentionally follows the fast gate because the fast gate
currently runs non-coverage unit tests. Local runtime env flags are removed for
ordinary tooling/unit tests so local defaults do not contaminate their existing
environment-isolation contracts. Only the Next compilation receives the local
runtime configuration and generated guest key.

No app/backend services are started by `check`, and there is no provider network
access inside the check container. Registry/dependency downloads occur only
while constructing the image. Per-command logs and a success/failure result are
retained in `.qa/local/linejam-local-checks/artifacts/check/`.

## One-shot rendered lifecycle QA

```sh
node scripts/local/cli.mjs qa --project qa \
  --app-port 3336 --convex-port 3240 --site-port 3241
```

`qa` performs a fresh build, local backend synchronization, and readiness proof
before running the existing browser specs selected by
`scripts/local/playwright.config.ts`:

- early guest-entry smoke;
- two-browser room creation and realtime join;
- a full nine-round game and reveal of the actual submitted lines;
- a complete second game/rematch with distinct human lines preserved;
- canonical guest-flow screenshots and recorded host video.

These are the existing product-flow tests and UI helpers, not a second game
implementation. The runner refuses a result where selected cases were skipped.
It uses one worker and no retries so a failed lifecycle is not hidden.

Chromium uses the **same loopback app/Convex origins** as a human host browser.
Inside the QA container, three temporary TCP relays forward only those fixed
origins to `app:3000`, `convex:3210`, and `convex:3211` on the project bridge.
They preserve real HTTP/WebSocket traffic, cookies, and origin checks; they do
not mock responses or mutate gameplay. They close with the one-shot QA process.
No host networking or external provider connectivity is needed.

Artifacts are bind-mounted only into this project's ignored output directory:

```text
.qa/local/linejam-local-qa/
  receipt.json
  artifacts/
    backend-source.json
    qa/
      results.json
      report/
      test-results/
      evidence/
        result.json
        raw-video/
        [canonical lifecycle screenshots]
```

Playwright retains failure screenshots/traces where the existing test's context
lifecycle supports them; the evidence spec separately captures its manual guest
contexts and video. A receipt contains exact source fingerprints, lockfile and
package-manager identity, runtime image IDs, and readiness observations, never
an admin key or HMAC secret. Keep QA artifacts local unless intentionally
reviewing/redacting them: they can contain room codes and the lines typed by QA.

**QA leaves the app and backend running**, on both success and failure, for
inspection. Its caller owns the subsequent `down` or `reset`.

## Teardown, reset, and failure recovery

Preserve the local database, guest identities, and evidence:

```sh
node scripts/local/cli.mjs down --project studio
node scripts/local/cli.mjs down --project qa
```

Delete only one owned project's database volume, generated keys, and artifacts:

```sh
node scripts/local/cli.mjs reset --project studio --confirm linejam-local-studio
```

`reset` requires the full project name as an explicit confirmation. Before any
removal, the CLI checks the checkout's ownership marker and every matching
Docker container/network/volume's owner and checkout labels. Unknown or
foreign resources cause a refusal. It never prunes Docker, removes another
project's data, changes a cloud environment, or deletes shared image/build
caches. The scoped state directory is atomically retired before recursive
removal, so a fresh startup cannot race with deletion of old state.

| Failure                                      | Recovery                                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker unavailable/permission denied         | Supply access to an already authorized local daemon; do not change system permissions implicitly. Rerun with the project's recorded Unix socket.                    |
| Port already allocated                       | Use another project and three unused ports. An existing project's ports cannot be silently reassigned.                                                              |
| Image download/install failure               | Restore registry/network access and rerun. Frozen dependency locks and pinned images remain authoritative; no provider credentials are needed.                      |
| Convex synchronization failure               | Fix the reported source/schema issue and rerun `up`. The frontend is not started as a falsely healthy replacement. Existing local data is preserved.                |
| App health/guest-secret parity failure       | Inspect the readiness failure; rerun `up` to synchronize the generated key and source. If disposable state is corrupt, use the confirmed scoped `reset`, then `up`. |
| Browser QA failure                           | Inspect `artifacts/qa/`; services remain available. Run `down` when finished or `reset` for a clean database.                                                       |
| Active project lock                          | Stop its owning `dev`/CLI process, or choose another project. Locks from confirmed dead PIDs are reclaimed; live owners are never killed.                           |
| Ownership mismatch or state without a marker | Do not adopt/delete it automatically. Use another project and investigate the original owner's local state.                                                         |
| Forced interruption                          | Rerun `down` with the same project/socket; only a confirmed dead operation lock is reclaimed.                                                                       |

State lives under **`.qa/local/<full-project-name>/`**, already ignored by Git
and explicitly excluded from Docker source copies. Generated guest/admin files
are mode 600 below a mode-700 scoped directory. They are not printed, stored in
Compose's environment interpolation file, or passed as command-line arguments.
Only the sync/watcher receives the local admin key; Next receives only the guest
key; browser QA receives neither. Rootless Docker uses container UID 0, which
maps to the caller's host UID; rootful containers use the caller's numeric UID/GID
so mounted evidence remains owned by the caller.

For long-running agent sessions, the agent/process supervisor that launches
`dev` owns interruption and shutdown. A session-scoped rootless daemon, if used,
has a separate owner: tear down the project before that owner stops the daemon.

## Maintainer integration and references

`package.json` exposes these direct mappings (no new dependencies are needed):

| Script         | Command                             |
| -------------- | ----------------------------------- |
| `local:up`     | `node scripts/local/cli.mjs up`     |
| `local:dev`    | `node scripts/local/cli.mjs dev`    |
| `local:status` | `node scripts/local/cli.mjs status` |
| `local:down`   | `node scripts/local/cli.mjs down`   |
| `local:reset`  | `node scripts/local/cli.mjs reset`  |
| `local:check`  | `node scripts/local/cli.mjs check`  |
| `local:qa`     | `node scripts/local/cli.mjs qa`     |

The runtime follows the official
[Convex self-hosted README](https://github.com/get-convex/convex-backend/blob/7cce8fbc9a4f6125c0f287351170d76caae3ba3c/self-hosted/README.md),
[backend entrypoint](https://github.com/get-convex/convex-backend/blob/7cce8fbc9a4f6125c0f287351170d76caae3ba3c/self-hosted/docker-build/run_backend.sh),
[admin-key generator](https://github.com/get-convex/convex-backend/blob/7cce8fbc9a4f6125c0f287351170d76caae3ba3c/self-hosted/docker-build/generate_admin_key.sh),
and [image-tag publication workflow](https://github.com/get-convex/convex-backend/blob/7cce8fbc9a4f6125c0f287351170d76caae3ba3c/.github/workflows/release_self_hosted_images.yml).
The self-hosted selection and env-file behavior are grounded in the repository's
pinned [Convex CLI 1.42.3](https://github.com/get-convex/convex-js/tree/npm/1.42.3/src/cli),
and source isolation follows [Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/).
