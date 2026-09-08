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

**Features**: human-authored collaborative poems, chosen player avatars, one visual identity with Light/Dark/System color modes, poem sharing, and in-game help

## Development

- **Frontend**: Next.js 16, React, TypeScript
- **Backend**: Convex (real-time sync)
- **Styling**: Tailwind CSS 4, custom design system
- **Auth**: Clerk (optional) + anonymous guests

## Getting Started

The default development loop needs Node and a local Docker daemon with Compose.
It runs the real Next.js app and Convex backend without accounts, provider
credentials, or a host `.env.local`:

```bash
node scripts/local/cli.mjs dev
```

Open **http://127.0.0.1:3333** in separate browser profiles to play as distinct
guests. Source changes hot-reload; **Ctrl-C** stops this checkout's stack and
preserves its data. See [local development](docs/local-development.md) for
prerequisites, concurrent projects, reset, and exact readiness receipts.

After stopping `dev`, run the reproducible acceptance commands:

```bash
node scripts/local/cli.mjs check --project checks
node scripts/local/cli.mjs qa --project qa
node scripts/local/cli.mjs down --project qa
```

The equivalent `pnpm local:*` aliases are in `package.json`. The `check` face
runs with networking disabled. The `qa` face exercises the real guest game and
leaves its stack running for inspection until `down`.

For explicitly commissioned hosted-provider integration, `bash scripts/setup.sh`
prepares dependencies/configuration; `pnpm run doctor` checks that target.
Keep its web/Convex URL and guest secret aligned. Ordinary Dagger checks never
sync shared Convex code or create Clerk configuration automatically.

### Design explorations

```bash
node scripts/design/serve.mjs
```

Open **http://127.0.0.1:4400** to inspect the five retained design alternatives
and their offline interaction sketches. The operator's selected hybrid is
documented in [DESIGN.md](DESIGN.md); the atlas is historical decision material,
not a competing production identity. **Ctrl-C** stops the server.

### Starting work

Start from a current request and check active branches, PRs, and sessions for
overlap. Linear owns current work and prioritization; record implementation and
verification links with the work item and PR/session. Historical issues and
docs are context, not an automatic intake queue or a new-ticket ceremony.
See [CONTRIBUTING.md](CONTRIBUTING.md#starting-work).

## Agent Faces

The [CLI and MCP faces](docs/agent-faces.md) share the game's Convex core and
guest identity; they do not replace browser acceptance. Use the repo-local
[`play-linejam` skill](.agents/skills/play-linejam/SKILL.md) for commissioned
complete multiplayer browser verification.

## Contributing & Security

- See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, local checks, commit style, and PR expectations.
- See [SECURITY.md](SECURITY.md) for vulnerability reporting and response expectations.
- See [docs/sharing-privacy.md](docs/sharing-privacy.md) for the public-by-link sharing contract.

## Testing

See [docs/testing.md](docs/testing.md) for the relevant acceptance surface,
coverage guard, and evidence contract. The hosted merge gate is authoritative;
local browser and deployment checks need the target's operation authority.

Parlor is imported under `.agents/skills/parlor` for guidance only, not as an
installed framework. Refresh that complete package through its owner importer;
do not format or patch its reference or provenance locally.

## Secret Scanning

The pre-commit hook scans staged files for credentials. Keep the scanner
enabled and use `.gitleaks.toml` only for reviewed false positives.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system overview: domain modules, data flow, and where to start reading code.

## Observability & CI

Sentry is Linejam's sole error, monitor, release, and incident-evidence
platform. Browser, Node, Edge, and Convex failures use release- and
environment-tagged events; production health and smoke use Sentry monitors.
Sentry-linked GitHub issues remain native incident evidence; Linear owns current
work and priorities. See [docs/ops/observability-ci.md](docs/ops/observability-ci.md)
for alert authority, retention, and the hosted merge gate.

## Design

[DESIGN.md](DESIGN.md) is the design contract: identity, composition, per-surface
decisions, and the acceptance bar. `lib/design/tokens.ts` owns the Light and Dark
token tables, and `lib/colorMode/` owns the Light/Dark/System control persisted
under `linejam-theme-mode`.

Light uses action `#672cb5` on a `#eee8ff` background with `#39234e` ink; Dark
uses action `#d5b5ff` on `#23172f` with `#f7f1ff` ink. DynaPuff sets the Linejam
wordmark and arrival headings; Nunito Sans carries every control, functional
heading and complete poem. Both faces ship from `public/fonts/`.

## License

MIT — see [LICENSE](LICENSE).
