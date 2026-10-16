# Linejam

A pass-the-poem party game for friends in the same room. Play at
[App](https://linejam.mistystep.io)—no install or account required.

Each player writes one line per round, seeing only the line before theirs.
Nine rounds follow `1, 2, 3, 4, 5, 4, 3, 2, 1` words. Then everyone reads the
complete poems aloud. Saving stays private; publishing a link is explicit and
reversible.

## Run locally

```sh
node scripts/local/cli.mjs dev
```

Open `http://127.0.0.1:3333` in separate browser profiles for distinct players.
The real Next.js/Convex stack needs Node and local Docker, not cloud credentials
or a host dotenv file. Ctrl-C stops the owned stack and preserves its data.
See [local development](docs/local-development.md) for prerequisites, QA and reset.

## Verify a candidate

With the Node runtime required by `package.json`, its exact pnpm pin, the Rust
toolchain in `rust-toolchain.toml` and both frozen lockfiles installed, run this
in a clean candidate checkout on Mirrodin:

```sh
pnpm check --mode fast
pnpm check --mode full
```

Omitting `--mode` runs full verification. Fast mode runs source quality and unit
checks; full adds formatting, coverage, Cloudflare backend tests, a Worker build,
route/image checks and the existing rendered guest lifecycle in workerd with a
fresh SQLite Durable Object. Full mode needs the lockfile's Playwright Chromium
(`pnpm exec playwright install chromium`), its system libraries and `ffmpeg`.
The caller owns compute isolation; fleet runs stay inside `gha-runners.slice`.

No production credential or dotenv file is needed. The check refuses live
credentials and uses a loopback-only backend and generated local identities.
Retain the command's source-bound output on the native executor. Browser
evidence is in `.qa/worker/qa/evidence`; Rust entry screenshots are alongside it
in `.qa/worker/qa/entry-ui`. Private raw logs stay on that executor.
A local pass is not a deployment, hosted Clerk verification or a PostHog usage result.
This command prepares the native release path; it does not yet replace the
existing deployer or authorize a second promotion path.

## Project guide

- [Product brief and current direction](project.md)
- [Identity and interactions](DESIGN.md)
- [Reference specification and user stories](SPEC.md) and [feature map](features/README.md)
- [Architecture](docs/ARCHITECTURE.md) and Parlor membership boundary
- [Contributing](CONTRIBUTING.md) and [testing](docs/testing.md)
- [CLI/MCP and browser acceptance](docs/agent-faces.md)
- [Production deployment](docs/deployment.md) and [CI/operations authority](docs/ops/observability-ci.md)
- [Sharing privacy](docs/sharing-privacy.md), [retention](docs/ops/data-retention.md),
  [schema migrations](docs/convex-migrations.md), and [security](SECURITY.md)

Commands and dependency versions live in `package.json`. Parlor is the vendored
room-membership integration pinned in
[`vendor/parlor/UPSTREAM.json`](vendor/parlor/UPSTREAM.json); see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#parlor-boundary) for membership detail.

[Changelog](https://linejam.mistystep.io/changelog) ·
[MIT license](LICENSE)
