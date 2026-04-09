# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Linejam is a real-time collaborative poetry game. Players take turns adding constrained-length lines (1,2,3,4,5,4,3,2,1 words) to poems they can only partially see—creating absurdist shared poetry.

**Stack**: Next.js 16 (React 19) + Convex backend + Tailwind CSS 4 + Clerk auth (optional) + anonymous guests

**Key Features**: AI players (Gemini), 4 premium themes, poem sharing/export, help modal

## Development Commands

```bash
pnpm dev              # Next.js :3000 + Convex dev (parallel)
pnpm build            # convex deploy + next build
pnpm lint             # eslint
pnpm lint:fix         # eslint --fix
pnpm format           # prettier --write
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest run
pnpm test:watch       # vitest watch
pnpm test:ci          # vitest run --coverage
pnpm test:ui          # vitest interactive UI
```

## Architecture

### Frontend/Backend Connection

Convex is the serverless database + function layer. All queries/mutations run on Convex functions with auto-generated TypeScript types in `convex/_generated/api.d.ts`.

```typescript
// Frontend usage
const data = useQuery(api.game.getCurrentAssignment, { roomCode, guestId });
const mutation = useMutation(api.game.submitLine);
```

Real-time subscriptions via `useQuery` hook automatically sync across all players—no polling.

### Auth Pattern

Hybrid auth: Clerk (authenticated users) + guest UUID fallback (localStorage).

```typescript
// convex/lib/auth.ts
export async function getUser(ctx, guestId?) {
  // 1. Try Clerk: ctx.auth.getUserIdentity()
  // 2. Fall back to: guestId from localStorage
  // Returns user record or null
}
```

Frontend `useUser()` hook (lib/auth.ts) manages guest UUID persistence and returns: `{ clerkUser, guestId, isLoading, isAuthenticated, displayName }`.

### Game State Machine

```
LOBBY → IN_PROGRESS (9 rounds) → COMPLETED (reveal)
```

**Assignment Matrix** (convex/lib/assignmentMatrix.ts): 9×N array where each cell = user assigned to write that poem's line in that round. Constraint: no player writes consecutive lines for same poem (derangement-like).

## Key Directories

| Path          | Purpose                                                              |
| ------------- | -------------------------------------------------------------------- |
| `app/`        | Next.js App Router routes (server-first; client components explicit) |
| `components/` | UI primitives (Button, Card, Input) + game screens                   |
| `convex/`     | Backend schema, queries, mutations, auth helpers                     |
| `lib/`        | Shared utilities: auth hook, logger, word counting, cn()             |
| `lib/themes/` | Premium theme system (4 themes: kenya, mono, vintage, hyper)         |
| `hooks/`      | React hooks (useSharePoem for clipboard sharing)                     |
| `tests/`      | Vitest unit tests + Playwright E2E                                   |

## Design System

Kenya Hara minimalism—Zen garden aesthetic.

