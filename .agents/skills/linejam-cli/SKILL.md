---
name: linejam-cli
description: Use Linejam's CLI or MCP server to create/join a room, read state, submit lines, reveal, or browse/favorite poems. Use for scripted play or API-level acceptance; use a browser for UI claims.
---

# Linejam CLI / MCP

Both faces call `cli/client.ts`, which uses the same Worker HTTP API as the
browser. They do not replace browser acceptance and hold no game rule.

```bash
export LINEJAM_URL=http://127.0.0.1:8787   # start it with `pnpm dev`
pnpm cli --help
pnpm cli room create Ada
pnpm mcp                                   # stdio MCP server
```

## Target and authority

`LINEJAM_URL` selects the Worker. Confirm it before any write. A local
`pnpm dev` target is free to use; any remote target needs explicit operation
authority, and production needs live production authority. CLI/MCP writes
create real rooms, lines and favorites on that target.

The guest token is a credential. Prefer `LINEJAM_GUEST_TOKEN` to a
command-line argument, never paste it into chat or evidence, and note that
`room create`, `room join` and `guest mint` print a minted token on **stderr**.
stdout never contains it.

Full command list, output contract and MCP tool list:
`docs/agent-faces.md`.
