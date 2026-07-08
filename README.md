# Linejam

Pass-the-poem party game for friends in the same room.

**Play free at [linejam.app](https://linejam.app)** — no install, no account required. [Marketing site](https://misty-step.github.io/linejam/) · [Changelog](https://misty-step.github.io/linejam/changelog.html)

A real poem from a played-through room (word counts 1/2/3/4/5/4/3/2/1):

> Shadows
> grows louder
> in the hallway
> where forgotten poems wait
> for someone brave enough finally
> where forgotten poems wait
> in the hallway
> grows louder
> Silence

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
# Bootstrap dependencies, .env.local, and local coordination state
bash scripts/setup.sh

# Or create .env.local without installing dependencies
bash scripts/setup.sh --write-env --skip-install

# Add your Convex, Clerk, guest-token, and Canary values to .env.local

# Run development servers (parallel)
pnpm dev # Next.js :3000 + Convex backend
```

Keep `NEXT_PUBLIC_CONVEX_URL` pointed at the same backend you're running. For local development, use `http://localhost:8187`; if you target a remote Convex deployment, local Dagger now syncs the active Convex dev backend before auth-heavy E2E runs so frontend/backend validators stay aligned.

### Backlog Claims

Use local claims before starting a ready item from `backlog.d/` so parallel agents do not pick up the same work:

```bash
source scripts/lib/claims.sh
claim_acquire <backlog-id>
# ...work...
claim_release <backlog-id>
```

`bash scripts/setup.sh` prepares the `.claims/` directory. Claim files are local coordination artifacts; release the claim when the item is done or abandoned.

## Agent Faces

Linejam ships thin agent-facing faces over the same Convex core the web app uses — no reimplemented game logic. See [docs/agent-faces.md](docs/agent-faces.md) for the CLI/MCP command surface, identity model, environment contract, registration recipe, and API-face disposition.

- `pnpm agent:cli` — terminal CLI to create/join rooms, read game state, submit lines, browse and favorite poems.
- `pnpm agent:mcp` — stdio MCP server exposing the same actions as tools.
- [.agents/skills/linejam-cli/SKILL.md](.agents/skills/linejam-cli/SKILL.md) — full usage, identity model, and when to reach for these vs. the browser.

## Contributing & Security

- See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, local checks, commit style, and PR expectations.
- See [SECURITY.md](SECURITY.md) for vulnerability reporting and response expectations.
- See [docs/sharing-privacy.md](docs/sharing-privacy.md) for the public-by-link sharing contract.
- Review routing is declared in [CODEOWNERS](CODEOWNERS).

## Testing

500+ tests across unit, integration, and E2E layers with 85% coverage enforcement.

```bash
# Unit & integration tests
pnpm test         # Run once
pnpm test:watch   # Watch mode
pnpm test:ci      # With coverage

# Fast local CI
pnpm ci:fast
pnpm ci:prepush

# Full local Dagger parity
pnpm ci:dagger:all-no-e2e
pnpm ci:dagger:all

# Browser suites
pnpm test:e2e       # Local Playwright suite
pnpm test:e2e:early-smoke # Fast selector smoke to reveal phase
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

Canary is the primary error/incident system; `pnpm ci:fast` is the fast host loop (typecheck, lint, tests); GitHub Actions' `merge-gate` is the authoritative full contract, with `pnpm ci:dagger:all` for local parity. Dagger env requirements, Clerk/Convex auto-sync behavior, and the Canary responder setup are detailed in [docs/ops/observability-ci.md](docs/ops/observability-ci.md).

## Design

Zen Garden aesthetic—Kenya Hara minimalism with warm white, near-black text, and vermillion accent. The default Kenya theme uses Libre Baskerville for display, IBM Plex Sans for body/UI, and JetBrains Mono for counts and technical labels; other themes define their own pairings in `lib/themes/presets/`.

## License

MIT — see [LICENSE](LICENSE).
