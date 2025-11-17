# Linejam v1 – Product, Design & Architecture Spec

---

## 0. Document Meta

* **Project:** Linejam
* **Version:** v1
* **Owner:** (you)
* **Last updated:** (fill in when you start)

---

## 1. Product Overview

### 1.1 Elevator Pitch

**Linejam** is a real‑time, in‑person party game where a group of friends collaboratively writes short, constrained poems.

* Everyone joins a lobby on their phone with a room code.
* The game creates **one poem per player**.
* Over **9 rounds**, each player writes exactly **one line per round**, with an exact word count constraint that forms a “pyramid” of words.
* Writers only see the **previous line** for the poem they’re continuing.
* When all 9 rounds are done, the group reveals the finished poems together.

The result is chaotic, funny, occasionally profound, and very replayable.

### 1.2 Vision

* Make collaborative, constrained writing as approachable as “party trivia” or “drawing” games.
* Keep all friction low: **join a game → write → laugh at the reveal**.
* Long‑term, support multiple poetic game variants and AI enhancements, but **v1 is just Linejam**: the 9-line pyramid party game.

### 1.3 v1 Goals

* Deliver a **polished, stable, beautiful** in‑room multiplayer experience.
* Implement the **core game loop** end‑to‑end:

  * Lobby creation & join via code.
  * 9‑round writing flow with exact word counts.
  * Fair / randomized line assignment.
  * Delightful reveal and poem storage.
* Support **guest + optional authenticated users**.
* Allow:

  * Viewing past games and poems.
  * Favoriting poems.
  * (For authenticated users) starting to build friend graph via “people I played with”.

### 1.4 Non‑Goals (v1)

Explicitly out of scope:

* AI co‑authors, AI titles, or any AI features.
* Async / turn‑based games not based on lobbies.
* Playing with strangers (no public matchmaking).
* Public discovery feed, daily prompts, collections.
* Monetization (no cosmetics, no premium).
* Heavy content filtering / moderation beyond minimal hygiene.
* Multiple game modes; v1 is **only** the 9‑line pyramid mode.

---

## 2. Game Design

### 2.1 Core Game Mechanics

**Poem structure:**

* Each game has **P poems**, where **P = number of players**.
* Each poem has **9 lines**.
* Line word counts (index 0–8):

| Line index | Line # | Words |
| ---------- | ------ | ----- |
| 0          | 1      | 1     |
| 1          | 2      | 2     |
| 2          | 3      | 3     |
| 3          | 4      | 4     |
| 4          | 5      | 5     |
| 5          | 6      | 4     |
| 6          | 7      | 3     |
| 7          | 8      | 2     |
| 8          | 9      | 1     |

**Word count rule:**

* A line must have **exactly** the target number of words.
* Definition of “word”:

  * Trim leading/trailing whitespace.
  * Split on any whitespace (`/\s+/`).
  * Filter out empty tokens.
  * Count resulting tokens.
  * Punctuation does not split words:

    * `"hello,"` → 1 word.
    * `"hi there!"` → 2 words.
    * `"🤖 hi"` → 2 words.

**Visibility:**

* When writing a line:

  * The player sees **only the previous line** for that poem.
  * For line 1 (index 0), there is no previous line; show a “start the poem” hint.
* No one sees the full poem until the reveal phase.

### 2.2 Room & Lobby

* **Host**:

  * Creates a room and gets a **room code**.
  * Receives a “Host view” of lobby.
* **Players**:

  * Join by entering room code and a display name.
* **Lobby behavior**:

  * Displays list of joined players with display names.
  * Host can:

    * Kick players (basic moderation).
    * Start game when ready.
  * No timers or auto‑start logic.
  * Assume players are physically co‑located and coordinating verbally.

Constraints:

* Minimum players: 2.
* Maximum players: v1 suggestion: 8 (configurable, but 8 is a good initial cap).

### 2.3 Line Assignment / Rotation

