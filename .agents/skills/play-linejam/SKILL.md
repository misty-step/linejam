---
name: play-linejam
description: Verify a complete Linejam multiplayer game through the rendered human UI, with isolated players, room closure, and a sanitized evidence receipt. Use for commissioned multiplayer browser QA, not backend setup or isolated rendering checks.
---

# Play Linejam

Use this skill when acceptance requires real players completing a multiplayer
game through the rendered UI. It does not authorize remote writes or replace a
focused browser check for unrelated UI changes. CLI/MCP game mutations cannot
stand in for player interactions.

Read the contract for the work being performed:

- [Coordinator](skill://play-linejam/coordinator.md): target authority,
  preflight, concurrent player orchestration, bounded lifecycle, ordered room
  closure and fresh-session rejection, unconditional teardown, and evidence
  inspection.
- [Player](skill://play-linejam/player.md): isolated browser sessions and exact
  host, guest, and verifier UI protocol using the pinned `agent-browser`.
- [Result schema](skill://play-linejam/result.schema.json): closed aggregate and
  per-player receipt contract. Persist through `pnpm qa:play-linejam:result`,
  never by writing a pass claim directly.

The coordinator runs `pnpm qa:play-linejam:check` before opening sessions.
Passing preflight only checks package/schema readiness; it is not gameplay
evidence. A completed run still requires all nine rounds, reveal, observed
closure and join rejection, session cleanup, and inspected, non-empty run-local
visual artifacts. Structured receipts must not contain room codes, guest
tokens, poem text, or raw UI/console errors.
