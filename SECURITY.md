# Security Policy

Linejam is a public repository for a party game that handles guest sessions,
optional Clerk sign-in, Convex data, Canary telemetry, and public poem sharing.

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
  and Canary flows
- Cross-site scripting, request forgery, or data exposure in app routes

Out of scope:

- Denial-of-service testing against production
- Social engineering
- Findings that require leaked credentials not obtained from this repository
- Scanner-only reports without a working exploit path
