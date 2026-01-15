# ADR-0001: Hybrid Auth with Signed Guest Tokens

## Status

Accepted

## Context

Linejam needs frictionless onboarding (join a game in seconds) while also supporting persistent identity for signed-in users. The original implementation used unsigned `guestId` UUIDs stored in localStorage and passed directly to Convex mutations. This was simple but had a critical security flaw: anyone who knew (or guessed) a guestId could impersonate that guest.

Issue #22 documented an auth bypass where attackers could submit lines on behalf of other guests.

## Decision

Implement a hybrid auth system:

1. **Clerk authentication** for signed-in users (full identity management)
2. **HMAC-signed guest tokens** for anonymous players

Guest tokens are:

- Issued by a Next.js API route (`/api/auth/guest`)
- Signed with HMAC-SHA256 using a shared secret (`GUEST_TOKEN_SECRET`)
- Verified on every Convex mutation using `crypto.subtle`
- 30-day expiry to limit exposure window

The auth flow:

```
Frontend:
  1. Try Clerk auth
  2. If no Clerk user, check localStorage for guestToken
  3. If no token, call /api/auth/guest to mint one
  4. Pass guestToken to all Convex queries/mutations

Backend (convex/lib/auth.ts):
  1. Check ctx.auth.getUserIdentity() for Clerk
  2. If no Clerk, verify guestToken signature
  3. Return null if neither is valid
```

## Consequences

**Positive:**

- Guests cannot impersonate each other (tokens are cryptographically bound)
- Seamless migration: existing users keep their games if they have a valid token
- Clear deprecation path: unsigned guestId throws ConvexError with refresh instructions

**Negative:**

- Requires shared secret between Next.js and Convex (env var coordination)
- Slight latency: HMAC verification on every request (~1ms)
- Token rotation not implemented (fixed 30-day expiry)

**Alternatives Considered:**

- **JWT**: More standardized but heavier; HMAC-signed payload is sufficient for our needs
- **Session cookies**: Would require server-side session storage; Convex is serverless
- **Clerk-only**: Eliminates guest support; unacceptable friction for a party game
