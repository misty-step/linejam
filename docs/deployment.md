# Deployment Guide

This guide walks you through deploying Linejam to production and preview environments.

## Prerequisites

- Vercel account with project configured
- Convex account with project configured
- GitHub repository connected to Vercel for automatic deploys

## Environment Variables Overview

Linejam requires environment variables to stay in sync across **three** surfaces:

1. **Vercel** (for Next.js runtime)
2. **Convex** (for backend functions)
3. **Hosted branch protection** (GitHub `merge-gate` today, plus any extra mirrors you keep)

### Critical: `GUEST_TOKEN_SECRET`

The `GUEST_TOKEN_SECRET` is used for signing and verifying guest session tokens. It **must** be set identically in both Vercel and Convex environments, or token verification will fail.

## Setup Instructions

### 1. Generate Secrets

First, generate secure secrets for your production environment:

```bash
# Generate GUEST_TOKEN_SECRET (32 bytes, base64-encoded)
openssl rand -base64 32

# Example output: UlOjzXHtVNu6baGB8/7Bot1qLehLaTBRio5rVZ0DvA8=
```

### 2. Configure Vercel Environment Variables

Set environment variables in Vercel for both Production and Preview environments:

#### Option A: Via Vercel CLI

```bash
cd ~/Development/linejam

# Production
echo 'your-guest-token-secret' | vercel env add GUEST_TOKEN_SECRET production

# Preview
echo 'your-guest-token-secret' | vercel env add GUEST_TOKEN_SECRET preview

# Verify
vercel env ls
```

#### Required Variables by Surface

| Variable                                   | Environments                     | Description                                                                    |
| ------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------ |
| `GUEST_TOKEN_SECRET`                       | Production, Preview              | Guest token signing secret (must match Convex)                                 |
| `NEXT_PUBLIC_CONVEX_URL`                   | Production, Preview, Development | Convex deployment URL                                                          |
| `CONVEX_DEPLOYMENT`                        | Production, Preview, Development | Convex deployment name                                                         |
| `CONVEX_DEPLOY_KEY`                        | Production, Preview if forced    | Required for hosted production deploys; optional for compile-only previews     |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`        | Production, Preview, Development | Clerk publishable key                                                          |
| `CLERK_SECRET_KEY`                         | Production, Preview, Development | Clerk secret key                                                               |
| `PLAYWRIGHT_CLERK_TEST_EMAIL`              | Production, Preview              | Optional override for the Clerk smoke user email                               |
| `PLAYWRIGHT_REQUIRE_AUTH_E2E`              | Hosted CI mirror                 | Keep at `1` to mirror the local Dagger contract                                |
| `LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE` | Local only                       | Keep at `0`; live Clerk mutation must be explicit                              |
| `CANARY_ENDPOINT`                          | Production, Preview              | Canary API base URL                                                            |
| `CANARY_API_KEY`                           | Production, Preview              | Canary server ingest/query key                                                 |
| `NEXT_PUBLIC_CANARY_ENDPOINT`              | Production, Preview              | Canary browser ingest URL                                                      |
| `NEXT_PUBLIC_CANARY_API_KEY`               | Production, Preview              | Canary browser write-only ingest key                                           |
| `LINEJAM_CANARY_WEBHOOK_SECRET`            | Production, Preview              | Shared secret for signed Canary deliveries                                     |
| `LINEJAM_CANARY_WEBHOOK_URL`               | Production, Preview              | URL registered with Canary webhook subscriptions                               |
| `LINEJAM_SMOKE_RUNNER`                     | Responder only                   | Use `playwright` for hosted responders                                         |
| `CANARY_WEBHOOK_SEND_TEST`                 | Local only                       | Set to `1` to send Canary's test ping after setup                              |
| `PLAYWRIGHT_REQUIRE_AUTH_SMOKE`            | Production, Preview              | Keep at `1` unless you intentionally skip auth                                 |
| `OPENROUTER_API_KEY`                       | Convex only (Production)         | OpenRouter API key for AI player LLM access                                    |
| `AI_MODEL`                                 | Convex only                      | Optional OpenRouter model override; defaults to `google/gemini-2.5-flash-lite` |
| `AI_DAILY_CALL_BUDGET`                     | Convex only                      | Optional daily claimed-generation budget for bot LLM calls; defaults to `250`  |
| `MAX_AI_PLAYERS`                           | Convex only                      | Optional bot cap per room; defaults to `3`                                     |
| `LINEJAM_AI_DETERMINISTIC`                 | Local/QA Convex only             | Set to `1` to force deterministic bot fallbacks and avoid OpenRouter calls     |

### 3. Configure Convex Environment Variables

Set environment variables in Convex for both Production and Preview deployments:

```bash
cd ~/Development/linejam

