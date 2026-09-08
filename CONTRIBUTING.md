# Contributing

Linejam uses `master` as the base branch and Conventional Commits for commit
messages.

## Setup

```bash
node scripts/local/cli.mjs dev
```

This runs the real isolated guest game without provider credentials or a host
dotenv file. Ctrl-C stops the owned stack. See
[local development](docs/local-development.md) for QA, reset, concurrent projects,
and readiness evidence.

Hosted-provider integration is a separate, explicitly commissioned lane. Use
`bash scripts/setup.sh` for that lane and align its web/Convex guest secret;
ordinary checks never sync code or create provider configuration automatically.

## Starting Work

Work from a current request and check the affected code before implementation.
Check existing branches, pull requests, and active sessions for overlap; agree
on ownership when another contributor is working on the same files. Use a
focused branch and describe the result and verification evidence in its pull
request. Linear owns current work and priorities; historical issues are
context, not an automatic queue or a required intake ceremony.

Repository docs own version-bound contracts, accepted decisions, and portable
procedures. Keep fixtures and shipped assets in the repo; retain raw or
sensitive run output in approved artifact storage and link sanitized,
revision-specific conclusions from the work item or PR. Release and runtime
ledgers keep their existing authority. `VISION.md` is optional context.

## Local Checks

Choose focused checks from [docs/testing.md](docs/testing.md). Pure
documentation or non-runtime configuration needs affected formatting,
link/command resolution, and relevant schema/importer evidence, not a full
application run solely to prove prose.

Before pushing behavior changes, run the fast local gate:

```bash
pnpm ci:prepush
```

The pre-push hook also applies to documentation-only pushes; do not bypass it
or require a duplicate manual run. Hosted CI's merge gate remains authoritative
for merge.

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
