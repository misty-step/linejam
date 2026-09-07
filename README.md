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

**Features**: human-authored collaborative poems, one fixed Ink & Anticipation visual identity with Light/Dark/System color modes, poem sharing, and in-game help

## Development

Use [CONTRIBUTING.md](CONTRIBUTING.md) for setup and
[docs/testing.md](docs/testing.md) for change-scoped verification. Commands and
dependency versions live in `package.json`, not a second framework catalog.
Local services and their target Convex deployment must agree on the guest
secret; see [operations authority](docs/ops/observability-ci.md) before syncing
shared development or running remote QA.

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

Ink & Anticipation is Linejam's visual identity. [DESIGN.md](DESIGN.md) owns its
product constraints; use the token source rather than duplicating a palette in
operational guidance.

## License

MIT — see [LICENSE](LICENSE).
