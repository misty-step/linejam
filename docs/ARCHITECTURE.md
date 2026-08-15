# Architecture

Linejam is a real-time, human-authored collaborative poetry game. This doc explains how the pieces fit together.

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
└─────────────────────────────────────────────────────────────────┘
```

## Domains (4 modules)

### 1. Game Engine (`convex/game.ts`, `convex/lib/`)

**Owns**: Game lifecycle, round progression, line submission, word count validation.

The core logic is nine rounds with word counts [1,2,3,4,5,4,3,2,1]. Each
attending human writes one line per round, and a round advances only when every
human assignment has been submitted. Completed poems therefore contain exactly
nine human-authored lines.

**State machine**:

```
LOBBY → (host starts) → IN_PROGRESS → COMPLETED (reveal-ready)
                               ↘ ABANDONED (never revealed)
```

### 2. Rooms & Players (`convex/rooms.ts`, `convex/users.ts`)

**Owns**: Room creation (4-letter codes), player joining, host privileges.

Players can be:

- Authenticated (Clerk) - persistent identity
- Guests (signed JWT token) - ephemeral but verified

### 3. Auth (`lib/auth.ts`, `convex/lib/auth.ts`)

**Owns**: Identity resolution, guest token signing/verification.

Hybrid auth pattern:

1. Try Clerk authentication first
2. Fall back to guest token (signed JWT stored in localStorage)
3. Token secret must match in DigitalOcean App Platform + Convex environments

### 4. UI Layer (`app/`, `components/`, `lib/themes/`)

**Owns**: Rendering, theme switching, user interactions.

`app/layout.tsx` is a server component: it reads the middleware nonce and emits the first-paint theme script. Interactive game surfaces are client components, and Convex hooks handle their data fetching and real-time sync.

The theme picker roster is derived from `visibleThemeIds` in `lib/themes/registry.ts`; retired IDs remain in `themeIds` so existing users can keep working themes. Theme context applies CSS variables globally.

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
    → checks if every human assignment for the round is submitted
    → if yes: advances round (or completes game after round 9)
    → clients see update immediately via useQuery subscription
    → returns `{ status: 'committed' | 'already_submitted', text }`
```

### Real-Time Sync

Convex `useQuery` hooks create WebSocket subscriptions. No polling. All clients sharing a room see changes within milliseconds.

### Security headers

`middleware.ts` creates a fresh nonce for ordinary document requests, forwards it as `x-nonce` to `app/layout.tsx`, and sets the resulting Content Security Policy on the response. `lib/contentSecurityPolicy.ts` owns directive construction; only the explicitly scoped release routes retain an `unsafe-inline` script exception.

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

| Goal                     | Start here                            |
| ------------------------ | ------------------------------------- |
| Understand game rules    | `convex/lib/gameRules.ts:WORD_COUNTS` |
| Trace a line submission  | `convex/game.ts:submitLine`           |
| See assignment algorithm | `convex/lib/assignmentMatrix.ts`      |
| Understand auth flow     | `lib/auth.ts` → `convex/lib/auth.ts`  |
| Trace abandonment        | `convex/abandonment.ts`               |
| Add new theme            | `lib/themes/` (copy existing)         |

## Shallow Modules (Complexity Exposed)

These areas have less encapsulation:

1. **Guest token flow** - Split across `lib/guestToken.ts`, `lib/guestSession.ts`, `convex/lib/guestToken.ts`, `app/api/guest/session/route.ts`. Requires understanding all four.

2. **Theme application** - CSS variables in `globals.css`, theme definitions in `lib/themes/`, context in multiple files. Works but scattered.

## Deep Modules (Simple Interface, Rich Behavior)

1. **`convex/game.ts`** - Clean mutations (`startGame`, `submitLine`) hide complex matrix assignment and round progression.

2. **Convex `useQuery` hooks** - Simple call, automatic real-time sync across all clients.

3. **`assignmentMatrix.ts`** - One function (`generateAssignmentMatrix`) encapsulates derangement logic.
