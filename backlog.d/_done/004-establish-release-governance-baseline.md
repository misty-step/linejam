# Establish Release Governance Baseline

Priority: P2
Status: done
Estimate: S

## Goal

Add the minimum governance artifacts required for a public, multi-contributor release process: review routing, security contact, and explicit contribution rules.

## Non-Goals

- Change branch protection settings from code
- Add enterprise security tooling
- Rework CI job topology

## Oracle

- [x] `CODEOWNERS` exists and routes the key product surfaces.
- [x] `SECURITY.md` explains how to report vulnerabilities and what response path to expect.
- [x] `CONTRIBUTING.md` explains local checks, commit style, and PR expectations for this repo.
- [x] `README.md` links to the new contributor/security docs.

## Notes

- Branch protection exists on `master`, but the repo was missing the repository-level documents that tell humans and agents how to work safely.
- Keep the docs terse and specific to this project; do not paste generic templates.

## Repo Anchors

- `.github/workflows/ci.yml`
- `AGENTS.md`
- `README.md`

## Verification

- `test -f CODEOWNERS && test -f SECURITY.md && test -f CONTRIBUTING.md && rg -n 'CONTRIBUTING|SECURITY|CODEOWNERS' README.md`
- `pnpm exec prettier --check SECURITY.md CONTRIBUTING.md README.md AGENTS.md backlog.d/_done/004-establish-release-governance-baseline.md`
- `git diff --check -- CODEOWNERS SECURITY.md CONTRIBUTING.md README.md AGENTS.md backlog.d/_done/004-establish-release-governance-baseline.md backlog.d/004-establish-release-governance-baseline.md`
- Fresh read-only critic via `opencode run` on `/tmp/linejam-004.diff`: `NO BLOCKING FINDINGS`
- `pnpm ci:prepush`: Dagger reported `all-no-e2e: ok` and `e2e: ok`
