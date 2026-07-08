# Agent Faces

Linejam exposes agent-facing entry points over the same Convex backend used by
the web app. They are for scripted playtesting, fleet QA, and MCP clients that
need to join or inspect a live game without driving a browser.

The shipped faces are thin adapters:

| Face  | Command                                     | Consumer                               | Owns                                       |
| ----- | ------------------------------------------- | -------------------------------------- | ------------------------------------------ |
| CLI   | `pnpm agent:cli -- <group> <action> [args]` | Terminal agents, scripts, smoke checks | Argument parsing and JSON output           |
| MCP   | `pnpm agent:mcp`                            | MCP-capable harnesses                  | stdio JSON-RPC, `tools/list`, `tools/call` |
| Skill | `.agents/skills/linejam-cli/SKILL.md`       | Codex and other repo-aware agents      | When to use CLI/MCP vs. browser automation |

All three route through `scripts/lib/linejamClient.ts`, which calls Convex
functions from `convex/_generated/api`. Game rules, assignment logic, presence,
host migration, poems, and favorites stay in Convex. Do not duplicate that
logic in an agent face.

## Identity Model

Agent sessions use the same anonymous guest-token model as the browser.

- `linejam_mint_guest` mints `{ guestId, guestToken }` without joining a room.
- CLI `room create` and `room join` mint a guest token when one is not supplied.
- Reuse one `guestToken` across follow-up calls. Room membership and host status
  are tied to that identity.
- Pass CLI identity as `--guest-token TOKEN` or `LINEJAM_GUEST_TOKEN`.
- Pass MCP identity as the `guestToken` argument on every tool except
  `linejam_mint_guest`.

The token is signed by `lib/guestToken.ts` with `GUEST_TOKEN_SECRET`, matching
the browser guest session route. For local development, the code falls back to a
development-only secret when `NODE_ENV` is not production. Deployed and
production-like harnesses must provide the same `GUEST_TOKEN_SECRET` used by the
target Convex deployment.

## Environment Contract

Source the deployment environment before running either face:

```bash
cd /Users/phaedrus/Development/linejam
set -a
[ -f .env.local ] && . ./.env.local
set +a
```

Required for live room/game tools:

- `NEXT_PUBLIC_CONVEX_URL` points at the Convex deployment the agent should use.
- `GUEST_TOKEN_SECRET` matches that deployment for production-like targets.

Optional but common:

- `LINEJAM_GUEST_TOKEN` keeps CLI calls on the same guest identity.
- `CONVEX_OVERRIDE_ACCESS_TOKEN` is only for one-shot Convex CLI metadata
  probes in isolated worktrees; the agent faces do not need it.

Never hardcode deployment URLs or tokens into MCP configuration. Keep the repo
path stable and source `.env.local` or the harness's environment wrapper at
launch time.

## CLI Face

Use the CLI when a script or human-readable terminal transcript is the easiest
proof surface.

```bash
pnpm agent:cli -- room create "Ada"
pnpm agent:cli -- room join ABCD "Byron" --guest-token "$LINEJAM_GUEST_TOKEN"
pnpm agent:cli -- room state ABCD --guest-token "$LINEJAM_GUEST_TOKEN"
pnpm agent:cli -- game start ABCD --guest-token "$LINEJAM_GUEST_TOKEN"
pnpm agent:cli -- game assignment ABCD --guest-token "$LINEJAM_GUEST_TOKEN"
pnpm agent:cli -- game submit-line <poemId> 0 "Moon" --guest-token "$LINEJAM_GUEST_TOKEN"
pnpm agent:cli -- poems list ABCD --guest-token "$LINEJAM_GUEST_TOKEN"
pnpm agent:cli -- favorites list --guest-token "$LINEJAM_GUEST_TOKEN"
```

The CLI prints JSON to stdout. When it mints a guest token implicitly, it prints
the token to stderr so the caller can capture and reuse it.

## MCP Face

Use the MCP server when an agent harness should discover Linejam actions as
tools. The server is a stdio JSON-RPC process that supports:

- `initialize`
- `tools/list`
- `tools/call`

Registered tools:

- `linejam_mint_guest`
- `linejam_create_room`
- `linejam_join_room`
- `linejam_room_state`
- `linejam_start_game`
- `linejam_current_assignment`
- `linejam_submit_line`
- `linejam_list_poems`
- `linejam_get_poem`
- `linejam_toggle_favorite`
- `linejam_list_favorites`

`linejam_mint_guest` is the first call for most sessions. Every other tool
requires the returned `guestToken`.

### Codex Registration

Copy-paste registration for the canonical local checkout:

```bash
codex mcp add linejam -- bash -lc 'cd /Users/phaedrus/Development/linejam && set -a && [ -f .env.local ] && . ./.env.local; set +a; exec pnpm agent:mcp'
```

Inspect or remove it:

```bash
codex mcp get linejam
codex mcp remove linejam
```

### Claude Desktop / JSON Registration

Use the same command shape in JSON-based MCP clients:

```json
{
  "mcpServers": {
    "linejam": {
      "command": "bash",
      "args": [
        "-lc",
        "cd /Users/phaedrus/Development/linejam && set -a && [ -f .env.local ] && . ./.env.local; set +a; exec pnpm agent:mcp"
      ]
    }
  }
}
```

## Registration Proof

`docs/evidence/linejam-920-mcp-registration.md` records the proof run for this
page: Codex registered the server, the registered command returned a successful
`tools/list`, and `linejam_mint_guest` returned a guest identity.

## API-Face Disposition

Waiver: Linejam does not ship a separate public HTTP API face now.

The durable API for game state is Convex. The web app, CLI, and MCP server all
call the same generated Convex functions. The existing Next.js `/api` routes are
internal app support routes such as health and guest session minting; they are
not a product integration surface.

This is intentional for the current party-game product:

- External consumers identified so far are agents, QA lanes, and playtesters.
  They are better served by CLI and MCP tools that preserve guest identity and
  avoid another auth contract.
- A public HTTP API would duplicate Convex contracts, require a separate auth
  and rate-limit story, and add support surface without a known non-agent
  consumer.
- If a future consumer cannot run MCP/CLI and needs direct HTTP integration,
  scope that as a new card with its own audience, authentication, rate limits,
  endpoint list, compatibility promise, and e2e contract.

Until that scoped card exists, "Convex functions are the API; CLI and MCP are
the distribution faces" is the active disposition.
