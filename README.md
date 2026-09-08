# Linejam

A pass-the-poem party game for friends in the same room. Play at
[linejam.app](https://linejam.app)—no install or account required.

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

## Project guide

- [Product brief and current direction](project.md)
- [Identity and interactions](DESIGN.md)
- [Architecture and Parlor evaluation](docs/ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md) and [testing](docs/testing.md)
- [CLI/MCP and browser acceptance](docs/agent-faces.md)
- [Production deployment](docs/deployment.md) and [CI/operations authority](docs/ops/observability-ci.md)
- [Sharing privacy](docs/sharing-privacy.md), [retention](docs/ops/data-retention.md),
  [schema migrations](docs/convex-migrations.md), and [security](SECURITY.md)

Commands and dependency versions live in `package.json`. Parlor is not installed;
its repository-local skill is imported guidance, not an integration.

[Marketing site](https://misty-step.github.io/linejam/) ·
[Changelog](https://misty-step.github.io/linejam/changelog.html) ·
[MIT license](LICENSE)