Goals:

* Each round:

  * Every player writes **exactly one line**.
  * Every poem receives **exactly one line**.
* No player writes **two consecutive lines on the same poem**.
* Assignments feel randomized from game to game and round to round.
* Across the 9 rounds, players write on a variety of poems, not always the same ones.

#### 2.3.1 Assignment Matrix

* Let players be `U = [u0, u1, ..., u(P-1)]`.
* Let poems be `P = [p0, p1, ..., p(P-1)]`.
* Let rounds be `r = 0..8` (line index).
* Define an **assignment matrix**:

> `A[r][j] = userId` → line for round r, poem j is written by user A[r][j].

Constraints:

* For each fixed r, `A[r]` (row) is a **permutation** of all players:

  * Every player writes once per round.
* For each poem j, and consecutive rounds r>0:

  * `A[r][j] != A[r-1][j]` (no same person twice in a row).

#### 2.3.2 Algorithm (v1)

1. **Round 0 (r = 0)**:

   * Take the list of players `[u0..u(P-1)]`.
   * Shuffle randomly to get permutation `π0`.
   * For each poem index j:

     * `A[0][j] = π0[j]`.

2. **Round r > 0**:

   * Start with a random permutation `πr` of all players.
   * While there exists any poem index j such that `πr[j] == A[r-1][j]`:

     * For each conflicting j:

       * Try to swap `πr[j]` with another index k ≠ j where swap resolves both poem j and poem k conflicts.
     * If few conflicts remain, do small random resampling for problematic positions.
   * Once `πr` has no direct conflicts:

     * Set `A[r][j] = πr[j]` for all j.

This ensures:

* Round‑by‑round randomness.
* No back‑to‑back writes on the same poem.
* Each round uses a full permutation, so all players always have an assignment.

(A more sophisticated balancing by `(player, poem)` pair count can be added later if needed.)

### 2.4 Game Phases

1. **Lobby**

   * Room created, players join, host starts.

2. **Game Init**

   * Freeze player list.
   * Generate `assignmentMatrix`.
   * Create P poems.
   * Set `currentRound = 0`.

3. **Rounds 0–8 (Writing Rounds)**

   * For round r:

     * Server:

       * For each poem j:

         * Find assigned user `u = A[r][j]`.
       * For each user `u`:

         * Identify their poem assignment `(poemId, j)` where `A[r][j] == u`.
         * Load previous line text for poem if r>0.
         * Send assignment to that user.
     * Client:

       * Shows writing UI with:

         * Round number.
         * Word count target.
         * Previous line text.
       * Enforces word count before enabling submit.
     * On submission:

       * Server validates user & assignment, word count, saves line.
   * Round completes when **all players** have submitted.

4. **Reveal**

   * When all `R * P` lines are written:

     * Game status → COMPLETED.
     * Clients get signal to show reveal screen.
   * Reveal:

     * List of poems.
     * Tap poem → see full 9 lines with authors.
   * Players can favorite poems.

5. **Post‑Game**

   * Players may leave the room or return to home.
   * Poems are stored and visible under “My Poems” for players who participated.

---

## 3. UX & UI Design

### 3.1 Design Principles

* **Zero friction** to get into a game.
* **Constraint is playful**, not punitive:

  * Word‑count feedback feels satisfying (like completing a meter).
* **Reveal is the payoff**:

  * Animations and typography are carefully tuned here.
* **Feels analog‑digital**:

  * Paper/card metaphors.
  * Subtle motion.

### 3.2 High-Level Navigation

* **Home**
* **Host Game**
* **Join Game**
* **Room / Game (Lobby + Rounds + Reveal)**
* **My Poems**
* **Poem Detail**
* **Profile**

### 3.3 Key Screens (Functional Description)

#### 3.3.1 Home

* Primary CTAs:

  * **Host a game**
  * **Join a game**
