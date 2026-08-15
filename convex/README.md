# convex/

Convex backend: serverless functions, schema, and business logic.

## Entry Points

| File             | Purpose                                          |
| ---------------- | ------------------------------------------------ |
| `schema.ts`      | Data model (tables, indexes)                     |
| `game.ts`        | Human game lifecycle: start, submit, reveal      |
| `abandonment.ts` | Close partial games without inventing poem lines |
| `rooms.ts`       | Room CRUD, player join/leave                     |
| `users.ts`       | User creation, lookup                            |
| `poems.ts`       | Poem queries for archive/sharing                 |
| `favorites.ts`   | User favorites                                   |
| `shares.ts`      | Share analytics                                  |

## lib/ (Internal Helpers)

Deep modules - use via parent exports, not directly.

| Module                 | Interface                              |
| ---------------------- | -------------------------------------- |
| `auth.ts`              | `getUser()`, `requireUser()`           |
| `room.ts`              | `getRoomByCode()`, `getActiveGame()`   |
| `assignmentMatrix.ts`  | `generateAssignmentMatrix()`           |
| `assignPoemReaders.ts` | Deterministic one-seat reader rotation |
| `wordCount.ts`         | Server-side word counting              |
| `guestToken.ts`        | Token signing/verification             |
| `rateLimit.ts`         | Per-key rate limiting                  |

## Game State Machine

```
LOBBY -> IN_PROGRESS (9 rounds) -> COMPLETED (reveal-ready)
                            \----> ABANDONED (never revealed)
```

Every completed poem contains exactly nine human-authored lines. The assignment
matrix ensures no player writes consecutive lines on the same poem.

## Error Convention

Player-facing functions throw `ConvexError` (from `convex/values`), never
plain `Error`: Convex redacts plain `Error` messages in production, which
silently breaks the friendly-message mappings in `lib/errorFeedback.ts`.
An eslint `no-restricted-syntax` gate (see `eslint.config.mjs`) enforces
this for `convex/*.ts` and the player-path lib modules. Internal guest-token
invariants may keep plain `Error`; there, production redaction is a feature.