- **Accent**: Vermillion `oklch(0.55 0.22 25)` (calligrapher's seal)
- **Typography**: Cormorant Garamond (display) + Inter (body)
- **Colors**: Warm white background, near-black text
- **Tokens**: CSS custom properties in `globals.css`

Use `cn()` helper (clsx + tailwind-merge) for className composition.

### Theme System

Four premium themes in `lib/themes/`:

- **kenya** (default): Kenya Hara minimalism, warm white, vermillion accent
- **mono**: Brutalist monochrome, high contrast
- **vintage-paper**: Aged paper texture, sepia tones
- **hyper**: Cyberpunk neon, dark mode

Use `useTheme()` hook and `ThemeProvider` context. Themes apply via CSS variables.

## Convex Schema

Key indexes for common queries:

- `rooms.by_code` - room lookup
- `poems.by_room` - poems in room
- `lines.by_poem` - lines in poem order
- `favorites.by_user` - user's favorites

All mutations validate args with `v` schema validators.

### AI Players

`convex/ai.ts` handles AI player lifecycle. Host can add AI players in lobby. AI uses OpenRouter API (Gemini) to generate lines matching word count constraints.

Key functions:

- `addAiPlayer`: Adds AI with random persona to room
- `removeAiPlayer`: Removes AI from room
- `generateAiTurn`: Internal action that generates AI line via LLM

AI personas defined in `convex/lib/ai/personas.ts` with distinct writing styles.

## Quality Gates

Lefthook pre-commit: `gitleaks`, `eslint --fix`, `prettier --write`
Lefthook pre-push: `pnpm ci:prepush` (Dagger all, including authenticated browser coverage by default)
Commit messages: Conventional Commits (commitlint)

## Testing

500+ tests across Vitest (unit/integration) and Playwright (E2E). Coverage threshold: 85% lines/branches/functions/statements.

```bash
pnpm test:watch       # Development
pnpm test:ci          # CI with coverage
pnpm test:e2e         # Playwright E2E
pnpm test:e2e:ui      # Playwright interactive mode
```

### Debugging Test Hangs

1. **Isolate first** - run single file: `pnpm vitest run path/to/file.test.ts`
2. **Binary search** - if file hangs, comment out half the tests to find culprit
3. **Check for infinite loops** - while loops without termination guards
4. **Don't assume systemic issues** - verify on specific failing case before assuming framework bug

### Mocking Rules

**Mock at system boundaries only:**

- ✅ External APIs, third-party libraries (convex/react, @clerk/nextjs)
- ✅ Network requests, browser APIs (fetch, localStorage, clipboard)
- ✅ Non-deterministic behavior (Date.now, Math.random)
- ❌ Internal modules (@/lib/_, @/hooks/_, convex/lib/\*)
- ❌ Internal utilities (avatarColor, wordCount, auth helpers)

**Red flag:** If you're mocking `@/` or `../../` paths, you're mocking internal collaborators. Use the real implementation instead.

## Environment Variables

```bash
CONVEX_DEPLOYMENT, NEXT_PUBLIC_CONVEX_URL
CONVEX_DEPLOY_KEY              # Production/Preview deploy key (CI/CD only)
GUEST_TOKEN_SECRET             # Guest token signing (must match in Vercel + Convex)
OPENROUTER_API_KEY             # AI player LLM access (Convex only)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
CANARY_ENDPOINT, CANARY_API_KEY
NEXT_PUBLIC_CANARY_ENDPOINT, NEXT_PUBLIC_CANARY_API_KEY
LINEJAM_CANARY_WEBHOOK_SECRET
LINEJAM_CANARY_WEBHOOK_URL     # Required for webhook setup, not responder runtime
PLAYWRIGHT_BASE_URL, PLAYWRIGHT_CLERK_TEST_EMAIL
PLAYWRIGHT_REQUIRE_AUTH_E2E, PLAYWRIGHT_REQUIRE_AUTH_SMOKE
LINEJAM_SMOKE_RUNNER
LINEJAM_SYNC_CONVEX_BEFORE_DAGGER, LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE
LINEJAM_ALLOW_PROD_CONVEX_SYNC
LINEJAM_CANARY_CONTEXT_TIMEOUT_MS, LINEJAM_CANARY_RETENTION_DAYS
```

Local Dagger now requires real `NEXT_PUBLIC_CANARY_ENDPOINT` and
`NEXT_PUBLIC_CANARY_API_KEY` values for build-bearing lanes. The authoritative
contract should fail fast instead of silently substituting placeholder Canary
browser config.

Local Dagger is the source-of-truth engineering contract. It auto-syncs the active
Convex dev deployment before auth-heavy E2E and hydrates `GUEST_TOKEN_SECRET`
from the matching Convex deployment automatically. It refuses to push Convex
production code unless `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1` is set explicitly.

Hosted GitHub `merge-gate` still mirrors and enforces that contract remotely for
branch protection.

Local Dagger also ensures the Clerk `convex` JWT template exists before local
authenticated browser coverage runs. Keep
`LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE=0` unless you intentionally want the
CLI to create that template against a live Clerk instance.

Authenticated Playwright coverage only needs `CLERK_SECRET_KEY` plus
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. `PLAYWRIGHT_CLERK_TEST_EMAIL` remains an
optional override for dev/test Clerk keys because the helper can provision the
default smoke user there automatically. Live Clerk keys fail closed instead, so
point `PLAYWRIGHT_CLERK_TEST_EMAIL` at a precreated smoke account.

Authenticated Playwright routes sign into Clerk inside each live browser
context after the app is already serving traffic. Do not depend on serialized
Clerk storage state for protected-route coverage.

Local Dagger loads `.env.local` after `.env.production.local`, so localhost-safe
Clerk keys in `.env.local` override production values during the local
contract.

## Recent Features (Dec 2025)

- **AI Players**: Add AI players to games via OpenRouter/Gemini
- **Premium Themes**: 4 visual themes (kenya, mono, vintage-paper, hyper)
- **Poem Sharing**: Copy poem URLs to clipboard with analytics
- **Help Modal**: Floating "?" button explains gameplay
- **WordSlots**: Genkoyoushi-inspired word count indicator
- **Pen Names**: Author display name captured at write-time

## Code Patterns

### Parallel Database Operations

Always use `Promise.all` for multiple independent database operations:

```typescript
// BAD - sequential (slow)
for (const item of items) {
  await ctx.db.patch(item._id, { field: value });
}

// GOOD - parallel (fast)
await Promise.all(
  items.map((item) => ctx.db.patch(item._id, { field: value }))
);
```

For N+1 query patterns, batch with `q.or()` when possible:

```typescript
// Fetch all poems for multiple rooms in one query
const allPoems = await ctx.db
  .query('poems')
  .filter((q) => q.or(...roomIds.map((id) => q.eq(q.field('roomId'), id))))
  .collect();
// Then group in application code
```

### Loop Safety

All `while` loops must have a termination guard to prevent infinite loops:

```typescript
// BAD - can infinite loop
while (condition) { ... }

// GOOD - bounded iterations
let attempts = 0;
while (condition && attempts < MAX_ATTEMPTS) {
  attempts++;
  ...
}
```

## Observability

### Error Tracking

**Frontend (Next.js):**

- Browser globals are bridged into Canary by `components/CanaryClientObserver.tsx`
- Use `captureError()` from `lib/error.ts` for explicit error capture with context
- Request failures flow through `instrumentation.ts` and `/api/health`

**Backend (Convex):**

- Use `log` and `logError` from `convex/lib/errors.ts`
- Outputs structured JSON to stdout for Convex dashboard parsing
- Convex still uses structured logs; Canary is the app-side incident sink
- `/api/health` reports core app health separately from Canary readiness, so
  missing Canary ingest should be treated as degraded observability, not proof
  that gameplay is down

**Structured Logging:**

```typescript
// Next.js
import { log } from '@/lib/logger';
log.error('Operation failed', { userId, operation: 'submitLine' });

// Convex
import { log, logError } from './lib/errors';
logError('API call failed', error, { roomId, round });
```

### Canary Responder

```bash
# Local-first CI
pnpm ci:dagger:all

# Start webhook responder
pnpm canary:responder

# Register webhook subscription in Canary
pnpm canary:webhook:setup
```

`pnpm canary:webhook:setup` is expected to be rerunnable. It should converge on
one correct subscription for the responder URL instead of creating duplicates.

Local Dagger remains the authoritative CI contract. Hosted responders should set
`LINEJAM_SMOKE_RUNNER=playwright` and use the committed
`Dockerfile.responder`/`fly.responder.toml` path so the same remote smoke suite
can run without embedding Dagger in the webhook worker.

### Alert Rules

1. **Alert on new issues** - Email on first occurrence
2. **High frequency spike** - Email when >10 events/hour

## Known Issues

(None currently tracked)
