# Security Policy

Linejam is a public repository for a party game that handles signed guest
sessions, private poem archives and explicit public poem sharing, on one
Cloudflare Worker with Durable Objects.

## Reporting a Vulnerability

Do not open a public GitHub issue for vulnerabilities, leaked secrets, auth
bypass reports, or private data exposure.

Preferred path:

1. Use GitHub private vulnerability reporting from the repository Security tab
   when it is available.
2. If private reporting is unavailable, email the maintainer at
   `phrazzld@pm.me` with `[linejam-security]` in the subject.

Include the affected route or file, impact, reproduction steps, and whether the
issue is already public.

## Response Path

The maintainer will acknowledge actionable reports on a best-effort basis,
triage impact, patch privately when needed, and coordinate disclosure after a
fix is available. There is no bug bounty program.

## Scope

In scope:

- Guest-token handling and room/session authorization
- Hidden poem text reaching a spectator, another writer or an outsider
- Public poem sharing privacy, including revoked or unconfirmed links
- Secret handling in local, Cloudflare and GitHub Actions flows
- Cross-site scripting, request forgery, or data exposure in Worker routes

Out of scope:

- Denial-of-service testing against production
- Social engineering
- Findings that require leaked credentials not obtained from this repository
- Scanner-only reports without a working exploit path

## Dependency maintenance

The Worker has no runtime dependencies; everything in `package.json` is a
build or test tool. Regenerate `pnpm-lock.yaml` with pnpm, verify a frozen
install, then read back Dependabot alerts after merge. Never dismiss alerts
merely to make the count match.
