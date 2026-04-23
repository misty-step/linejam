---
name: deploy
description: |
  Ship linejam to its three targets: Vercel (Next.js frontend), Convex
  (backend), Fly.io (Canary responder). Capture a structured receipt
  (sha, version, URL, rollback handle), stop when the target reports
  healthy. Does not monitor, does not triage, does not decide when to
  deploy. Push-to-master is the production deploy mechanism; this skill
  exists to (a) validate pre-push, (b) run manual deploys, (c) route
  rollback, and (d) keep the three targets in sync.
  Use when: "deploy", "ship it", "ship to prod", "release", "push master",
  "deploy the responder", "redeploy Convex".
  Trigger: /deploy, /ship-it, /release.
argument-hint: '[--target frontend|convex|responder|all] [--rollback] [--dry-run]'
---

# /deploy (linejam)

Linejam has three deploy targets. Two are automated (Vercel + Convex,
both triggered by master push). One is manual (Fly.io responder). The
release workflow is also automated (semantic-release tags + CHANGELOG
on master push). This skill is the operator cockpit for all four.

## Execution Stance

You are the executive for a narrow, high-stakes action.

- Keep the go/no-op/abort decision on the lead model. Do not delegate.
- Delegate artifact validation and log tailing to subagents (`builder` for
  tool invocation, `critic` for post-deploy sanity).
