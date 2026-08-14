# Contributing

Linejam uses `master` as the base branch and Conventional Commits for commit
messages.

## Setup

```bash
bash scripts/setup.sh
```

Fill `.env.local` with the Convex, Clerk, guest-token, and Canary values needed
for the loop you are running. Keep `GUEST_TOKEN_SECRET` aligned across local,
DigitalOcean App Platform, and Convex when testing room flows.

## Claiming Work

[GitHub Issues](https://github.com/misty-step/linejam/issues) is Linejam's sole
work ledger. Do not list, claim, update, or duplicate Linejam work in Powder.
The cutover is tracked by
[#393](https://github.com/misty-step/linejam/issues/393).

A manual claim has exactly two parts:

1. Assign the GitHub Issue to the contributor before changing the repository.
   If self-assignment is unavailable, ask a maintainer to assign it rather than
   starting an invisible claim.
2. Create a `forest/<issue>-<slug>` branch. Open and link a draft pull request
   as soon as the work has a pushable change.

The assignee plus either that branch or its linked PR is the claim. An assignee
with neither is only an intent to claim; a branch or PR with no assignee is
unclaimed. Before starting, check both surfaces for an existing claim. On
abandonment, remove the assignee and close or hand off the PR so the Issue is
visibly available again. GitHub needs no lease, run record, or claim-status
label.

`forest:ready` is only an Iron Forest scheduling signal: it means an open,
unclaimed Issue has executable acceptance criteria and no unresolved
dependency or authority gate. It is not priority, status, or a manual claim.
Linejam has no Iron Forest declaration yet, so Linejam cannot dispatch Iron
Forest and no Linejam Issue may receive `forest:ready` until that declaration
exists.

## Local Checks

Use focused checks while developing:

```bash
pnpm test --run <path>
pnpm lint
pnpm typecheck
```

Before pushing, run the authoritative gate:

```bash
pnpm ci:prepush
```

Do not use `--no-verify`, lower coverage, disable tests, or loosen lint rules
to get green. If browser evidence or smoke coverage is relevant, include the
artifact link or workflow run in the PR.

## Pull Requests

PRs should:

- Target `master`.
- Use a Conventional Commit title.
- Describe the behavior or documentation outcome.
- Name the exact verification commands, workflow runs, and rendered artifacts.
- Call out residual risk or intentionally unverified paths.
- Keep secrets out of logs, screenshots, and fixtures.

For UI or game-flow changes, include browser evidence from Playwright,
`pnpm evidence:guest-flow`, preview smoke, or production smoke as appropriate.
For security-sensitive changes, reference `SECURITY.md` and keep vulnerability
details out of public discussion until patched.