* Secondary:

  * “My poems”
  * “Profile”

Copy and visuals should immediately communicate:

> “Collaborative poetry game for friends in the same room.”

#### 3.3.2 Host Game

* If user has no display name yet:

  * Show modal: “What should we call you?” → save as default.
* On host action:

  * Call backend to create room.
  * On success:

    * Show **room code** in large, centered card (e.g. `J8LK`).
    * Buttons:

      * “Copy code”
      * “Share link” (if you want to share via messaging).

#### 3.3.3 Join Game

* Two inputs:

  * Room code (uppercase only, auto format).
  * Display name (pre‑filled if known).
* Behaviors:

  * “Join” button disabled until both are non-empty.
* Error states:

  * Invalid code.
  * Room full.
  * Game already in progress (v1: show message “This game has already started.”).

#### 3.3.4 Lobby

* Top:

  * Room code as pill.
* Middle:

  * List of player avatars:

    * Display name.
    * Host badge on host.
* Host:

  * “Start game” primary button.
  * Optional small “Remove” button on each player (with confirm).
* Others:

  * Read‑only view of players.
* No timers, ready toggles, or forced countdowns.

#### 3.3.5 Writing Screen

Content:

* **Header**:

  * “Round X of 9”
  * “Line Y – N words”
* **Previous line card**:

  * If r > 0:

    * Title: “Previous line”
    * Card-style display of text.
  * If r = 0:

    * Title: “Start this poem”
    * Soft prompt: “Write the first word.”
* **Input section**:

  * Text area:

    * Placeholder: “Type exactly N words…”
    * Live word counter: “3 / 4 words”.
  * Validation:

    * While count < N:

      * Counter clearly indicates under, e.g. fraction style or partially filled bar.
    * If count > N:

      * Counter turns “warning” color.
      * Short message: “Too many words, need exactly 4.”
      * Submit button disabled.
  * **Submit**:

    * Only enabled when count == N.
    * On click:

      * Small “card flies into stack” animation.
      * Transition to Waiting screen.

#### 3.3.6 Waiting Screen (Between Rounds)

* Title: “Waiting for everyone to finish…”
* Show:

  * List of players with a small status dot (submitted/not).
  * Or aggregated progress: “5 of 7 players done”.
* Minimal; players are physically together, so they can also look around and nudge.

#### 3.3.7 Reveal List View

* After round 9:

  * Full-screen transition to reveal mode:

    * “All poems complete!”
* Show grid/list of poem cards:

  * `Poem 1`, `Poem 2`, etc., or named after initial author.
  * Subtitle: “Written by [names]”.
* Tap to open poem detail.

#### 3.3.8 Poem Detail

* Layout:

  * Title: “Poem #X” (or auto-generated later).
  * Under title: “Game with [names], [date].”
* Lines:

  * Each line in order 1–9.
  * Staggered reveal animation:

    * Lines slide in from below with ~150ms delay.
  * Each line displays:

    * Line text.
    * Author pill: small, e.g. “— Alex”.
* Controls:

  * Heart icon (favorite/unfavorite).
  * “Copy text” button for sharing.
  * Back button.

#### 3.3.9 My Poems

* Sections:

  * “Games I played” (list by date).
  * “Favorites” (list of favorited poems).
* Each entry:

  * Game summary: date, player count, poem count.
  * Tap → list poems from that game.
* Favorited poems grouped or flagged for quick access.

#### 3.3.10 Profile

* Shows:

  * Display name (editable).
  * Auth status (signed in or guest).
* If signed in:

  * Email or auth provider.
* If you include friends v1:

  * List of friends + “Recently played with”.

---

## 4. Functional Requirements

### 4.1 Rooms

* Host can:

  * Create a room.
  * See room code.
  * Start game.
  * Kick players before game starts.
* Room auto‑expires after some inactivity window (e.g. 2 hours after completion).

### 4.2 Players

