# CLI and MCP

Both faces are thin adapters over `cli/client.ts`, which calls the same Worker
HTTP routes as the browser with the caller's guest credential. They hold no
admin key and no rule of their own: identity, membership, word counts and
privacy are decided by the Worker.

Set the target with `LINEJAM_URL` (for example `http://127.0.0.1:8787`).

## CLI

```sh
pnpm cli guest mint
pnpm cli room create <penName> [--emblem ID]
pnpm cli room join <code> <penName> [--emblem ID]
pnpm cli room state <code>
pnpm cli game start <code>
pnpm cli game assignment <code>
pnpm cli game submit-line <code> <poemId> <lineIndex> <text...>
pnpm cli game reveal <code> <poemId>
pnpm cli poems list
pnpm cli poems get <poemId>
pnpm cli favorites toggle <poemId>
pnpm cli favorites list
```

- Identity: `--guest-token TOKEN` or `LINEJAM_GUEST_TOKEN`. `room create` and
  `room join` mint a guest when none is given.
- Success: the result as JSON on stdout, exit `0`.
- Rejection: `{"error":{"code","message","status"}}` on stderr, empty stdout,
  exit `1`. Usage errors use the same shape with exit `2`.
- A minted credential is written to **stderr only**
  (`{"minted":{"guestId","guestToken"}}`). stdout never contains it, so stdout
  is safe to share.

The guest token is a credential. Prefer the environment variable to an
argument, and keep stderr out of logs you would share.

## MCP

`pnpm mcp` speaks JSON-RPC 2.0 over stdio, one message per line. It supports
`initialize`, `ping`, `tools/list` and `tools/call`.

Tools: `linejam_mint_guest`, `linejam_create_room`, `linejam_join_room`,
`linejam_room_state`, `linejam_start_game`, `linejam_current_assignment`,
`linejam_submit_line`, `linejam_reveal_poem`, `linejam_list_poems`,
`linejam_get_poem`, `linejam_toggle_favorite`, `linejam_list_favorites`.

- `linejam_mint_guest` is the only way to get an identity; every other tool
  requires its `guestToken`.
- A rejected game action is a tool result with `isError: true`.
- A malformed request (unknown method or tool, missing or mistyped argument,
  invalid JSON) is a JSON-RPC protocol error.
- `initialize` and `tools/list` make no network call. Discovery creates nothing.

Neither face proves anything about the rendered player experience; that is the
walkthrough's job ([testing](testing.md)).
