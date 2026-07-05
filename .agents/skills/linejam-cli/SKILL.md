---
name: linejam-cli
description: Play or inspect a live Linejam game as an agent — create/join rooms, read game state, submit lines, browse and favorite poems — via the linejam-cli terminal face or the linejam-mcp stdio server. Use when asked to interact with Linejam programmatically, test the game end-to-end without a browser, or wire an agent into a room as a player.
---

# Linejam CLI / MCP

Linejam ships two thin, agent-facing faces over one shared core
(`scripts/lib/linejamClient.ts`) — a terminal CLI and a stdio MCP server.
Neither reimplements game logic; both translate their own input format into
a call against the same Convex functions the web app itself uses.

- **CLI**: `pnpm agent:cli -- <group> <action> [args] [--guest-token TOKEN]`,
  or `npx tsx scripts/cli/linejam-cli.ts --help` for the full command list.
- **MCP**: `pnpm agent:mcp` (stdio JSON-RPC 2.0 — `initialize`, `tools/list`,
  `tools/call`). `linejam_mint_guest` is the first tool most sessions call;
  every other tool requires the resulting `guestToken`.

## Identity

Every write and most reads take an optional `guestToken` — the same
anonymous-play mechanism the web app uses for guests (no Clerk OAuth
required). `linejamClient.mintGuestToken()` signs one locally with the
real production signing code (`lib/guestToken.ts`), so an agent identity is
indistinguishable from a real guest player. Reuse the same token across a
session's calls — a room membership is tied to the identity that joined it.

## Deployment

Both faces read `NEXT_PUBLIC_CONVEX_URL` from the environment — source
`.env.local` for the dev deployment, or the real deployment env for
production. Never hardcode a deployment URL.

## When to reach for this vs. the browser

Use the CLI/MCP for scripted verification, agent-driven playtesting, or
multi-player scenarios where spinning up several browser sessions would be
slower than a few tool calls. Use the real app (or Playwright, see
`scripts/evidence/guest-flow.mjs`) when the thing under test is the UI
itself — these faces exercise the Convex core, not the rendered page.