* Must have a display name (1–24 characters).
* May be:

  * Guest user.
  * Authenticated via Clerk.
* Each user may be in at most one room at a time.

### 4.3 Game Flow

* Host starts game only when:

  * ≥ 2 players present.

* On start:

  * Room transitions from `LOBBY` → `IN_PROGRESS`.
  * Player list frozen for this game session.
  * Assignment matrix generated.
  * Poems created.

* Each round:

  * Every player receives exactly one assignment.
  * Player must submit a line with exact word count.
  * Round ends when all players have submitted.

* Game completion:

  * When all lines for all poems are filled.
  * Room state updated to `COMPLETED`.

### 4.4 Persistence

* For each poem:

  * Store:

    * Room, date, participants.
    * All lines with author.
  * Poems must be retrievable by:

    * Poem ID.
    * Room.
    * User participation.

### 4.5 Favorites

* Any user (guest or authenticated) can favorite a poem.
* Favorites:

  * For guests: stored against guest userId (and survive page reloads but not device changes).
  * For authenticated users: persist across devices.
* UI reflects favorite state in:

  * Poem detail.
  * My Poems list.

### 4.6 Friends (Optional v1.0 or v1.1)

* For authenticated users:

  * From poem detail:

    * Tap on a player name to open mini-profile.
    * “Add friend” button:

      * v1 simplification: auto-add as mutual friend without pending states.
* Friend list visible in Profile.

---

## 5. Non‑Functional Requirements

### 5.1 Performance

* Lobby and game state changes should feel immediate (<300ms practical latency).
* Writing screen transitions should be smooth (no jank on mobile).
* Support at least:

  * 50–100 concurrent rooms.
  * 8 players per room.
  * (Scale later as needed).

### 5.2 Reliability

* If a player reloads their browser in the middle of a game:

  * They should be able to rejoin via room code and be recognized as the same user if possible (guest token or Clerk user).
  * On resume, they see current round and their assignment (if not yet submitted).
* If host disconnects:

  * Game still continues; host is not special after start.

### 5.3 Safety & Content

* v1 target is **friends in same room**, so:

  * No heavy content filters in gameplay.
  * Minimal hygiene (e.g. blacklist obviously illegal/abusive room codes, nothing more).
* Logging:

  * Log server errors and events for debugging.
  * Do not log full line texts in structured logs (privacy); content remains in DB.

---

## 6. Tech Stack & Architecture

### 6.1 Stack

* **Frontend / Backend framework:** Next.js (App Router), TypeScript.
* **UI:** React + (likely Tailwind CSS or similar utility CSS).
* **Auth:** Clerk.
* **Realtime & data:** Convex.
* **Hosting:** Vercel for the Next.js app.
* **CI/CD:** GitHub Actions integrated with Vercel.

### 6.2 Architecture Overview

High-level components:

1. **Next.js App**

   * Serves UI.
   * Integrates Clerk for authentication.
   * Integrates Convex client for data queries/mutations.

2. **Clerk**

   * Manages authentication.
   * Provides `userId` for authenticated users.
   * Guests handled via app-level guest ID (stored in localStorage) that maps to Convex `users` collection.

3. **Convex Backend**

   * Collections:

     * `users`, `rooms`, `roomPlayers`, `games`, `poems`, `lines`, `favorites`, (optional `friends`).
   * Queries:

     * `roomState`, `userGames`, `poemDetail`, etc.
   * Mutations:

     * `createRoom`, `joinRoom`, `startGame`, `submitLine`, `toggleFavorite`, etc.
   * Provides realtime live queries for room and game state.

4. **Vercel**

   * Hosts Next.js front-end.
   * Uses environment vars to connect to Clerk + Convex.

### 6.3 Pages / Routes (Next.js App Router)

* `/` → Home
* `/host` → Host flow (or use a modal from `/`)
* `/join` → Join flow (or use a modal)
* `/room/[code]` → Lobby + in-game view
* `/me/poems` → My Poems
* `/poem/[id]` → Poem detail
* `/me/profile` → Profile

