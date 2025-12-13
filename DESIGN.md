# Design: Extract `checkParticipation` helper

## Architecture Overview

**Selected Approach**: `convex/lib/auth.ts` exports `checkParticipation(ctx, roomId, userId): Promise<boolean>`

**Rationale**: keep poems access policy in 1 place, w/ smallest new surface. `convex/lib/auth.ts` already owns “who is this user?”; extend to “can this user see this room’s data?”.

**Core Modules**

- `convex/poems.ts` — poem read queries; stays domain-y, no auth query internals
- `convex/lib/auth.ts` — identity + room participation check (deep module)
- `convex/schema.ts` — `roomPlayers` + index `by_room_user` (data contract)

**Data Flow**
Client `useQuery(api.poems.*)` → `getUser(ctx, guestToken)` → `checkParticipation(ctx, roomId, userId)` → DB query (`poems`, `lines`) → return DTO

**Key Decisions**

1. `checkParticipation` returns boolean, no throw — callers keep current “return [] / null” semantics
2. Use `roomPlayers` index `by_room_user` — perf stable, matches existing schema

## Module: `convex/lib/auth`

Responsibility: hide “who are you?” and “may you access this room?” behind tiny APIs.

Public Interface:

```ts
import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';

export async function getUser(
  ctx: QueryCtx | MutationCtx,
  guestToken?: string
): Promise<Doc<'users'> | null>;

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  guestToken?: string
): Promise<Doc<'users'>>;

export async function checkParticipation(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<'rooms'>,
  userId: Id<'users'>
): Promise<boolean>;
```

Internal Implementation

- `getUser`: Clerk identity → `users.by_clerk`, else guest token → `users.by_guest`
- `checkParticipation`: `roomPlayers.by_room_user(roomId, userId)` → truthy/falsey

Dependencies

- Reads: `users`, `roomPlayers`
- Used by: `convex/poems.ts` (now); future: other room-gated queries/mutations

Data Structures

- `roomPlayers` row is the “membership” fact; no extra policy layer yet

Error Handling

- `checkParticipation`: never throws (DB errors bubble like today)
- `requireUser`: throws `Error('Unauthorized: User not found')` (existing)

## Module: `convex/poems`

Responsibility: fetch poem lists + details, gated by room participation.

Changes

- Replace 2 inline `roomPlayers.by_room_user` lookups w/ `checkParticipation(...)`.

Acceptance

- `convex/poems.ts` has 0 direct `roomPlayers.by_room_user` lookups (use helper)

## Core Algorithms (Pseudocode)

### checkParticipation(ctx, roomId, userId)

1. `player = db.query('roomPlayers').withIndex('by_room_user', q => q.eq('roomId', roomId).eq('userId', userId)).first()`
2. return `player != null`

### getPoemsForRoom(roomCode, guestToken)

1. `user = getUser(ctx, guestToken)`; if null → `[]`
2. `room = rooms.by_code(roomCode.toUpperCase()).first()`; if null → `[]`
3. if `!checkParticipation(ctx, room._id, user._id)` → `[]`
4. load poems: if `room.currentGameId` → `poems.by_game(room.currentGameId)` else `poems.by_room(room._id)`
5. fetch preview first line per poem (`lines.by_poem_index(poemId, 0)`)
6. return poems + `{preview: firstLine ?? '...'}`.

### getPoemDetail(poemId, guestToken)

1. `user = getUser(ctx, guestToken)`; if null → `null`
2. `poem = db.get(poemId)`; if null → `null`
3. if `!checkParticipation(ctx, poem.roomId, user._id)` → `null`
4. `lines = lines.by_poem(poemId).collect()`; sort by `indexInPoem`
5. batch fetch authors; map `authorUserId -> displayName || 'Unknown'`
6. return `{ poem, lines: linesWithAuthors }`

## File Organization

Edits:

- `convex/lib/auth.ts` — add `checkParticipation` export
- `convex/poems.ts` — import + use `checkParticipation`, delete duplicate query blocks

Tests (to keep CI green)

- `tests/convex/lib/auth.test.ts` — add unit coverage for `checkParticipation`
- `tests/convex/poems.test.ts` — mock `checkParticipation` in `vi.mock('../../convex/lib/auth', ...)` (current mock only exports `getUser`)

## Integration Points

- No schema change; relies on `convex/schema.ts` index: `roomPlayers.by_room_user`
- No new env vars
- No deploy changes (still `pnpm build:check` → `npx convex deploy` + `next build`)

## State Management

Server-side only; no new persisted state. Query behavior unchanged.

## Error Handling Strategy

- Authn missing (`getUser` null): poems queries return `[]` / `null` (existing behavior)
- Authz fail (`checkParticipation` false): same return values (no new error strings)

## Testing Strategy

- Unit: `checkParticipation` returns `true/false`, asserts `withIndex('by_room_user', ...)` called once
- Regression: poems tests keep their current cases, but drive membership via mocked helper

Patch coverage targets (new code)

- `convex/lib/auth.ts`: 90%+ branches (true/false path)

## Performance & Security Notes

- Perf: single indexed lookup per gated handler; net query count same, code simpler
- Security: single source of truth for membership check reduces drift risk
- Logging/PII: `checkParticipation` does not log; avoids leaking room/user ids in logs by default

## Alternative Architectures Considered

| Option | Summary                               | Simplicity (40) | Depth (30) | Explicit (20) | Robust (10) | Verdict                            |
| ------ | ------------------------------------- | --------------: | ---------: | ------------: | ----------: | ---------------------------------- |
| A      | Leave duplication in `poems.ts`       |              10 |          0 |             5 |           2 | reject: drift risk                 |
| B      | Local helper inside `poems.ts` only   |              25 |         10 |            10 |           4 | ok, but no reuse                   |
| C      | Shared helper in `convex/lib/auth.ts` |              35 |         22 |            16 |           7 | **chosen**                         |
| D      | New `convex/lib/participation.ts`     |              28 |         24 |            16 |           7 | good, extra file + naming bikeshed |
| E      | Full “policy” module w/ typed errors  |              10 |         28 |            18 |           8 | overkill for 2 call sites          |

## Open Questions / Assumptions

- Scope: only `convex/poems.ts` de-dup (TASK acceptance); follow-up can adopt helper in `convex/rooms.ts` + `convex/game.ts`.
- Naming: `auth.ts` becomes “authn + room authz”; acceptable now, revisit if it grows (option D).

## Validation Pass (Checklist)

- Deep module: callers know “participation?”, not query/index shape
- No pass-through wrappers added beyond 1 function
- Tests updated for new export + mock shape
- No behavior change: same `[]/null` returns on authn/authz fail
