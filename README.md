# Linejam

Pass-the-poem party game for friends in the same room.

## What It Is

Players take turns adding lines to poems they can't fully see. Each round, you see only the previous line—then write the next one with a specific word count. At the end, everyone reads the complete poems aloud. Chaos, beauty, and laughter ensue.

## How It Works

1. **Host creates a room** → Gets a 4-letter code
2. **Friends join** → Enter the code and their name
3. **Write in rounds** → 9 rounds with word counts: 1, 2, 3, 4, 5, 4, 3, 2, 1
4. **Reveal ceremony** → Each player reads one complete poem aloud

The constraint is the game. You see only the line before yours. The result is collaborative absurdity—poems that no single person could have written.

**Features**: AI players (fill empty seats), 4 visual themes, poem sharing, in-game help

## Tech Stack

- **Frontend**: Next.js 16, React, TypeScript
- **Backend**: Convex (real-time sync)
- **Styling**: Tailwind CSS 4, custom design system
- **Auth**: Clerk (optional) + anonymous guests

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Add your Convex and Clerk keys

# Run development servers (parallel)
pnpm dev # Next.js :3000 + Convex backend
```

Keep `NEXT_PUBLIC_CONVEX_URL` pointed at the same backend you're running. For local development, use `http://localhost:8187`; if you target a remote Convex deployment, local Dagger now syncs the active Convex dev backend before auth-heavy E2E runs so frontend/backend validators stay aligned.

## Testing

500+ tests across unit, integration, and E2E layers with 85% coverage enforcement.

```bash
# Unit & integration tests
pnpm test         # Run once
pnpm test:watch   # Watch mode
pnpm test:ci      # With coverage

# Local-first CI via Dagger
pnpm ci:dagger:all-no-e2e
pnpm ci:dagger:all

# Browser suites
pnpm test:e2e       # Local Playwright suite
pnpm test:e2e:smoke # Remote preview/prod smoke via PLAYWRIGHT_BASE_URL
pnpm test:e2e:ui    # Interactive UI mode

# Coverage report
open coverage/index.html
```

**Coverage Thresholds** (enforced in CI):

- Lines: 85%
- Branches: 85%
- Functions: 85%
- Statements: 85%

**Test Structure**:

- `tests/` — Unit and integration tests (Vitest)
- `tests/e2e/` — End-to-end tests (Playwright)
- `tests/helpers/` — Shared test utilities

See [docs/testing.md](docs/testing.md) for patterns and guidelines.

## Secret Scanning

Pre-commit hooks automatically scan for leaked credentials (Clerk, Convex, Canary keys).

```bash
# Install gitleaks (required for local development)
brew install gitleaks
```

**False positives?** Add patterns to `.gitleaks.toml` allowlist section.
**Hook failing?** Ensure gitleaks is installed: `brew install gitleaks`

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system overview: domain modules, data flow, and where to start reading code.

## Observability & CI