(Exact paths can be tuned, but this is the general shape.)

---

## 7. Data Model (Convex)

*(Types shown conceptually; adapt to Convex schema definitions.)*

### 7.1 Users

```ts
type User = {
  _id: Id<"users">;
  clerkUserId?: string; // if authed
  guestId?: string; // if guest; stored in localStorage client-side
  displayName: string;
  createdAt: number;
};
```

### 7.2 Rooms & RoomPlayers

```ts
type Room = {
  _id: Id<"rooms">;
  code: string; // unique, 4–6 chars
  hostUserId: Id<"users">;
  status: "LOBBY" | "IN_PROGRESS" | "COMPLETED";
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
};

type RoomPlayer = {
  _id: Id<"roomPlayers">;
  roomId: Id<"rooms">;
  userId: Id<"users">;
  displayName: string;
  seatIndex?: number; // 0..P-1, set at game start
  joinedAt: number;
};
```

### 7.3 Game & Assignment

```ts
type Game = {
  _id: Id<"games">;
  roomId: Id<"rooms">;
  status: "IN_PROGRESS" | "COMPLETED";
  currentRound: number; // 0..8
  assignmentMatrix: Id<"users">[][];
  // dimension [9][P], array of userIds per round, per poem index
  createdAt: number;
  completedAt?: number;
};
```

### 7.4 Poems & Lines

```ts
type Poem = {
  _id: Id<"poems">;
  roomId: Id<"rooms">;
  indexInRoom: number; // 0..P-1
  createdAt: number;
  completedAt?: number;
};

type Line = {
  _id: Id<"lines">;
  poemId: Id<"poems">;
  indexInPoem: number; // 0..8
  text: string;
  wordCount: number;
  authorUserId: Id<"users">;
  createdAt: number;
};
```

### 7.5 Favorites

```ts
type Favorite = {
  _id: Id<"favorites">;
  userId: Id<"users">;
  poemId: Id<"poems">;
  createdAt: number;
};
```

### 7.6 Friends (Optional)

```ts
type Friend = {
  _id: Id<"friends">;
  userId: Id<"users">;
  friendUserId: Id<"users">;
  createdAt: number;
};
```

---

## 8. Convex Functions (API Surface)

### 8.1 Utility

* `users.ensureUser()`:

  * Input: Clerk userId (if logged in) and/or guestId, displayName.
  * Output: Convex `user` document.
  * Logic:

    * If Clerk user present:

      * Find or create `User` with `clerkUserId`.
    * Else:

      * Use `guestId` from client; find or create `User`.

### 8.2 Rooms / Lobby

* `rooms.createRoom(displayName: string)`

  * Ensure user.
  * Generate unique room code.
  * Create `Room`, `RoomPlayer` (host).
  * Return room code and initial room state.

* `rooms.joinRoom(code: string, displayName: string)`

  * Ensure user.
  * Lookup room by code; validate not full and not in progress.
  * Create `RoomPlayer` entry.
  * Return room state (players, host, status).

* `rooms.getRoomState(code: string)`

  * Query:

    * Room by code.
    * Players.
    * If game exists, game status & currentRound.

* `rooms.kickPlayer(roomId, targetUserId)`

  * Validate caller is host.
  * Remove target’s `RoomPlayer`.
  * If game has not started, that’s it; if it has started, we may disallow kicks.

* `rooms.startGame(code: string)`

  * Validate:

    * Caller is host.
    * Room status == LOBBY.
    * Player count ≥ 2.
  * Assign seat indices.
  * Create `Game` with `assignmentMatrix`.
  * Create P `Poem` documents.
  * Set room status == IN_PROGRESS and `Game.currentRound = 0`.

### 8.3 Game / Rounds

