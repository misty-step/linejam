# Bootstrap Local Dev Loop

Priority: P2
Status: done
Estimate: M

## Goal

Give developers and agents a one-command path from clone to runnable workspace with dependency install, env-file creation, and local claims support.

## Non-Goals

- Containerize the whole stack
- Add Docker Compose or devcontainer support in this slice
- Provision remote secrets automatically

## Oracle

- [x] `bash scripts/setup.sh --help`
- [x] `bash scripts/setup.sh --write-env --skip-install` creates `.env.local` from `.env.example` without clobbering an existing file.
- [x] `source scripts/lib/claims.sh && claim_acquire smoke-test && claim_release smoke-test`
- [x] `README.md` and `CLAUDE.md` document the setup command and claim workflow.

## Verification

- `pnpm vitest run tests/scripts/setup.test.ts tests/scripts/claims.test.ts`
- `bash -n scripts/setup.sh scripts/lib/claims.sh && shellcheck scripts/setup.sh scripts/lib/claims.sh`
- `pnpm exec prettier --check README.md CLAUDE.md tests/scripts/setup.test.ts tests/scripts/claims.test.ts`
- `git diff --check`

## Notes

- `bash scripts/setup.sh` now creates `.env.local` from `.env.example` when missing, prepares `.claims/`, and runs `pnpm install`.
- `bash scripts/setup.sh --write-env --skip-install` keeps an existing `.env.local` and does not clobber local secrets.
- `scripts/lib/claims.sh` no longer uses `path` as a local variable, so the documented `source scripts/lib/claims.sh` flow works in zsh as well as Bash.
- `.claims/` is ignored as local coordination state.

## Implementation Sequence

1. Add `scripts/setup.sh` with help output and safe env bootstrapping.
2. Document setup and claims in `README.md` and `CLAUDE.md`.
3. Verify claims and setup commands locally.

## Repo Anchors

- `.env.example`
- `README.md`
- `CLAUDE.md`
- `scripts/lib/claims.sh`
