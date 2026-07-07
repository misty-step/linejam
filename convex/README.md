# convex/

Convex backend: serverless functions, schema, and business logic.

## Entry Points

| File           | Purpose                                     |
| -------------- | ------------------------------------------- |
| `schema.ts`    | Data model (tables, indexes)                |
| `game.ts`      | Game lifecycle: start, submit lines, reveal |
| `rooms.ts`     | Room CRUD, player join/leave                |
| `ai.ts`        | AI player management                        |
| `users.ts`     | User creation, lookup                       |
| `poems.ts`     | Poem queries for archive/sharing            |
| `favorites.ts` | User favorites                              |
| `shares.ts`    | Share analytics                             |

## lib/ (Internal Helpers)

Deep modules - use via parent exports, not directly.

| Module                 | Interface                            |
| ---------------------- | ------------------------------------ |
| `auth.ts`              | `getUser()`, `requireUser()`         |
| `room.ts`              | `getRoomByCode()`, `getActiveGame()` |
| `assignmentMatrix.ts`  | `generateAssignmentMatrix()`         |
| `assignPoemReaders.ts` | Reader derangement algorithm         |
| `wordCount.ts`         | Server-side word counting            |
| `guestToken.ts`        | Token signing/verification           |
| `rateLimit.ts`         | Per-key rate limiting                |

## lib/ai/ (LLM Integration)

Facade pattern via `llm.ts`:

```typescript
import { generateLine, getFallbackLine } from './lib/ai/llm';
```

Internals: OpenRouter provider, personas, word count guards.

## Game State Machine

```
LOBBY -> IN_PROGRESS (9 rounds) -> COMPLETED
```

Assignment matrix ensures no player writes consecutive lines on same poem.

## Error Convention

Player-facing functions throw `ConvexError` (from `convex/values`), never
plain `Error`: Convex redacts plain `Error` messages in production, which
silently breaks the friendly-message mappings in `lib/errorFeedback.ts`.
An eslint `no-restricted-syntax` gate (see `eslint.config.mjs`) enforces
this for `convex/*.ts` and the player-path lib modules. Internal invariants
(guest token internals, canary, AI providers) may keep plain `Error` —
there, prod redaction is a feature.
