# Linejam

[![Lines](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/YOUR_GITHUB_USERNAME/YOUR_GIST_ID/raw/coverage-lines.json)](https://github.com/misty-step/linejam/actions)
[![Branches](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/YOUR_GITHUB_USERNAME/YOUR_GIST_ID/raw/coverage-branches.json)](https://github.com/misty-step/linejam/actions)
[![Functions](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/YOUR_GITHUB_USERNAME/YOUR_GIST_ID/raw/coverage-functions.json)](https://github.com/misty-step/linejam/actions)
[![Statements](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/YOUR_GITHUB_USERNAME/YOUR_GIST_ID/raw/coverage-statements.json)](https://github.com/misty-step/linejam/actions)

Pass-the-poem party game for friends in the same room.

## What It Is

Players take turns adding lines to poems they can't fully see. Each round, you see only the previous line—then write the next one with a specific word count. At the end, everyone reads the complete poems aloud. Chaos, beauty, and laughter ensue.

## How It Works

1. **Host creates a room** → Gets a 4-letter code
2. **Friends join** → Enter the code and their name
3. **Write in rounds** → 9 rounds with word counts: 1, 2, 3, 4, 5, 4, 3, 2, 1
4. **Reveal ceremony** → Each player reads one complete poem aloud

The constraint is the game. You see only the line before yours. The result is collaborative absurdity—poems that no single person could have written.

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

# Run development servers
pnpm dev          # Next.js on :3000
npx convex dev    # Convex backend

# Tips
- Keep `NEXT_PUBLIC_CONVEX_URL` pointed at the same backend you're running. For local development, use `http://localhost:8187`; if you target a remote Convex deployment, redeploy backend code whenever frontend args change (e.g., guestToken vs guestId) to avoid validator mismatches.
```

## Testing

222 tests across unit, integration, and E2E layers with 80%+ coverage enforcement.

```bash
# Unit & integration tests
pnpm test         # Run once
pnpm test:watch   # Watch mode
pnpm test:ci      # With coverage

# E2E tests (Playwright)
pnpm test:e2e     # Run E2E tests
pnpm test:e2e:ui  # Interactive UI mode

# Coverage report
open coverage/index.html
```

**Coverage Thresholds** (enforced in CI):

- Lines: 80%
- Branches: 80%
- Functions: 60% (Convex architecture limitation)
- Statements: 80%

**Test Structure**:

- `tests/` — Unit and integration tests (Vitest)
- `tests/e2e/` — End-to-end tests (Playwright)
- `tests/helpers/` — Shared test utilities

See [docs/testing.md](docs/testing.md) for patterns and guidelines.

## Secret Scanning

Pre-commit hooks automatically scan for leaked credentials (Clerk, Convex, Sentry keys).

```bash
# Install gitleaks (required for local development)
brew install gitleaks
```

**False positives?** Add patterns to `.gitleaks.toml` allowlist section.
**Hook failing?** Ensure gitleaks is installed: `brew install gitleaks`

## Design

Zen Garden aesthetic—Kenya Hara minimalism with warm white, near-black text, and vermillion accent. Typography: Cormorant Garamond for display, Inter for body.

## License

Private. All rights reserved.
