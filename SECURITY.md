# Security Policy

Linejam is a public repository for a party game that handles guest sessions,
optional Clerk sign-in, Convex data, Sentry telemetry, and public poem sharing.

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
- Clerk and Convex auth alignment
- Public poem sharing privacy
- Secret handling in local, DigitalOcean App Platform, Convex, GitHub Actions,
  and Sentry flows
- Cross-site scripting, request forgery, or data exposure in app routes

Out of scope:

- Denial-of-service testing against production
- Social engineering
- Findings that require leaked credentials not obtained from this repository
- Scanner-only reports without a working exploit path

## Dependency maintenance

Security overrides in `pnpm-workspace.yaml` use minimum versions and target only
requests below the fixed release. Never pin an exact replacement. Preserve a
consumer's major-version contract where needed; newer parent requests must fall
outside the override selector so the next security fix remains eligible.

Regenerate `pnpm-lock.yaml` with the repository's pinned pnpm, verify a frozen
install and the dependency audit, then read back Dependabot alerts after merge.
Keep the repository dependency graph enabled; a patched lockfile alone cannot
refresh alerts while GitHub dependency analysis is disabled. Never dismiss
alerts merely to make the count match the locally patched graph.
