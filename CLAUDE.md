# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Linejam is a real-time collaborative poetry game. Players take turns adding constrained-length lines (1,2,3,4,5,4,3,2,1 words) to poems they can only partially see—creating absurdist shared poetry.

**Stack**: Next.js 16 (React 19) + Convex backend + Tailwind CSS 4 + Clerk auth (optional) + anonymous guests

**Key Features**: AI players (Gemini), 4 premium themes, poem sharing/export, help modal

## Development Commands

```bash
bash scripts/setup.sh # bootstrap deps, .env.local, and .claims
pnpm dev              # Next.js :3000 + Convex dev (parallel)
pnpm build            # convex deploy + next build
pnpm lint             # eslint
pnpm lint:fix         # eslint --fix
pnpm format           # prettier --write
pnpm typecheck        # app + Dagger TypeScript checks
pnpm test             # vitest run
pnpm test:watch       # vitest watch
pnpm test:ci          # vitest run --coverage
pnpm test:ui          # vitest interactive UI
```

For a non-destructive env bootstrap without installing dependencies:

```bash
bash scripts/setup.sh --write-env --skip-install
```

This creates `.env.local` from `.env.example` only when `.env.local` does not
already exist, and it prepares `.claims/` for local backlog coordination.

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

### Never Let the Room Die (presence + self-heal)

A room must always reach `COMPLETED`, even if every human closes their tab.
Three layers, all sharing the idempotent `commitAssignedLine` (so they are safe
to overlap):

- **Presence**: `convex/presence.ts` heartbeat stamps `roomPlayers.lastSeenAt`;
  `isPresenceStale()` in `convex/lib/gameRules.ts` is the single staleness
  predicate behind every "away" indicator and the sweep.
- **Per-turn floor**: `game.fillStaleHumanTurns` is scheduled via `runAfter` at
  every round open (`AUTO_GHOST_FILL_MS`); it ghost-fills any human poem still
  missing its line, bylined `"<name> (ghost)"`.
- **Abandonment cron**: `convex/crons.ts` → `abandonment.sweepAbandonedGames`
  (every minute) finds `IN_PROGRESS` games (the `games.by_status` index) idle
  past `ABANDONMENT_THRESHOLD_MS` with all humans stale, and schedules
  `finishAbandonedGame` to deterministically complete them. It re-derives state
  each tick, so it heals games the per-turn chain missed. Completion never
  requires a host action.
- **Host migration** (backlog 017): the room never reaching `COMPLETED` is the
  floor; host _agency_ is the next layer. When the host goes stale past
  `HOST_MIGRATION_STALE_MS` but the game continues, a present participant's
  heartbeat (`convex/presence.ts`) calls `migrateHostIfStale` (`convex/lib/room.ts`)
  to promote the lowest-seat present human (`selectNextHostId`) to
  `rooms.hostUserId`, so host-only actions (`summonGhostwriter`, `closeRoom`,
  mode select) are never stranded. Idempotent; never demotes a present host; a
  never-heartbeat host is "present-unknown", not migrated.

Testing this needs the real scheduler/DB: use convex-test via
`setupConvexTest()` (`tests/helpers/convexTest.ts`), not the mock DB. See
`tests/convex/abandonment.test.ts` and `tests/convex/hostMigration.test.ts`.

## Quality Gates

Lefthook pre-commit: `gitleaks`, `eslint --fix`, `prettier --write`
Lefthook pre-push: `pnpm ci:prepush` (fast, Docker-free: `typecheck` + `lint` + `test`). The full contract — build + authenticated browser E2E + osv — is the hosted `merge-gate` (`.github/workflows/ci.yml`), decomposed across parallel runners. Run `pnpm ci:dagger:all` on demand for full local fidelity.
Commit messages: Conventional Commits (commitlint)

Before starting a ready item from `backlog.d/`, claim it locally:

```bash
source scripts/lib/claims.sh
claim_acquire <backlog-id>
claim_release <backlog-id>
```

Release the claim when the item is done or abandoned. Claims are local
coordination artifacts, not product state.

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

The hosted GitHub `merge-gate` (`.github/workflows/ci.yml`) is the authoritative
engineering contract: it runs the full suite — format/lint/typecheck/secret/audit,
unit + build, and the authenticated browser E2E — decomposed across parallel
runners and enforced by branch protection. `pnpm ci:dagger:all` runs that same
contract locally on demand (one monolithic Dagger engine, so it wants ample Docker
memory); it auto-syncs the active Convex dev deployment before auth-heavy E2E and
hydrates `GUEST_TOKEN_SECRET` from the matching deployment automatically, and
refuses to push Convex production code unless `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1` is
set explicitly. Use it before opening a PR when you want full local fidelity;
pre-push deliberately runs only the fast Docker-free subset.

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

The hosted `merge-gate` is the authoritative CI contract (`pnpm ci:dagger:all`
mirrors it locally on demand). Hosted responders should set
`LINEJAM_SMOKE_RUNNER=playwright` and use the committed
`Dockerfile.responder`/`fly.responder.toml` path so the same remote smoke suite
can run without embedding Dagger in the webhook worker.

### Alert Rules

1. **Alert on new issues** - Email on first occurrence
2. **High frequency spike** - Email when >10 events/hour

## Known Issues

(None currently tracked)
