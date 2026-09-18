---
name: play-linejam
description: Verify a complete Linejam multiplayer game through the rendered human UI, with isolated players, room closure, and a sanitized evidence receipt. Use for commissioned multiplayer browser QA, not backend setup or isolated rendering checks.
---

# Play Linejam

Use this skill when acceptance requires real players completing a multiplayer
game through the rendered UI. It does not authorize remote writes or replace a
focused browser check for unrelated UI changes. CLI/MCP game mutations cannot
stand in for player interactions.

## Prepare the real target

For an isolated guest game, use the existing
[local runtime guide](../../../docs/local-development.md). It owns prerequisites,
fresh source synchronization, readiness, port/project isolation, evidence, and
teardown. Do not copy a worktree's dotenv files, use `pnpm build` (a deployment
wrapper), or select a shared Convex backend to make local play work.

Choose the smallest surface:

- `node scripts/local/cli.mjs qa --project <owned-project>` prepares the real
  local Next/Convex stack and runs the existing deterministic browser lifecycle,
  including rematch. It does not replace this skill's closure/rejection exercise.
- `node scripts/local/cli.mjs up --project <owned-project>` prepares a target
  for interactive play. After `up` proves current readiness, use `status` for
  that same project to inspect the receipt and set `LINEJAM_PLAY_BASE_URL` to
  its loopback **web** origin. `status` reports the last successful readiness
  receipt, not a new health proof. Distinct players need isolated sessions.
- Use [change-scoped checks](../../../docs/testing.md) for non-game changes;
  do not launch a complete multiplayer exercise just to validate documentation.

Both `up` and `qa` leave services running. The invoking coordinator owns
`node scripts/local/cli.mjs down --project <owned-project>` after browser and
room cleanup, including on failure. `down` preserves data and evidence; use the
guide's explicitly confirmed `reset` only for disposable state owned by this run.
Local guest play does not establish Clerk sign-in or hosted-deployment health.

## Exercise and inspect

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