# Production
pnpm exec convex env set GUEST_TOKEN_SECRET "your-guest-token-secret" production

# Preview
pnpm exec convex env set GUEST_TOKEN_SECRET "your-guest-token-secret" preview

# Verify
pnpm exec convex env list
```

**Critical**: The `GUEST_TOKEN_SECRET` value must be **identical** in both Vercel and Convex.

### 3a. Configure Clerk for Convex tokens

Convex auth needs a Clerk JWT template named `convex`. Local Dagger will create
it automatically for dev/test Clerk keys, but production and preview should be
configured intentionally before deployment:

1. Ensure `CLERK_JWT_ISSUER_DOMAIN` matches the Clerk frontend API / issuer for the same keypair.
2. Ensure the Clerk instance has a `convex` JWT template with `aud: "convex"`.
3. Keep `LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE=0` for normal local work. Set it to `1` only when you explicitly want the CLI to create the template against a live Clerk instance.

Hosted production builds seed `GUEST_TOKEN_SECRET` plus
`CLERK_JWT_ISSUER_DOMAIN` into Convex production before `pnpm exec convex deploy`
runs. Hosted preview builds are compile-only by default because Vercel preview
deployments are not a reliable place to create or mutate Convex preview
backends. Set `LINEJAM_FORCE_HOSTED_PREVIEW_CONVEX_DEPLOY=1` only when you
intentionally want a hosted preview build to create or update a Convex preview
deployment.

### 4. Hosted Branch Protection / CI Mirror

Local Dagger runs are the source of truth. Hosted branch protection still needs the same mirrored values:

| Secret                                     | Description                                          |
| ------------------------------------------ | ---------------------------------------------------- |
| `GUEST_TOKEN_SECRET`                       | Same value as Vercel/Convex                          |
| `NEXT_PUBLIC_CONVEX_URL`                   | Convex deployment URL                                |
| `CLERK_JWT_ISSUER_DOMAIN`                  | Clerk issuer domain for Convex auth                  |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`        | Clerk publishable key                                |
| `CLERK_SECRET_KEY`                         | Clerk secret key for auth smoke                      |
| `PLAYWRIGHT_CLERK_TEST_EMAIL`              | Existing Clerk smoke user for live preview/prod auth |
| `PLAYWRIGHT_REQUIRE_AUTH_E2E`              | Keep at `1` for exhaustive auth E2E                  |
| `PLAYWRIGHT_REQUIRE_AUTH_SMOKE`            | Set to `1` for preview/prod auth smoke               |
| `LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE` | Keep at `0` unless intentionally mutating live Clerk |

Hosted preview deployments only need enough env to compile and run the deployed
app. They do not need Convex preview mutation rights unless you deliberately set
`LINEJAM_FORCE_HOSTED_PREVIEW_CONVEX_DEPLOY=1`.

### 5. Register the Canary responder webhook

The responder is the contract between Canary incidents and Linejam QA.

Create the Fly app and webhook secret first, then deploy the responder with the secret already present. The committed production path is Fly.io:

```bash
flyctl apps create linejam-canary-responder
flyctl volumes create canary_data --app linejam-canary-responder --region ord --size 1
export LINEJAM_CANARY_WEBHOOK_URL="https://linejam-canary-responder.fly.dev/canary/webhook"
export CANARY_ENDPOINT="https://canary-obs.fly.dev"
export CANARY_API_KEY="your-canary-api-key"
LINEJAM_CANARY_WEBHOOK_URL="$LINEJAM_CANARY_WEBHOOK_URL" pnpm canary:webhook:setup -- --emit-secret
```

Save the returned secret as `LINEJAM_CANARY_WEBHOOK_SECRET`, then configure Fly:

```bash
flyctl secrets set \
  CANARY_ENDPOINT="$CANARY_ENDPOINT" \
  CANARY_API_KEY="$CANARY_API_KEY" \
  LINEJAM_CANARY_WEBHOOK_SECRET="$LINEJAM_CANARY_WEBHOOK_SECRET" \
  LINEJAM_CANARY_SERVICE=linejam \
  LINEJAM_SMOKE_RUNNER=playwright \
  PLAYWRIGHT_BASE_URL=https://www.linejam.app \
  PLAYWRIGHT_REQUIRE_AUTH_SMOKE=1 \
  LINEJAM_ENFORCE_SMOKE_URL_ALLOWLIST=1 \
  LINEJAM_ALLOWED_SMOKE_ORIGINS=https://www.linejam.app \
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" \
  CLERK_SECRET_KEY="$CLERK_SECRET_KEY" \
  PLAYWRIGHT_CLERK_TEST_EMAIL="$PLAYWRIGHT_CLERK_TEST_EMAIL" \
  --app linejam-canary-responder
flyctl deploy -c fly.responder.toml --app linejam-canary-responder
```

