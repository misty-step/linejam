---
name: linejam-cli
description: Use Linejam's checked-in CLI or MCP face to create/join a room, inspect game state, submit lines, or browse/favorite poems. Use when scripted gameplay or backend-level acceptance is requested; use a browser for UI claims.
---

# Linejam CLI / MCP

Both faces call `scripts/lib/linejamClient.ts` and the generated Convex API; they
do not replace browser acceptance or reimplement game policy.

```bash
pnpm agent:cli --help
pnpm agent:cli -- <group> <action> [args]
pnpm agent:mcp
```

Use the CLI for bounded scripted play and JSON receipts. Start the stdio MCP
server only when the lane explicitly commissions a long-running tool process.
Use Playwright for rendering, accessibility, keyboard, responsive, or complete
user-flow claims.

## Target and authority

`NEXT_PUBLIC_CONVEX_URL` selects the backend. Confirm it before any write; a
production target requires explicit live production authority. CLI/MCP writes
create real rooms, lines, and favorites on that deployment.

The guest token is a credential. Prefer `LINEJAM_GUEST_TOKEN` over a command-line
argument, never paste it into chat or evidence, and redact process output before
retention. Room create/join may mint and print a token to stderr for reuse; do
not run those commands in a transcript or log sink that is not credential-safe.
`GUEST_TOKEN_SECRET` must match the target deployment for production-like use.

For the full action list, identity lifecycle, and MCP registration shape, read
`docs/agent-faces.md`. Convex sync/probe/migration authority is separate and
lives in `docs/ops/observability-ci.md`.
