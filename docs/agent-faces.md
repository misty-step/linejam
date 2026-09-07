# Agent Faces

Linejam exposes thin backend faces for scripted agents and a browser-play
contract for autonomous QA agents that exercise the same rendered interface as
human players.

| Face       | Command                                | Owns                                                    |
| ---------- | -------------------------------------- | ------------------------------------------------------- |
| CLI        | `pnpm agent:cli -- <group> <action>`   | Argument parsing and JSON output                        |
| MCP        | `pnpm agent:mcp`                       | stdio JSON-RPC, `tools/list`, `tools/call`              |
| CLI skill  | `.agents/skills/linejam-cli/SKILL.md`  | When to use CLI/MCP versus browser automation           |
| Browser QA | `.agents/skills/play-linejam/SKILL.md` | Complete multiplayer UI gameplay, closure, and evidence |

The CLI, MCP, and CLI skill route through `scripts/lib/linejamClient.ts` and
generated Convex functions. Browser QA drives the web UI and its normal guest
session. Game rules, assignment, presence, host migration, poems, and favorites
stay in Convex.

## Identity

Agent sessions use the same anonymous guest-token model as the browser.

- `linejam_mint_guest` mints `{ guestId, guestToken }` without joining a room.
- CLI `room create` and `room join` mint a guest token when one is not supplied.
- Reuse one `guestToken` across follow-up calls. Membership and host status are
  tied to that identity.
- Pass CLI identity as `--guest-token TOKEN` or `LINEJAM_GUEST_TOKEN`.
- Pass MCP identity as `guestToken` on every tool except `linejam_mint_guest`.

The token is signed by `lib/guestToken.ts` with `GUEST_TOKEN_SECRET`, matching
the browser guest session. Local development may fall back to a development-only
secret when `NODE_ENV` is not production. Deployed and production-like harnesses
must use the same `GUEST_TOKEN_SECRET` as the target Convex deployment.

## Environment

Launch from a caller-selected Linejam checkout with the intended deployment
environment, using the harness environment wrapper or a trusted `.env.local`.
Do not assume a machine-specific path or treat an example as permission to
write to a remote backend.

- `NEXT_PUBLIC_CONVEX_URL` selects the Convex deployment.
- `GUEST_TOKEN_SECRET` must match that deployment for production-like targets.
- `LINEJAM_GUEST_TOKEN` keeps CLI calls on one guest identity.
- `CONVEX_OVERRIDE_ACCESS_TOKEN` is only for one-shot Convex CLI metadata
  probes in isolated worktrees; the agent faces do not need it.

Never hardcode deployment URLs or tokens into MCP configuration, print
value-bearing environment listings, or retain credentials in transcripts.
Shared-development and production writes are separate scopes and need explicit
operation authority.

## CLI

Use `pnpm agent:cli --help` for the current action and argument list. Supply
`LINEJAM_GUEST_TOKEN` through the environment so identity is not copied into
command-line arguments. Create/join, gameplay, and favorite actions write real
data on the selected deployment.

The CLI prints JSON to stdout. When it mints a guest token implicitly, it prints
the token to stderr for reuse. Capture that stream only in a credential-safe
sink and redact before retaining any output.

## MCP

Start `pnpm agent:mcp` as a stdio process only when the task commissions it and
names its shutdown owner. It supports `initialize`, `tools/list`, and
`tools/call`. Use `tools/list` for the current actions rather than a copied
catalog. `linejam_mint_guest` is the first call for most sessions; every other
tool requires the returned `guestToken`.

Configure the MCP client to launch `pnpm agent:mcp` with the selected checkout
as its working directory and the environment described above. If the client
cannot set a working directory or load that environment, use a caller-owned
wrapper that does both before replacing itself with the server. The
registration must not embed credentials or assume a global checkout path.

Validate a new registration with `initialize` and `tools/list`. Tool discovery
is not permission to create rooms or evidence that browser gameplay works.

## Browser QA

The repo-local [`play-linejam`](../.agents/skills/play-linejam/SKILL.md) skill
owns complete multiplayer browser verification through the rendered UI. It is
not a backend setup tool and is not required for an isolated rendering or
documentation check. The coordinator and player contracts own target authority,
isolated sessions, nine rounds and reveal, room closure, fresh-session
rejection, and unconditional cleanup.

`pnpm qa:play-linejam:result` validates the closed schema and semantic pass
invariants, verifies every retained artifact is a non-empty regular run-local
file, and persists the sanitized receipt exactly once. Backend calls, preflight,
or an uninspected screenshot do not establish real-player acceptance.

## API-face disposition

Linejam does not ship a public HTTP API. Convex functions are the durable game
API; the web app, CLI, and MCP all call the same generated functions. Existing
Next.js `/api` routes are internal support (health, guest session minting), not
a product integration surface.

A public HTTP API would duplicate Convex contracts and invent a second auth and
rate-limit story without a known non-agent consumer. If a later consumer cannot
run MCP/CLI and needs HTTP, treat that as a new card with its own audience,
authentication, rate limits, endpoint list, compatibility promise, and e2e
contract.
