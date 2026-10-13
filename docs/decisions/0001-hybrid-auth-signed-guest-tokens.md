# 0001: Hybrid auth with signed guest tokens

- **Status:** accepted
- **Date:** 2026-10-13 (migration; original record undated)
- **Primitives:** guest-identity
- **Powder:** none recorded

## Context
Unsigned guest IDs allowed impersonation; Linejam also needs frictionless guest entry and persistent signed-in identity. Clerk-only entry would add unacceptable party-game friction.

## Decision
Keep Clerk identity plus HMAC-signed guest credentials verified by the backend. Do not accept an unsigned guest ID as proof of identity; use the existing guest-identity primitive.

## Consequences
The web and Convex deployment must share GUEST_TOKEN_SECRET. Signed credentials add verification and expiry management without a separate JWT or session-cookie identity system. Revisit if the credential lifecycle requires a different trust model.
