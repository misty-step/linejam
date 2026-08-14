# Contributing

Linejam uses `master` as the base branch and Conventional Commits for commit
messages.

## Setup

```bash
bash scripts/setup.sh
```

Fill `.env.local` with the Convex, Clerk, guest-token, and Sentry values needed
for the loop you are running. Keep `GUEST_TOKEN_SECRET` aligned across local,
DigitalOcean App Platform, and Convex when testing room flows.

## Claiming Work

[GitHub Issues](https://github.com/misty-step/linejam/issues) is Linejam's sole
work ledger. Do not claim, update, or duplicate Linejam work in Powder. The
cutover is tracked by
[#393](https://github.com/misty-step/linejam/issues/393).

A manual claim is the GitHub Issue assignee. Assign the Issue to the contributor
before changing the repository. If self-assignment is unavailable, ask a
maintainer to assign it rather than starting invisible work. Before starting,
check for an existing assignee.

Create a `forest/<issue>-<slug>` branch and link its pull request to the Issue
once the work has a pushable change. The branch and PR are delivery evidence,
not a second lock. On abandonment, remove the assignee and close or hand off the
PR so the Issue is visibly available again. GitHub needs no lease, run record,
or claim-status label.

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
