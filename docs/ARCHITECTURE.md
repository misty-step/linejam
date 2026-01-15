# Architecture

Linejam is a real-time collaborative poetry game. This doc explains how the pieces fit together.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────────┐  │
│  │  App Router   │  │  Components   │  │   Hooks/Context     │  │
│  │  (pages)      │──│  (game UI)    │──│  (theme, auth, RT)  │  │
│  └───────────────┘  └───────────────┘  └─────────────────────┘  │
│           │                                       │              │
│           ▼                                       ▼              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Convex React Hooks                       │ │
│  │          useQuery() / useMutation() / useAction()           │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │ WebSocket (real-time sync)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       CONVEX BACKEND                            │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────────┐  │
│  │   Queries     │  │  Mutations    │  │     Actions         │  │
│  │  (read-only)  │  │  (write)      │  │   (side-effects)    │  │
│  └───────────────┘  └───────────────┘  └─────────────────────┘  │
│           │                 │                    │               │
│           ▼                 ▼                    ▼               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Convex Database                          │ │
│  │   rooms → games → poems → lines | users | roomPlayers       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                  │               │
│                                                  ▼               │
│                                     ┌─────────────────────────┐ │
│                                     │   OpenRouter (Gemini)   │ │
│                                     │   for AI player lines   │ │
│                                     └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Domains (5 modules)

### 1. Game Engine (`convex/game.ts`, `convex/lib/`)

**Owns**: Game lifecycle, round progression, line submission, word count validation.

The core logic: 9 rounds with word counts [1,2,3,4,5,4,3,2,1]. Each player writes one line per round, assigned to a poem they haven't contributed to consecutively.

**Key invariant**: The assignment matrix ensures no player writes two consecutive lines on the same poem. See `assignmentMatrix.ts` for the derangement-like algorithm.

**State machine**:

```
LOBBY → (host starts) → IN_PROGRESS (9 rounds) → COMPLETED (reveal phase)
```

### 2. Rooms & Players (`convex/rooms.ts`, `convex/users.ts`)

**Owns**: Room creation (4-letter codes), player joining, host privileges.

Players can be:

- Authenticated (Clerk) - persistent identity
- Guests (signed JWT token) - ephemeral but verified
- AI players - automated via LLM

### 3. Auth (`lib/auth.ts`, `convex/lib/auth.ts`)

**Owns**: Identity resolution, guest token signing/verification.

Hybrid auth pattern:

1. Try Clerk authentication first
2. Fall back to guest token (signed JWT stored in localStorage)
3. Token secret must match in Vercel + Convex environments

### 4. AI Players (`convex/ai.ts`, `convex/lib/ai/`)

**Owns**: AI player lifecycle, LLM integration, persona management.

AI players join games like humans but generate lines via OpenRouter/Gemini. Each AI has a distinct persona (stored in `personas.ts`) affecting writing style.

**Flow**: Round advances → scheduler triggers AI turn → LLM generates line → mutation submits.

### 5. UI Layer (`app/`, `components/`, `lib/themes/`)

**Owns**: Rendering, theme switching, user interactions.

All pages are `'use client'` (React Server Components not used). Convex hooks handle data fetching and real-time sync.

Four themes: kenya (default), mono, vintage-paper, hyper. Theme context applies CSS variables globally.

## Data Flow

### Starting a Game

```
Host clicks "Start"
    → startGame mutation
    → shuffles players (secure random)
    → generates assignment matrix (N players × 9 rounds)
    → creates N poem records
    → room.status = IN_PROGRESS
    → all clients receive update via subscription
```

### Writing a Line

```
Player submits line
    → submitLine mutation
    → validates word count matches round requirement
    → creates line record with authorDisplayName (pen name)
    → checks if round complete (all players submitted)
    → if yes: advances round (or completes game)
    → triggers AI players via scheduler if applicable
    → clients see update immediately via useQuery subscription
```

### Real-Time Sync

Convex `useQuery` hooks create WebSocket subscriptions. No polling. All clients sharing a room see changes within milliseconds.

## Database Schema

```
users ─────┐
           │
roomPlayers ──── rooms ──── games
                   │          │
                   └──── poems ──── lines
                            │
                        favorites
                            │
                         shares
```

**Indexes** optimize common access patterns:

- `rooms.by_code` - room lookup by 4-letter code
- `lines.by_poem` - all lines for a poem in order
- `poems.by_room_game_index` - specific poem in specific game

## Where to Start Reading

| Goal                     | Start here                           |
| ------------------------ | ------------------------------------ |
| Understand game rules    | `convex/game.ts:WORD_COUNTS`         |
| Trace a line submission  | `convex/game.ts:submitLine`          |
| See assignment algorithm | `convex/lib/assignmentMatrix.ts`     |
| Understand auth flow     | `lib/auth.ts` → `convex/lib/auth.ts` |
| Add new theme            | `lib/themes/` (copy existing)        |
| Debug AI player          | `convex/ai.ts:generateAiTurn`        |

## Shallow Modules (Complexity Exposed)

These areas have less encapsulation:

1. **Guest token flow** - Split across `lib/guestToken.ts`, `lib/guestSession.ts`, `convex/lib/guestToken.ts`, `app/api/guest/session/route.ts`. Requires understanding all four.

2. **Theme application** - CSS variables in `globals.css`, theme definitions in `lib/themes/`, context in multiple files. Works but scattered.

## Deep Modules (Simple Interface, Rich Behavior)

1. **`convex/game.ts`** - Clean mutations (`startGame`, `submitLine`) hide complex matrix assignment and round progression.

2. **Convex `useQuery` hooks** - Simple call, automatic real-time sync across all clients.

3. **`assignmentMatrix.ts`** - One function (`generateAssignmentMatrix`) encapsulates derangement logic.
