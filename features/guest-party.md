# Guest party (US-001)

Entry, identity, rooms, invitations, presence, host succession, scripted players.

- Rules: `shared/rules.ts` (room codes, emblems, capacity)
- Identity: `src/auth.ts`, `POST|GET /api/guest` in `src/worker.ts`
- Room: `src/room.ts` — `create`, `join`, `leave`, `start`, `close`, presence, `ensureHost`, WebSockets
- UI: `web/src/views.ts` (`landing`, `lobby`), `web/src/qr.ts`, `web/src/net.ts`
- CLI / MCP: `cli/`
- Tests: `tests/worker/room.test.ts`, `tests/worker/identity.test.ts`, `tests/faces/cli.test.ts`, `tests/faces/mcp.test.ts`
- Walkthrough: landing → lobby → join by QR → start (`e2e/walkthrough.mjs`)
