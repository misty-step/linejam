# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Linejam is a real-time collaborative poetry game. Players take turns adding constrained-length lines (1,2,3,4,5,4,3,2,1 words) to poems they can only partially see—creating absurdist shared poetry.

**Stack**: Next.js 16 (React 19) + Convex backend + Tailwind CSS 4 + Clerk auth (optional) + anonymous guests

## Development Commands

```bash
pnpm dev              # Next.js :3000 + Convex dev (parallel)
pnpm build            # convex deploy + next build
pnpm lint             # eslint
pnpm lint:fix         # eslint --fix
pnpm format           # prettier --write
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest watch
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

| Path          | Purpose                                                  |
| ------------- | -------------------------------------------------------- |
| `app/`        | Next.js App Router pages (all 'use client')              |
| `components/` | UI primitives (Button, Card, Input) + game screens       |
| `convex/`     | Backend schema, queries, mutations, auth helpers         |
| `lib/`        | Shared utilities: auth hook, logger, word counting, cn() |
| `tests/`      | Vitest unit tests                                        |

## Design System

Kenya Hara minimalism—Zen garden aesthetic.

- **Accent**: Vermillion `oklch(0.55 0.22 25)` (calligrapher's seal)
- **Typography**: Cormorant Garamond (display) + Inter (body)
- **Colors**: Warm white background, near-black text
- **Tokens**: CSS custom properties in `globals.css`

Use `cn()` helper (clsx + tailwind-merge) for className composition.

## Convex Schema

Key indexes for common queries:

- `rooms.by_code` - room lookup
- `poems.by_room` - poems in room
- `lines.by_poem` - lines in poem order
- `favorites.by_user` - user's favorites

All mutations validate args with `v` schema validators.

## Quality Gates

Lefthook pre-commit: `eslint --fix`, `prettier --write`, `typecheck`
Lefthook pre-push: `test:ci`, `build`
Commit messages: Conventional Commits (commitlint)

## Testing

Vitest with happy-dom. Coverage threshold: 60%.

```bash
pnpm test:watch       # Development
pnpm test:ci          # CI with coverage
```

## Environment Variables

```bash
CONVEX_DEPLOYMENT, NEXT_PUBLIC_CONVEX_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN
```

## Known Issues

1. **Logger unused**: Pino configured (lib/logger.ts) but all errors use console.error
2. **Sentry not capturing**: Error tracking configured but never called in catch blocks
3. **N+1 in getMyPoems**: Loops through lines and fetches each poem separately