- **Pre-push gate is non-negotiable.** `pnpm ci:prepush` must be green
  before master push. The lefthook pre-push hook enforces this; never
  bypass with `--no-verify` (repo brief, Invariant #1).

## Session Signal

When the user says "ship it" / "deploy" / "push master" with no further
context, assume **master push after green Dagger** targeting all three
surfaces. Do NOT re-ask for environment — prod is encoded in Vercel +
Convex + Fly secrets, not in invocation args. The user explicitly told
us: it's encoded.

## Targets

Three targets, three trigger mechanisms, three rollback handles. Do not
conflate them.

| Target    | Path                              | Trigger                                        | Rollback                                                                                                    |
| --------- | --------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Frontend  | Vercel (Next.js 16)               | `git push origin master`                       | `vercel promote <prev-url>`                                                                                 |
| Backend   | Convex (prod deployment)          | `pnpm build` during Vercel build               | Convex dashboard OR `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1 pnpm exec convex deploy --prod` from a known-good sha |
| Responder | Fly.io `linejam-canary-responder` | `flyctl deploy -c fly.responder.toml`          | `flyctl releases rollback <version>`                                                                        |
| Release   | GitHub (tag + CHANGELOG)          | `.github/workflows/release.yml` on master push | Manual `gh release delete` + `git tag -d` (rare)                                                            |

## Contract

**Input:** target selector (default `all` = frontend + convex, since
those ship together on master push; responder is opt-in). Optional
`--version <sha>` (default: `HEAD` on `master`). Optional `--rollback`.

**Output:** deploy receipt to stdout as JSON; append to
`.evidence/deploys/<date>/<sha-short>.json` for browsability. If a
cycle manifest exists (`.spellbook/cycle-manifest.json` from
`/flywheel`), append to `deploy_receipts[]`.

**Stops at:** every selected target reports healthy. Frontend: Vercel
`readyState=READY` + `/api/health` 2xx. Convex: deploy log reports
`Convex functions ready`. Responder: Fly `/healthz` 2xx + all http
service checks `passing`.

**Does NOT:** monitor post-deploy, triage failures, rollback
automatically, build artifacts, manage secrets, promote across envs.

## Protocol

### 1. Detect target(s)

Default selector = `frontend,convex` (they ship atomically via master
push; `pnpm build` runs both). Responder is opt-in because its deploy
cadence is decoupled.

- `--target frontend` → Vercel only (no-op if master sha == Vercel sha)
- `--target convex` → Convex only (manual push; requires the speed bump)
- `--target responder` → Fly.io only
- `--target all` → all three

No config file. Target registry is encoded here and in:

- `package.json` (`build`,
  `generate:releases` scripts)
- `fly.responder.toml` (Fly app)
- `Dockerfile.responder` (responder
  container)
- `scripts/ci/bootstrap-convex-env.mjs`
  (hosted Convex deploy mode resolution)
- `.github/workflows/release.yml`
  (semantic-release on master)

### 2. Validate (parallel)

All must pass before any deploy fires:

- **Ref exists:** `git rev-parse --verify <version>` resolves to a sha
  on `master`.
- **Ref is merged:** commit is an ancestor of `origin/master` (repo
  brief, Invariant #9: base branch is `master`).
- **Gate green:** `pnpm ci:prepush` was the last gate run for this sha,
  or re-run it now. Repo brief: **`pnpm ci:prepush` IS the gate.** Do
  not rename it "CI" or "the pipeline"; it shells to
  `pnpm ci:dagger:all`. If `gh` is available, also confirm the hosted
  `ci.yml` mirror is green for this sha. If hosted is red but local
  Dagger is green, diagnose via `dagger/src/index.ts`; do not bypass.
- **No placeholder Canary keys:** grep the diff and live Vercel env for
  `NEXT_PUBLIC_CANARY_ENDPOINT` / `NEXT_PUBLIC_CANARY_API_KEY`
  placeholders. Invariant #4: build-bearing lanes fail fast on
  placeholders by design. Never push placeholder values to prod Vercel.
- **`GUEST_TOKEN_SECRET` parity:** Invariant #8. The value must be
  identical in Vercel (prod + preview) and Convex (prod + preview).
  `scripts/ci/bootstrap-convex-env.mjs`'s `buildConvexEnvBootstrapPlan`
  seeds Convex from the env passed into the hosted build, so the
  Vercel-side value is the source. Verify:
  ```bash
  vercel env ls | rg GUEST_TOKEN_SECRET
  pnpm exec convex env list | rg GUEST_TOKEN_SECRET
  ```
  Mismatch silently drops guest joins (repo brief Gotcha #2).
- **Clerk JWT `convex` template exists:** required for Convex auth to
  accept Clerk-issued tokens. `LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE`
  must stay `0` in prod (`docs/deployment.md` §3a); the template is
  pre-created per the ADR for hybrid auth
  (`docs/adr/0001-hybrid-auth-signed-guest-tokens.md`).
- **Target reachable:** `vercel whoami`, `flyctl auth whoami`,
  `pnpm exec convex --version`.
- **Responder-only:** confirm `fly.responder.toml` and
  `Dockerfile.responder` are unchanged from master, OR the diff is
  intentional. The responder container pins Playwright to
  `v1.58.2-noble`; bumping Playwright locally without bumping the
  Dockerfile creates silent smoke-suite drift.

### 3. Idempotence check

Compare currently-deployed sha to `<version>`:

- **Frontend:** `vercel inspect <prod-url> --json | jq -r '.meta.githubCommitSha'`
- **Convex:** no public "current sha" endpoint; diff `convex/` between
  `<version>` and the last receipt's sha. If identical, `build` will
  still run but the hosted Convex deploy is effectively idempotent.
- **Responder:** `flyctl status --app linejam-canary-responder --json
| jq -r '.Deployment.ImageRef'` — parse sha from image label.

If a target's currently-deployed sha == `<version>`: emit a per-target
receipt with `action: "no-op"` and carry forward the existing
`rollback_handle`. Do not skip the others if only one is idempotent.

### 4. Capture rollback handles BEFORE deploy

Per target. Abort if any target cannot surface a handle.

- **Frontend (Vercel):** previous prod deployment URL from
  `vercel ls linejam --prod --json | jq -r '.[1].url'`. Used by
  `vercel promote <url>`.
- **Backend (Convex):** Convex does **not** expose a CLI-native
  rollback handle. The handle is the **previous sha on `master`** —
  rollback = checkout prior sha + `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1
pnpm exec convex deploy --prod` (Invariant #3: the flag is an
  intentional speed bump). Capture `git rev-parse HEAD~1` on master as
  the handle and document that rollback is via redeploy from that sha.
  This is why we require a green `master` before shipping: the rollback
  handle is only as good as the sha it points at.
- **Responder (Fly):** `flyctl releases --app linejam-canary-responder
--json | jq -r '.[0].version'` — the integer release, e.g. `v42`.

### 5. Dispatch

Per-target recipes below. Lead model decides order (usually parallel
frontend+convex via master push; responder separate). Deploy calls
themselves are serial per-target; the two Vercel-plus-Convex deploys
are fused into a single `git push origin master`.

### 6. Wait for healthy

Per target:

- **Frontend:** poll `vercel inspect <prod-url> --json | jq -r
'.readyState'` until `READY`, then `curl https://www.linejam.app/api/health`
  → 2xx. Note `/api/health` reports app health separately from Canary
  readiness (repo brief Known Debts); missing Canary ingest is
  **degraded observability, not a gameplay outage**.
- **Backend:** Vercel build log shows `Convex functions ready` OR
  `pnpm exec convex function-spec --prod` returns 0.
- **Responder:** `curl https://linejam-canary-responder.fly.dev/healthz`
  → 2xx, AND `flyctl status --app linejam-canary-responder --json`
  shows all http_service checks `passing` (15s grace, 30s interval per
  `fly.responder.toml`).

Grace window: 300s (Vercel cold-start + Convex schema sync can be
slow). If not healthy in the window: emit receipt with
`status: "unhealthy"`, name the rollback command for the failing
target, do **not** auto-rollback.

### 7. Emit receipt

One receipt per target, wrapped in an envelope if multi-target.

```json
{
  "envelope": "linejam-deploy",
  "operator": "phrazzld",
  "timestamp": "2026-04-20T14:32:10Z",
  "sha": "abc1234567890...",
  "receipts": {
    "frontend": {
      "target": "vercel",
      "app": "linejam",
      "url": "https://www.linejam.app",
      "healthcheck_url": "https://www.linejam.app/api/health",
      "deploy_id": "dpl_...",
      "rollback_handle": "https://linejam-prev.vercel.app",
      "status": "healthy",
      "action": "deployed",
      "duration_seconds": 94
    },
    "convex": {
      "target": "convex",
      "app": "linejam-prod",
      "url": "https://<deployment>.convex.cloud",
      "rollback_handle": "<previous-master-sha>",
      "status": "healthy",
      "action": "deployed"
    },
    "responder": {
      "target": "fly",
      "app": "linejam-canary-responder",
      "url": "https://linejam-canary-responder.fly.dev",
      "healthcheck_url": "https://linejam-canary-responder.fly.dev/healthz",
      "rollback_handle": "v42",
      "status": "healthy",
      "action": "no-op"
    }
  }
}
```

## Per-Target Recipes

### Frontend (Vercel)

- **Trigger:** merge to `master`. Automatic. `pnpm build` is the
  Vercel build command:
  ```bash
  # package.json
  "build": "node ./scripts/ci/bootstrap-convex-env.mjs --deploy"
  ```
  This is _not_ `next build` — the bootstrap script orchestrates
  Convex deploy + next build via `deployHostedConvex()`. See
  `scripts/ci/bootstrap-convex-env.mjs:319` (`deployHostedConvex`).
- **Observe:** `vercel ls linejam --prod`, `vercel logs <url>`,
  `vercel inspect <url>`. Vercel dashboard shows build progress.
- **Manual deploy (rare):** `vercel --prod`. Only for when master push
  didn't trigger a build (e.g., revert sequence).
- **Rollback:** `vercel promote <prev-url>` — promotes the prior
  deployment to the production alias. Instant; no rebuild.
- **Env vars owned here:**
  `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT`, `CONVEX_DEPLOY_KEY`,
  `GUEST_TOKEN_SECRET`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
  `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN`, `CANARY_ENDPOINT`,
  `CANARY_API_KEY`, `NEXT_PUBLIC_CANARY_ENDPOINT`,
  `NEXT_PUBLIC_CANARY_API_KEY`, `LINEJAM_CANARY_WEBHOOK_SECRET`,
  `LINEJAM_CANARY_WEBHOOK_URL`, `OPENROUTER_API_KEY`
  (server-only, for Convex bridging). Invariant #4: Canary
  `NEXT_PUBLIC_*` must be real, never placeholders.
- **Gotcha:** `next.config.ts:6` calls `validateEnv()` during
  production builds. Missing env → build fails hard. Check Vercel
  build logs first.

### Backend (Convex)

- **Trigger:** piggybacks on frontend Vercel build via `pnpm build`.
  `deployHostedConvex()` in `scripts/ci/bootstrap-convex-env.mjs`
  resolves deploy mode from `CONVEX_DEPLOY_KEY` + `VERCEL_ENV`:
  - prod key on prod env → `deploy-convex` (full Convex deploy)
  - preview key on preview env → `build-only` (compile only — do NOT
    mutate Convex preview backends from Vercel previews unless
    `LINEJAM_FORCE_HOSTED_PREVIEW_CONVEX_DEPLOY=1`)
  - missing key on prod → **hard error** (the script refuses to ship
    frontend against stale backend auth config;
    `bootstrap-convex-env.mjs:326`)
    The script also seeds `GUEST_TOKEN_SECRET` and
    `CLERK_JWT_ISSUER_DOMAIN` into Convex before deploy
    (`buildConvexEnvBootstrapPlan`, line 193).
- **Manual prod push:** only when rolling forward outside a master
  push:
  ```bash
  LINEJAM_ALLOW_PROD_CONVEX_SYNC=1 pnpm exec convex deploy --prod
  ```
  Invariant #3: **never** push prod Convex without the flag. Dagger
  refuses by default; the flag is an intentional speed bump, not a
  nuisance. If you find yourself running this command in a tight loop,
  stop and diagnose — repeat prod pushes outside master are a smell.
- **Rollback:** Convex has no native rollback CLI. Two options:
  1. Revert the offending commit on `master`, push. Vercel rebuild
     triggers the cascading Convex redeploy.
  2. Checkout the last-known-good sha (receipt's `rollback_handle`),
     then `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1 pnpm exec convex deploy
--prod`. Document the sha in the receipt.
  - Environment variables are **not** versioned — rolling back code
    does not roll back env. If an env change is the root cause, fix
    the env in the Convex dashboard or via `pnpm exec convex env set
<KEY> <VALUE> --prod`.
- **Env vars owned here:** same list as frontend, plus
  `OPENROUTER_API_KEY` (primary home for AI player LLM access — server
  secret, not bridged to the client). Seeded by Vercel build via the
  bootstrap script; managed manually in the Convex dashboard.
- **Gotcha:** `convex/_generated/api.d.ts` regenerates on every
  `convex dev` / `pnpm build`. If types drift from what's in the repo,
  the build will fail. Regen happens in the bootstrap step of
  `pnpm build`.

### Canary responder (Fly.io)

- **Trigger:** manual. There is no CI pipeline for the responder
  (intentional — it runs independent of frontend cadence).
  ```bash
  flyctl deploy -c fly.responder.toml --app linejam-canary-responder
  ```
- **Image:** `Dockerfile.responder` bakes Playwright 1.58.2 + pnpm
  10.22.0 + the responder script. `CMD ["pnpm", "canary:responder"]`
  which runs `scripts/canary/responder.mjs`.
- **Healthcheck:** `GET /healthz` on port 8787. `fly.responder.toml`
  configures 15s grace, 30s interval, 5s timeout. `min_machines_running
= 1` (no cold starts; the responder must always be warm).
- **Observe:** `flyctl status --app linejam-canary-responder`,
  `flyctl logs --app linejam-canary-responder`,
  `flyctl releases --app linejam-canary-responder`.
- **Rollback:** `flyctl releases rollback <version> --app
linejam-canary-responder`. Instant; reuses prior image from Fly
  registry.
- **Env vars owned here:** `CANARY_ENDPOINT`, `CANARY_API_KEY`,
  `LINEJAM_CANARY_WEBHOOK_SECRET`, `LINEJAM_SMOKE_RUNNER=playwright`
  (hosted), `PLAYWRIGHT_BASE_URL=https://www.linejam.app`,
  `PLAYWRIGHT_REQUIRE_AUTH_SMOKE=1`,
  `LINEJAM_ENFORCE_SMOKE_URL_ALLOWLIST=1`,
  `LINEJAM_ALLOWED_SMOKE_ORIGINS=https://www.linejam.app`,
  plus Clerk test creds for authenticated smoke
  (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
  `PLAYWRIGHT_CLERK_TEST_EMAIL`). Set via
  `flyctl secrets set ... --app linejam-canary-responder`.
- **Webhook re-registration:** after any responder URL change:
  ```bash
  pnpm canary:webhook:setup
  ```
  Rerunnable by design (repo brief: "expected to be rerunnable") —
  converges on one correct subscription for the responder URL instead
  of creating duplicates. Stale duplicates cause double-trigger smoke;
  the setup script replaces them.
- **Gotcha:** the responder uses **direct Playwright**, not Dagger, via
  `LINEJAM_SMOKE_RUNNER=playwright`. Local Dagger remains the
  authoritative contract; the responder is the "same smoke suite,
  thinner runtime" path (repo brief: "Hosted responders should set
  `LINEJAM_SMOKE_RUNNER=playwright`"). Do not embed Dagger in the
  webhook worker.

### Release (semantic-release)

- **Trigger:** master push → `.github/workflows/release.yml` →
  `pnpm semantic-release`. Auto CHANGELOG, auto tag, auto GitHub
  release. Synthesize step runs Gemini over the git log to produce
  user-friendly notes (`scripts/synthesize-release-notes.mjs`).
  The Conventional Commits history drives version bump (commitlint
  enforces this on commit-msg).
- **Manual release (rare):**
  ```bash
  pnpm generate:releases   # = npx tsx scripts/generate-releases.ts
  ```
  Only for reconciling a drift between local tags and GitHub releases.
  Do not run in tight loops.
- **Rollback:** semantic-release has no native rollback. If a release
  was cut for a bad sha:
  1. Revert the commit on `master`, push → new release with the
     revert. Preferred.
  2. If the release must be pulled: `gh release delete vX.Y.Z`,
     `git tag -d vX.Y.Z`, `git push --delete origin vX.Y.Z`. Rare;
     document why.
- **Gotcha:** the release workflow uses `GH_RELEASE_TOKEN` (not the
  default `GITHUB_TOKEN`) so the push doesn't retrigger CI. Don't
  rename this secret.

## Rollback Mode

`/deploy --rollback [--target <name>] [--to <handle>]`.

- Default `<target>`: the last target in the most recent receipt that
  was `action: "deployed"` (not `"no-op"`).
- Default `<handle>`: the `rollback_handle` from the most recent
  receipt in `.evidence/deploys/`.
- Emit a new receipt with `action: "rolled-back"` and the new current
  state captured.
- Do NOT chain rollbacks. If the operator wants to go further, require
  an explicit `--to`.
- **Convex-specific:** rollback = redeploy from the prior-sha handle
  with `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1`. The flag stays on for
  rollback; its purpose is preventing accidents, not rollback.

## Validation Commands (copy-paste)

```bash
# Pre-deploy sanity (lead model runs; delegates if slow)
pnpm ci:prepush                              # authoritative gate
gh pr checks <pr>                            # hosted mirror
vercel whoami && flyctl auth whoami          # target reachability
vercel env ls | rg GUEST_TOKEN_SECRET        # parity probe (Vercel)
pnpm exec convex env list | rg GUEST_TOKEN_SECRET   # parity probe (Convex)

# Idempotence probes
vercel inspect https://www.linejam.app --json | jq -r '.meta.githubCommitSha'
flyctl status --app linejam-canary-responder --json | jq -r '.Deployment.ImageRef'

# Health probes
curl -sS https://www.linejam.app/api/health
curl -sS https://linejam-canary-responder.fly.dev/healthz
flyctl status --app linejam-canary-responder

# Manual dispatch
git push origin master                       # frontend + convex + release
flyctl deploy -c fly.responder.toml --app linejam-canary-responder
LINEJAM_ALLOW_PROD_CONVEX_SYNC=1 pnpm exec convex deploy --prod  # rare

# Rollback
vercel promote <prev-url>                    # frontend
flyctl releases rollback <version> --app linejam-canary-responder   # responder
# Convex: checkout prior-sha handle, rerun manual prod push (above)
```

## Gotchas

- **`pnpm build` is load-bearing, not `next build`.** `build` runs the
  Convex deploy orchestrator; `build:check` is the plain `next build`
  used by the Dagger build-check lane. Do not "simplify" `build` to
  `next build` — you will silently stop shipping Convex functions.
- **Vercel preview builds do NOT mutate Convex preview by default.**
  `resolveHostedConvexDeployMode` forces `build-only` on preview unless
  `LINEJAM_FORCE_HOSTED_PREVIEW_CONVEX_DEPLOY=1`. Intentional: Vercel
  preview churn would thrash Convex preview backends.
- **Missing `CONVEX_DEPLOY_KEY` on prod is a hard error, not a skip.**
  `bootstrap-convex-env.mjs:326` refuses to ship frontend code against
  stale Convex auth config. Fix the secret, do not work around.
- **`GUEST_TOKEN_SECRET` mismatch is silent.** Invariant #8; no error,
  just dropped guest joins. Always probe parity before shipping.
- **Clerk `convex` JWT template must exist in prod Clerk.** Dagger
  auto-creates it for dev/test Clerk keys only. Prod must be
  pre-configured per `docs/adr/0001-hybrid-auth-signed-guest-tokens.md`
  and `docs/deployment.md` §3a. `LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE`
  stays `0` in prod.
- **Canary placeholder keys are refused by the Dagger build-check
  lane.** The same principle applies to Vercel: real keys or nothing.
  Invariant #4.
- **Responder runs its own Playwright, pinned in `Dockerfile.responder`.**
  Bumping Playwright locally without bumping the Dockerfile creates
  smoke-suite drift. They must move together.
- **Re-registering the Canary webhook is always safe.**
  `pnpm canary:webhook:setup` converges on one subscription. Running
  it twice is not a bug; running it once and assuming it worked is.
- **`/api/health` vs Canary readiness:** `/api/health` reports **app**
  health. Canary ingest is separate; missing Canary = degraded
  observability, not gameplay outage (repo brief Known Debts).
- **Release workflow uses `GH_RELEASE_TOKEN`, not `GITHUB_TOKEN`.**
  This is why the release push doesn't retrigger CI. Don't rename.
- **Do not spawn `convex dev` or `next dev` during a deploy check.**
  Invariant #2: the user keeps those running elsewhere. Use
  `pnpm exec convex function-spec --prod` or similar read-only probes.

## Related

- `.spellbook/repo-brief.md` — shared
  spine; cite Invariants #1, #3, #4, #8 verbatim when justifying
  refusals.
- `scripts/ci/bootstrap-convex-env.mjs`
  — deploy mode resolution, env parity seeding.
- `Dockerfile.responder` + `fly.responder.toml` — responder
  container + Fly config.
- `.github/workflows/release.yml`
  — semantic-release pipeline.
- `docs/deployment.md` — detailed
  setup (env provisioning, first-time webhook registration, rotation).
- `docs/adr/0001-hybrid-auth-signed-guest-tokens.md`
  — why `GUEST_TOKEN_SECRET` parity is load-bearing and why Clerk JWT
  template pre-creation matters.
- `builder` agent — for delegating CLI invocations.
- `critic` agent — for post-deploy sanity on the receipt.
