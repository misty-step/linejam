# Deployment Guide

This guide walks you through deploying Linejam to production and preview environments.

## Prerequisites

- Vercel account with project configured
- Convex account with project configured
- GitHub repository connected to Vercel for automatic deploys

## Environment Variables Overview

Linejam requires environment variables to be configured in **three** separate locations:

1. **Vercel** (for Next.js runtime)
2. **Convex** (for backend functions)
3. **GitHub Secrets** (for CI/CD E2E tests)

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

#### Option B: Via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to your project
3. Settings → Environment Variables
4. Add each variable for Production and Preview environments

#### Required Vercel Variables

| Variable                            | Environments                     | Description                                    |
| ----------------------------------- | -------------------------------- | ---------------------------------------------- |
| `GUEST_TOKEN_SECRET`                | Production, Preview              | Guest token signing secret (must match Convex) |
| `NEXT_PUBLIC_CONVEX_URL`            | Production, Preview, Development | Convex deployment URL                          |
| `CONVEX_DEPLOYMENT`                 | Production, Preview, Development | Convex deployment name                         |
| `CONVEX_DEPLOY_KEY`                 | Production, Preview              | Deploy key from Convex dashboard (for builds)  |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Production, Preview, Development | Clerk publishable key                          |
| `CLERK_SECRET_KEY`                  | Production, Preview, Development | Clerk secret key                               |
| `NEXT_PUBLIC_SENTRY_DSN`            | Production, Preview              | Sentry DSN for error tracking                  |
| `SENTRY_ORG`                        | Production, Preview              | Sentry organization slug                       |
| `SENTRY_PROJECT`                    | Production, Preview              | Sentry project slug                            |
| `SENTRY_AUTH_TOKEN`                 | Production, Preview              | Sentry auth token for sourcemaps               |
| `OPENROUTER_API_KEY`                | Convex only (Production)         | OpenRouter API key for AI player LLM access    |

### 3. Configure Convex Environment Variables

Set environment variables in Convex for both Production and Preview deployments:

```bash
cd ~/Development/linejam

# Production
npx convex env set GUEST_TOKEN_SECRET "your-guest-token-secret" production

# Preview
npx convex env set GUEST_TOKEN_SECRET "your-guest-token-secret" preview

# Verify
npx convex env list
```

**Critical**: The `GUEST_TOKEN_SECRET` value must be **identical** in both Vercel and Convex.

### 4. Configure GitHub Secrets (for CI/CD)

GitHub Actions requires secrets for E2E tests:

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Add repository secrets:

| Secret                              | Description                 |
| ----------------------------------- | --------------------------- |
| `GUEST_TOKEN_SECRET`                | Same value as Vercel/Convex |
| `NEXT_PUBLIC_CONVEX_URL`            | Convex deployment URL       |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key       |

## Verification

### 1. Verify Convex Environment

```bash
npx convex env list
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

### 4. Run E2E Tests

```bash
# Set GUEST_TOKEN_SECRET locally
export GUEST_TOKEN_SECRET="your-secret"

# Run E2E tests
pnpm test:e2e
```

Tests should pass without "Missing GUEST_TOKEN_SECRET" errors.

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
2. Check Convex env vars: `npx convex env list`
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
npx convex env set GUEST_TOKEN_SECRET "your-secret" production
```

### Error: "Failed to load resource: 500" on `/api/guest/session`

**Cause**: Missing or invalid `GUEST_TOKEN_SECRET` in Vercel

**Solution**:

1. Check Vercel logs: `vercel logs`
2. Set environment variable: `vercel env add GUEST_TOKEN_SECRET production`
3. Redeploy: `vercel --prod`

### E2E Tests Skip with "Set GUEST_TOKEN_SECRET to run..."

**Cause**: `GUEST_TOKEN_SECRET` not set in GitHub Actions secrets

**Solution**:

1. Go to GitHub → Settings → Secrets
2. Add `GUEST_TOKEN_SECRET` repository secret
3. Re-run failed workflow

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
3. Update Convex: `npx convex env set GUEST_TOKEN_SECRET "new-secret" production`
4. Update GitHub Secrets
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
- [ ] All tests pass locally: `pnpm test:ci`
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Build succeeds: `pnpm build`
- [ ] E2E tests pass (if configured): `pnpm test:e2e`
- [ ] Sentry configured for error tracking
- [ ] Preview deploy tested manually

## Rollback

If deployment issues occur:

### Vercel Rollback

1. Go to Vercel Dashboard → Deployments
2. Find previous working deployment
3. Click "..." → "Promote to Production"

### Convex Rollback

Convex doesn't support rollback of environment variables. If needed:

1. Update environment variables to previous values
2. Redeploy Vercel (environment variables take effect immediately in Convex)

## Additional Resources

- [Vercel Environment Variables Documentation](https://vercel.com/docs/concepts/projects/environment-variables)
- [Convex Environment Variables Documentation](https://docs.convex.dev/production/hosting/environment-variables)
- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