The hosted responder uses the same smoke suite as local Dagger, but runs it
with direct Playwright via `LINEJAM_SMOKE_RUNNER=playwright`. That keeps local
Dagger authoritative without requiring Dagger inside the webhook worker.

`pnpm canary:webhook:setup` is idempotent for the configured responder URL. It reuses the exact active subscription when one already exists and replaces duplicate or stale subscriptions for the same URL so repeated setup runs do not double-trigger smoke. `CANARY_API_KEY` is required for the setup call, and `CANARY_ENDPOINT` keeps the command pinned to the intended Canary host from a clean shell. Pass `-- --emit-secret` only when you need the newly created signing secret printed; stdout redacts it by default. Set `CANARY_WEBHOOK_SEND_TEST=1` only after the responder is deployed and reachable; pre-deploy test pings will fail because the URL exists before the service does.

The responder verifies signed Canary deliveries, fetches incident context back
from Canary, stores artifacts under `.canary/`, and escalates to the same
remote smoke suite used by `pnpm test:e2e:smoke`.

## Verification

### 1. Verify Convex Environment

```bash
pnpm exec convex env list
```

Expected output:

```
GUEST_TOKEN_SECRET=production
GUEST_TOKEN_SECRET=preview
```

### 2. Verify Vercel Environment

```bash
vercel env ls
```

Expected output should include:

```
GUEST_TOKEN_SECRET    Encrypted    Production, Preview
```

### 3. Test Guest Session Creation

After deployment:

1. Visit your preview URL: `https://your-app-preview.vercel.app`
2. Open browser DevTools → Network tab
3. Create a room (triggers guest session)
4. Check for `/api/guest/session` request
5. Verify it returns `200 OK` with `{ guestId, token }`

If you see `500 Internal Server Error` or "Token signature verification failed", check:

- `GUEST_TOKEN_SECRET` is set in both Vercel and Convex
- The values are **identical** in both environments
- No trailing whitespace or encoding issues in the secret

### 4. Run Local CI

```bash
# Run the fast host gate
pnpm ci:fast

# Run full local Dagger parity for the hosted merge-gate
pnpm ci:dagger:all
```

The fast gate should pass before push. The full Dagger parity gate should pass without guest-token verification mismatches. Local Dagger hydrates `GUEST_TOKEN_SECRET` from the matching Convex deployment automatically.
It also ensures the Clerk `convex` JWT template exists before authenticated browser coverage runs.

## Deployment Workflow

### Automatic Deploys (Recommended)

1. Push to GitHub
2. Vercel automatically builds and deploys
3. Preview deploys created for all branches
4. Production deploys created for `master` branch

### Manual Deploy

```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

## Troubleshooting

### Error: "Token signature verification failed"

**Cause**: `GUEST_TOKEN_SECRET` mismatch between Vercel and Convex

**Solution**:

1. Check Vercel env vars: `vercel env ls`
2. Check Convex env vars: `pnpm exec convex env list`
3. Ensure values are identical
4. Redeploy to pick up new environment variables

### Error: "GUEST_TOKEN_SECRET must be set in production environment"

**Cause**: `GUEST_TOKEN_SECRET` not configured in Next.js runtime (Vercel)

**Solution**:

```bash
echo 'your-secret' | vercel env add GUEST_TOKEN_SECRET production
```

### Error: "GUEST_TOKEN_SECRET must be set in Convex environment"

**Cause**: `GUEST_TOKEN_SECRET` not configured in Convex

**Solution**:

```bash
pnpm exec convex env set GUEST_TOKEN_SECRET "your-secret" production
```

### Error: "Failed to load resource: 500" on `/api/guest/session`

**Cause**: Missing or invalid `GUEST_TOKEN_SECRET` in Vercel

**Solution**:

1. Check Vercel logs: `vercel logs`
2. Set environment variable: `vercel env add GUEST_TOKEN_SECRET production`
3. Redeploy: `vercel --prod`

### E2E Tests Skip with "Set GUEST_TOKEN_SECRET to run..."

**Cause**: `GUEST_TOKEN_SECRET` is not present in the shell or mirrored CI environment

**Solution**:

1. Export `GUEST_TOKEN_SECRET` locally from the active Convex deployment
2. Re-run `pnpm ci:dagger:all`
3. If you keep hosted CI, mirror the same value there

## Security Best Practices

### Secret Generation

Always use cryptographically secure random generation:

```bash
# Good: 32 bytes of randomness
openssl rand -base64 32

