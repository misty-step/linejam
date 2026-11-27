# Linejam

A pass-the-poem party game for two to eight friends in the same room. Play at
[linejam.mistystep.io](https://linejam.mistystep.io) — no install, no account.

Each player writes one line per round, seeing only the line before theirs.
Nine rounds follow `1, 2, 3, 4, 5, 4, 3, 2, 1` words. Then the room reads the
finished poems aloud. Saving stays private; publishing a link is explicit and
reversible.

## One runtime

Linejam is one Cloudflare Worker with Durable Objects (SQLite storage):

- `RoomDO` — one object per room. Its SQLite database is the only authority for
  that room's members, presence, games, assignments and accepted lines. Live
  updates reach every client over hibernating WebSockets, with an HTTP
  fallback on the same state route.
- `ArchiveDO` — completed poems, who may read them, favorites, share links and
  retention.
- The Worker serves the static UI itself. There is no framework runtime, no
  separate frontend server and no second backend.

[docs/architecture.md](docs/architecture.md) has the details.

## Run it

Needs Node `>= 22.18` and pnpm. No cloud credentials, no dotenv file.

```sh
pnpm install
pnpm dev          # http://127.0.0.1:8787 — real workerd + SQLite Durable Objects
```

Open it in two browser profiles (or one normal and one private window) to be
two players. `pnpm dev` generates a local-only secret in `.dev.vars` on first
run.

## Verify a change

```sh
pnpm verify        # build, types, formatting, tests, headed two-player walkthrough
pnpm verify --fast # everything except the browser walkthrough
```

`pnpm verify` runs entirely on this machine and refuses cloud credentials:

| Step        | What it proves                                                                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| build       | every file in `folio/assets/` matches `checksums.json`; tokens, fonts, icons and the client bundle are generated from sources of truth                                           |
| tests       | the Worker and both Durable Objects inside workerd (Miniflare); the CLI and MCP server as child processes against a live `wrangler dev`                                          |
| walkthrough | headed Chrome, two concurrent players, a full nine-round game through reveal, heart, share and revoke, at `1440×900`, `390×844` and `320×568`, in Light, Dark and reduced motion |

The walkthrough needs Google Chrome, `ffmpeg` and (without a display) `xvfb`;
evidence lands in `e2e/out/`. See [docs/testing.md](docs/testing.md).

## Scripted players

The CLI and the MCP server call the same Worker HTTP API as the browser, with
the same guest credential and the same rules.

```sh
export LINEJAM_URL=http://127.0.0.1:8787
pnpm cli --help
pnpm mcp           # MCP server on stdio
```

See [docs/agent-faces.md](docs/agent-faces.md).

## Project guide

- [PRODUCT.md](PRODUCT.md) — what Linejam is and must do (the Active Folio)
- [DESIGN.md](DESIGN.md) and [`folio/assets/`](folio/assets) — the locked visual identity
- [SPEC.md](SPEC.md) — detailed observable acceptance, and the [feature map](features/README.md)
- [docs/architecture.md](docs/architecture.md), [docs/operations.md](docs/operations.md), [docs/testing.md](docs/testing.md)
- [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md)

Release history lives in [GitHub Releases](https://github.com/misty-step/linejam/releases).
