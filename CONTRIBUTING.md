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

For backlog work, claim one ready Powder card before starting:

```bash
source ~/.secrets
powder list-ready --repo linejam
powder claim linejam-NNN --agent <name>
```

Keep the returned run current, and complete the card or release the claim if
you abandon the work. Powder is the only work ledger.

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