* `game.getCurrentAssignment(roomCode: string)`

  * Input: roomCode, user context.
  * Return:

    * Current round index.
    * If game in progress:

      * For current user: assigned poemId, lineIndex, targetWordCount, previousLineText.

* `game.submitLine(poemId, lineIndex, text)`

  * Validate:

    * User belongs to room.
    * Game status == IN_PROGRESS.
    * Current round == lineIndex.
    * User is the assigned writer for (poem, line).
    * Line not already written.
    * Word count matches expected.
  * Save `Line`.
  * If all players in room have submitted for this round:

    * If `lineIndex < 8`:

      * Increment `currentRound`.
    * Else:

      * Mark game & room as COMPLETED.
      * Set `Poem.completedAt`.

* `game.getRoundProgress(roomCode)`

  * Returns:

    * Current round.
    * For each player: submitted/not for this round.

### 8.4 Poems & History

* `poems.getPoemsForRoom(roomCode)`

  * Returns all poems with:

    * IDs, indexInRoom, and maybe preview like first line.

* `poems.getPoemDetail(poemId)`

  * Returns:

    * Poem.
    * All lines (sorted).
    * User display names.

* `poems.getPoemsForUser(userId)`

  * Returns:

    * List of poems where user wrote at least one line.
    * Grouped by room/game.

### 8.5 Favorites

* `favorites.toggleFavorite(poemId)`

  * Ensure user.
  * If Favorite exists: delete it.
  * Else: create new Favorite.

* `favorites.getFavoritesForUser(userId)`

  * Returns list of poems favorited.

---

## 9. Word Counting Logic (Detailed)

Utility function (conceptually):

```ts
function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}
```

* Client:

  * Uses this logic for live feedback.
* Server:

  * Reimplements the same logic in Convex mutation.
  * Rejects line with helpful error if wrong word count.

Error example:

* Expected 5 words, got 6:

  * “This line has 6 words, but Line 5 must have exactly 5 words.”

---

## 10. CI/CD & Environments

### 10.1 Environments

* **Local dev**

  * Next.js dev server.
  * Convex dev instance.
  * Clerk dev instance.
* **Staging**

  * Deployed via Vercel preview branch (e.g. `dev`).
  * Separate Convex & Clerk projects.
* **Production**

  * Vercel main branch deploys.
  * Production Convex & Clerk.

### 10.2 GitHub Actions

Workflows:

* `ci.yml` (on PR, on push):

  * Install deps.
  * Run `lint`, `typecheck`, `test`.
* Optionally:

  * Block merging to `main` if build or tests fail.

Vercel integration:

* Auto-deploy previews for PRs.
* Auto-deploy `main` on push.

---

## 11. v1 Launch Checklist

**Core game:**

* [ ] Create/join room flow.
* [ ] Lobby with host & players list.
* [ ] Start game and freeze players.
* [ ] Assignment matrix generation and storage.
* [ ] 9‑round writing flow with exact word count.
* [ ] No back‑to‑back lines on same poem by same player.
* [ ] Reveal all poems.

**Persistence:**

* [ ] Store poems & lines.
* [ ] My Poems view.
* [ ] Poem detail view.

**Identity & favorites:**

* [ ] Guest + Clerk auth integration.
* [ ] Display names for all users.
* [ ] Favorite poems and view favorites.

**UX polish:**

* [ ] Mobile-first design, tested on small screens.
* [ ] Basic animations for:

  * Submitting a line.
  * Reveal of poem lines.
* [ ] Empty states & error messages.

**Operational:**

* [ ] Logging for errors.
* [ ] Simple monitoring (Vercel + Convex dashboards).
* [ ] Backups/snapshots for Convex data (per provider defaults).

---

If you want, next step I can drill into **actual file/folder structure and code-level stubs** (e.g. `app/room/[code]/page.tsx` responsibilities, Convex schema definitions, and exact mutation/query signatures) so you have something that maps 1:1 to implementation.

