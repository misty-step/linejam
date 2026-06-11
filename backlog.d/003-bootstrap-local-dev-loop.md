# Bootstrap Local Dev Loop

Priority: P2
Status: ready
Estimate: M

## Goal

Give developers and agents a one-command path from clone to runnable workspace with dependency install, env-file creation, and local claims support.

## Non-Goals

- Containerize the whole stack
- Add Docker Compose or devcontainer support in this slice
- Provision remote secrets automatically

## Oracle

- [ ] `bash scripts/setup.sh --help`
- [ ] `bash scripts/setup.sh --write-env --skip-install` creates `.env.local` from `.env.example` without clobbering an existing file.
- [ ] `source scripts/lib/claims.sh && claim_acquire smoke-test && claim_release smoke-test`
- [ ] `README.md` and `CLAUDE.md` document the setup command and claim workflow.

## Notes

- The worktree currently has no `node_modules`, and the repo has no bootstrap script.
- Keep the setup path local-first and non-destructive: write placeholders, validate, and explain missing secrets clearly.
- This item improves agent throughput but should not outrank player-facing reliability fixes.

## Implementation Sequence

1. Add `scripts/setup.sh` with help output and safe env bootstrapping.
2. Document setup and claims in `README.md` and `CLAUDE.md`.
3. Verify claims and setup commands locally.

## Repo Anchors

- `.env.example`
- `README.md`
- `CLAUDE.md`
- `scripts/lib/claims.sh`
