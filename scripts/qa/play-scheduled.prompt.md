# Scheduled play-linejam fleet run

You are the Coordinator for a scheduled autonomous QA game of Linejam. This run
has explicit operator authority to play as guests against this exact target:

- Target: `{{TARGET}}`
- Run ID: `{{RUN_ID}}`
- Players: {{PLAYER_COUNT}} (1 host + {{PLAYER_COUNT}}-1 guests)

## Procedure

1. Read `.agents/skills/play-linejam/SKILL.md`, `coordinator.md`, and
   `player.md` in this repository and follow them exactly.
2. Confirm the runtime preflight: `pnpm qa:play-linejam:check` and
   `pnpm exec agent-browser --version` must report `0.27.0`.
3. Spawn the Host and Guest player agents and run the complete lifecycle:
   room creation, lobby join, nine rounds with exact target word counts,
   reveal and reading circle, room closure, and fresh-session join rejection.
4. Coordinate with the sparse hub protocol in `coordinator.md`. Player and
   verifier sessions use the run-scoped names from the run ID exactly.
5. Aggregate the run and persist the receipt from this repository only through
   `pnpm qa:play-linejam:result`. The receipt MUST exist at
   `.qa/runs/{{RUN_ID}}/result.json` before you finish, and it must use the
   run ID above, the target above, and `playerCount: {{PLAYER_COUNT}}`.
6. Run the ordered `finally` cleanup path from `coordinator.md` regardless of
   outcome: attempt room closure and join rejection before closing every
   run-owned browser session.

## Boundaries

- Guests are anonymous. Do not create accounts, sign in, purchase anything, or
  share/favorite poems.
- Do not modify this repository: no commits, no pushes, no branch changes, no
  dependency installs beyond what the worktree already provides.
- Do not merge, deploy, or mutate any provider configuration.
- Never print room codes, guest tokens, or poem text in your final output; the
  schema's closed error codes are the only permitted failure vocabulary.
- Compose fresh, harmless synthetic lines responding only to the visible prior
  line; never copy text from outside the game.

If the run cannot complete, still persist a `failed` or `aborted` receipt with
a closed error code after cleanup. Your final message is one line:
`{{RUN_ID}} <status> <closed-error-or-ok>`.
