# Establish Release Governance Baseline

Priority: P2
Status: ready
Estimate: S

## Goal

Add the minimum governance artifacts required for a public, multi-contributor release process: review routing, security contact, and explicit contribution rules.

## Non-Goals

- Change branch protection settings from code
- Add enterprise security tooling
- Rework CI job topology

## Oracle

- [ ] `CODEOWNERS` exists and routes the key product surfaces.
- [ ] `SECURITY.md` explains how to report vulnerabilities and what response path to expect.
- [ ] `CONTRIBUTING.md` explains local checks, commit style, and PR expectations for this repo.
- [ ] `README.md` links to the new contributor/security docs.

## Notes

- Branch protection exists on `master`, but the repo is still missing the repository-level documents that tell humans and agents how to work safely.
- Keep the docs terse and specific to this project; do not paste generic templates.

## Repo Anchors

- `.github/workflows/ci.yml`
- `AGENTS.md`
- `README.md`
