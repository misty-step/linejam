# Architecture

Linejam is a real-time, human-authored collaborative poetry game. This doc explains how the pieces fit together.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────────┐  │
│  │  App Router   │  │  Components   │  │   Hooks/Context     │  │
│  │  (pages)      │──│  (game UI)    │──│ (color mode, auth, RT)│  │
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

### 4. UI Layer (`app/`, `components/`, `lib/design/`, `lib/colorMode/`)

**Owns**: Rendering, the fixed Ink & Anticipation identity, color-mode control, and user interactions.

`app/layout.tsx` is a server component: it reads the middleware nonce and emits the first-paint color-mode script. Interactive game surfaces are client components, and Convex hooks handle their data fetching and real-time sync.

`lib/design/tokens.ts` is the source of truth for the identity's token sets. `lib/colorMode/` exposes `ColorModeProvider`, `useColorMode`, `applyColorMode`, `getAppliedColorMode`, and the `linejam-theme-mode` storage key. `ColorModeControl` offers the only appearance choice: Light, Dark, or System; System follows `prefers-color-scheme`. There is no theme registry, picker roster, theme ID, or retained-theme compatibility state.

#### Fixed identity palette

| Effective mode | Action    | Focus     | Background | Surface   | Ink       |
| -------------- | --------- | --------- | ---------- | --------- | --------- |
| Light          | `#b43a12` | `#e85d2b` | `#faf9f7`  | `#ffffff` | `#1c1917` |
| Dark           | `#f06b3b` | `#e85d2b` | `#1c1917`  | `#292524` | `#faf9f7` |

Typography is fixed as Libre Baskerville for display, IBM Plex Sans for body/UI, and JetBrains Mono for counts and technical labels.

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

| Goal                       | Start here                            |
| -------------------------- | ------------------------------------- |
| Understand game rules      | `convex/lib/gameRules.ts:WORD_COUNTS` |
| Trace a line submission    | `convex/game.ts:submitLine`           |
| See assignment algorithm   | `convex/lib/assignmentMatrix.ts`      |
| Understand auth flow       | `lib/auth.ts` → `convex/lib/auth.ts`  |
| Trace abandonment          | `convex/abandonment.ts`               |
| Change identity tokens     | `lib/design/tokens.ts`                |
| Change color-mode behavior | `lib/colorMode/`                      |

## Shallow Modules (Complexity Exposed)

These areas have less encapsulation:

1. **Guest token flow** - Split across `lib/guestToken.ts`, `lib/guestSession.ts`, `convex/lib/guestToken.ts`, `app/api/guest/session/route.ts`. Requires understanding all four.

## Deep Modules (Simple Interface, Rich Behavior)

1. **`convex/game.ts`** - Clean mutations (`startGame`, `submitLine`) hide complex matrix assignment and round progression.

2. **Convex `useQuery` hooks** - Simple call, automatic real-time sync across all clients.

3. **`assignmentMatrix.ts`** - One function (`generateAssignmentMatrix`) encapsulates derangement logic.
4. **Color mode application** - `lib/design/tokens.ts` owns the fixed identity's tokens; `lib/colorMode/` applies the effective Light or Dark set and persists the Light/Dark/System preference. `components/ColorModeControl.tsx` is the mode-only control.