- Canary is the primary error and incident system. Client errors, request failures, and explicit `captureError()` calls all flow there.
- Critical route telemetry is structured JSON. `/api/health` and `/api/guest/session` log method, route, status, and duration without guest tokens, display names, or raw request payloads.
- Completed rooms end in a shared recap hub. Players can replay every poem, share `/recap/<room-code>`, and keep the same group moving into the next round without relying on one-off archive links.
- Treat Dagger as the source of truth for local engineering validation: `pnpm ci:dagger:all`.
- GitHub Actions still enforces branch protection remotely. Keep the local Dagger contract green first, then expect hosted `merge-gate` and preview/prod smoke to mirror that branch on remote infrastructure.
- Local Dagger auto-hydrates `GUEST_TOKEN_SECRET` from the active Convex deployment when `NEXT_PUBLIC_CONVEX_URL` points at the same Convex dev or prod backend that the CLI resolves.
- Local Dagger auto-syncs the active Convex dev deployment before `all` and `e2e` runs. It refuses to push production Convex code unless you explicitly set `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1`.
- Local Dagger ensures the Clerk `convex` JWT template exists before local auth-heavy browser coverage. Dev/test Clerk keys can be bootstrapped automatically; live-key mutation stays blocked unless you explicitly set `LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE=1`.
- Hosted preview `pnpm build` is compile-only by default. It does not create or mutate Convex preview deployments unless you explicitly set `LINEJAM_FORCE_HOSTED_PREVIEW_CONVEX_DEPLOY=1`.
- Hosted production `pnpm build` still bootstraps `GUEST_TOKEN_SECRET` plus `CLERK_JWT_ISSUER_DOMAIN` into Convex production before `convex deploy`, so the live app keeps Clerk and Convex auth aligned.
- The authoritative Dagger contract now requires real browser-side Canary config for build-bearing lanes. Keep `NEXT_PUBLIC_CANARY_ENDPOINT` and `NEXT_PUBLIC_CANARY_API_KEY` set locally before running `pnpm ci:dagger:all`, `pnpm ci:dagger:all-no-e2e`, `pnpm ci:dagger:build-check`, or `pnpm ci:dagger:e2e`.
- The default Dagger E2E contract is authenticated as well as guest coverage. Keep `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` configured locally; `PLAYWRIGHT_CLERK_TEST_EMAIL` is still optional for dev/test Clerk keys because the helper can provision the default smoke user automatically there. Live Clerk keys fail closed instead: point `PLAYWRIGHT_CLERK_TEST_EMAIL` at a precreated smoke account. Authenticated Playwright coverage signs into Clerk inside each live browser context after the app is already serving traffic, which keeps protected-route checks aligned with the actual test session. Set `PLAYWRIGHT_REQUIRE_AUTH_E2E=0` only when you intentionally want a guest-only loop.
- Local Dagger reads `.env.local` after `.env.production.local`, so localhost-safe Clerk test/dev keys in `.env.local` override production values during the local contract.
- Remote smoke covers both guest and signed-in join flows. Set `PLAYWRIGHT_BASE_URL`, keep `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` available for the authenticated Clerk path, and point `PLAYWRIGHT_CLERK_TEST_EMAIL` at a precreated smoke account for live Clerk tenants because remote smoke no longer auto-provisions against `sk_live_...` keys. For smoke runs, `scripts/ci/dagger-call.sh` now prefers `.env.production.local` over `.env.local` so deployed targets do not accidentally inherit localhost Clerk keys, it rejects `pk_test_...` or `sk_test_...` credentials against `https://www.linejam.app`, and it validates that Clerk already has the `convex` JWT template before launching authenticated smoke. Set `PLAYWRIGHT_REQUIRE_AUTH_SMOKE=0` only when you intentionally want to skip auth smoke.
- Run the Canary responder locally with `pnpm canary:responder` and see [docs/ops/canary-responder.md](docs/ops/canary-responder.md). The responder now bounds Canary context fetches with a timeout, prunes stale `.canary/` artifacts on a rolling interval, and expects `pnpm canary:webhook:setup` to be rerunnable without creating duplicate Canary subscriptions. Hosted responder deployments use `LINEJAM_SMOKE_RUNNER=playwright`, [Dockerfile.responder](Dockerfile.responder), and [fly.responder.toml](fly.responder.toml) so the smoke loop can run outside GitHub Actions without embedding Dagger in the webhook worker. Set `CANARY_WEBHOOK_SEND_TEST=1` when you want setup to send Canary's `canary.ping` test delivery after ensuring the subscription.
- `/api/health` reports app health separately from Canary readiness. Missing Canary ingest degrades observability metadata but no longer marks the entire app unhealthy.

## Design

Zen Garden aesthetic—Kenya Hara minimalism with warm white, near-black text, and vermillion accent. Typography: Cormorant Garamond for display, Inter for body.

## License

Private. All rights reserved.