# Bad: Weak or predictable secrets
echo "my-secret-123"  # ❌ Don't do this
```

### Secret Rotation

To rotate `GUEST_TOKEN_SECRET`:

1. Generate new secret: `openssl rand -base64 32`
2. Update Vercel: `vercel env add GUEST_TOKEN_SECRET production` (will prompt to override)
3. Update Convex: `pnpm exec convex env set GUEST_TOKEN_SECRET "new-secret" production`
4. Update any hosted CI mirrors
5. Deploy

**Note**: Existing guest tokens will become invalid. Users will need to create new sessions.

### Never Commit Secrets

- Keep `.env.local` and `.env.production.local` in `.gitignore`
- Use `.env.example` for documentation only (no real values)
- Review commits before pushing to avoid accidental secret exposure

## Deployment Checklist

Before deploying to production:

- [ ] `GUEST_TOKEN_SECRET` set in Vercel (production + preview)
- [ ] `GUEST_TOKEN_SECRET` set in Convex (production + preview)
- [ ] Secrets are **identical** in both environments
- [ ] Local-first CI passes: `pnpm ci:dagger:all`
- [ ] App and Dagger TypeScript compile: `pnpm typecheck`
- [ ] Build succeeds: `pnpm build`
- [ ] E2E tests pass (if configured): `pnpm test:e2e`
- [ ] Canary ingest configured for browser and server reporting
- [ ] Canary responder webhook secret and URL configured
- [ ] Preview deploy tested manually

## Rollback

If deployment issues occur:

### Release pipeline gotcha

The Landmark release action runs semantic-release in its own runtime, which
has Node but **no `pnpm` on PATH**. Do not add a `pnpm`-shelling step (e.g.
`@semantic-release/exec` with a `pnpm ...` `prepareCmd`) to `.releaserc.js` —
it will fail with exit 127 and silently abort the release before it tags a
version (see #276 / commit `d431210`, which dropped exactly this step and
excluded `CHANGELOG.md` from `format:check` instead). If a generated artifact
needs formatting, exclude it from the gate rather than shelling out to pnpm
from inside the release action.

### Vercel Rollback

Promote the last known-good deployment:

```bash
vercel rollback [deployment-url-or-id]
# or, with no argument, roll back to the previous production deployment:
vercel rollback
```

Check `vercel rollback status` if a rollback is already in flight.

### Convex Rollback

Convex has no built-in "rollback" — there is no equivalent of `vercel
rollback` for Convex functions or schema. Two drills exist depending on what
broke:

**Env var rollback** (a bad env var change):

1. Update the environment variable(s) back to previous values:
   `pnpm exec convex env set <KEY> "<previous-value>" production`
2. Redeploy Vercel (`vercel --prod`) — env vars take effect immediately in
   Convex, no separate Convex deploy needed.

**Forward-redeploy-of-prior-SHA** (a bad function/schema change):

Convex deploys are forward-only, so "rolling back" means redeploying the
last-known-good code, not reverting Convex state:

1. Identify the last good commit SHA (the one before the breaking deploy).
2. `git checkout <prior-sha> -- convex/` to stage the prior Convex source
   (or work from a branch/worktree at that SHA if the app code also needs to
   match).
3. `pnpm exec convex deploy` to push that prior version forward as the new
   current deployment.
4. Once the underlying bug is fixed, forward-deploy the fixed version the
   same way — don't leave the deployment pinned to the old SHA.

**Data export/restore drill** (recover from bad data, not bad code):

```bash
# Before a risky migration or mutation, export a safety snapshot:
pnpm exec convex export --path backup-$(date +%Y%m%d).zip

# To restore from a snapshot (overwrites current deployment data — confirm
# target deployment with `pnpm exec convex env list` first):
pnpm exec convex import backup-<date>.zip
```

`convex import` replaces data in the target deployment; always verify
`CONVEX_DEPLOYMENT` / the `--prod`/`--preview` flag points at the intended
deployment before running it against anything with real player data.

## Additional Resources

- [Vercel Environment Variables Documentation](https://vercel.com/docs/concepts/projects/environment-variables)
- [Convex Environment Variables Documentation](https://docs.convex.dev/production/hosting/environment-variables)
- [Dagger](https://docs.dagger.io/)
