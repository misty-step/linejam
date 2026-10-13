# 0001: Hybrid auth with signed guest tokens

- **Status:** accepted
- **Date:** 2026-10-13 (migration; original record undated)
- **Primitives:** guest-identity
- **Powder:** none recorded

## Context

Unsigned guest IDs allowed impersonation; Linejam also needs frictionless guest entry and persistent signed-in identity. Clerk-only entry would add unacceptable party-game friction.

## Decision

Keep Clerk identity plus HMAC-SHA256-signed guest credentials, issued by Next.js and verified with `crypto.subtle` on every Convex mutation. Try Clerk first, then verify the guest token; return no identity if neither is valid. Pass guest proof to guest queries and mutations. Do not accept an unsigned guest ID as proof of identity; use the existing guest-identity primitive.

## Consequences

The web and Convex deployment must share `GUEST_TOKEN_SECRET`. The original issuance route was `/api/auth/guest`; current issuance is [`/api/guest/session`](../../app/api/guest/session/handler.ts). Reuse a stored valid credential before minting one. Preserve existing users’ games with valid tokens; deprecated unsigned `guestId` input must raise a `ConvexError` with refresh instructions. Tokens have a fixed 30-day expiry; rotation was not implemented. Per-request verification adds latency. Signed credentials add verification and expiry management without a separate JWT or session-cookie identity system. Revisit if the credential lifecycle requires a different trust model.
