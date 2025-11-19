# TODO: Linejam v1

## Context

- **Architecture**: Next.js (App Router) + TypeScript + Convex + Clerk + Tailwind
- **Game Flow**: 9-round collaborative poetry with exact word counts (pyramid: 1,2,3,4,5,4,3,2,1)
- **Multiplayer**: Real-time via Convex, 2-8 players per room
- **Key Patterns**: Module-first decomposition, deep modules with simple interfaces
- **Reference**: TASK.md sections 1-11

## Infrastructure Tasks

**Project Initialization**:

- [x] Initialize Next.js project with TypeScript and App Router
  ```
  Files: package.json (new), tsconfig.json (new), next.config.ts (new)
  Architecture: Next.js 15+ with App Router, TypeScript strict mode
  Approach: pnpm create next-app with TypeScript, App Router, Tailwind
  Success: pnpm dev runs, TypeScript compiles, App Router working
  Test: Navigate to localhost:3000, see Next.js welcome page
  Dependencies: None (first task)
  Time: 15min
  ```

**Quality Gates**:

- [x] Configure Lefthook for pre-commit/pre-push hooks
  ```
  Files: lefthook.yml (new), .github/workflows/ci.yml (new)
  Architecture: Pre-commit: lint+format, Pre-push: typecheck+test
  Approach: Follow toolchain-preferences skill (ESLint, Prettier, Vitest)
  Success: Hooks prevent bad commits, CI runs on PRs
  Test: Commit with lint error → blocked, push with failing test → blocked
  Dependencies: Project initialization complete
  Time: 30min
  ```

**Design System**:

- [x] Setup Tailwind 4 with @theme directive and design tokens
  ```
  Files: app/globals.css (new), components/ui/* (new)
  Architecture: Design tokens via @theme, OKLCH colors, typography scales
  Approach: Define color palette (playful, analog-digital feel), spacing scale, font system
  Pseudocode:
    @theme {
      --color-primary: oklch(60% 0.15 280);  /* poetic purple */
      --color-accent: oklch(70% 0.12 45);    /* warm gold */
      --font-display: 'Space Grotesk', sans;
      --font-body: 'Inter', sans;
    }
  Success: Design tokens available, color system defined, typography working
  Test: Use --color-primary in component → resolves correctly
  Dependencies: Project initialization
  Time: 45min
  ```

**Structured Logging**:

- [x] Setup Pino logger with correlation IDs and redaction
  ```
  Files: lib/logger.ts (new)
  Architecture: Centralized logger, JSON output, sensitive data redaction
  Approach: Pino instance with requestId child loggers, redact displayName/text in prod
  Pseudocode:
    export const logger = pino({
      redact: ['req.headers.authorization', 'displayName'],
      base: { env: process.env.NODE_ENV }
    })
  Success: Logger available, sensitive data redacted, correlation IDs working
  Test: log.info({ displayName: 'test' }) → field redacted in output
  Dependencies: None
  Time: 30min
  ```

**Error Tracking**:

- [x] Configure Sentry with source maps and release tracking

  ```
  Files: lib/sentry.ts (new), instrumentation.ts (new), sentry.*.config.ts (new)
  Architecture: Client+server error capture, source maps, sensitive data scrubbing
  Approach: @sentry/nextjs with beforeSend hooks to scrub text/displayName
  Pseudocode:
    Sentry.init({
      beforeSend(event) {
        if (event.contexts?.poem) delete event.contexts.poem.text
        return event
      }
    })
  Success: Errors sent to Sentry, source maps uploaded, PII scrubbed
  Test: Throw error → appears in Sentry, auth tokens not logged
  Dependencies: None
  Time: 45min
  ```

  ```
  Work Log:
  - Hardened shared Sentry options with DSN guards, release resolution, and environment defaults so we only boot the SDK when configured.
  - Expanded scrubbing logic to cover request data, breadcrumbs, and auth headers plus added Vitest coverage for the beforeSend hook + release derivation.
  - Instrumentation hook now short-circuits when Sentry is disabled to avoid useless imports; next.config already uploads source maps via withSentryConfig.
  ```

**Changelog Automation**:

- [x] Setup Changesets for version management
  ```
  Files: .changeset/config.json (new), .github/workflows/release.yml (new)
  Architecture: Changeset files track changes, bot creates version PRs
  Approach: @changesets/cli with GitHub Action for automated releases
  Success: Changesets create version PRs with combined changelogs
  Test: Add changeset → "Version Packages" PR created automatically
  Dependencies: None
  Time: 30min
  ```

## Core Backend (Convex)

**Convex Setup**:

- [x] Initialize Convex project and define schema
  ```
  Files: convex/schema.ts (new), convex/_generated/* (generated)
  Architecture: Define tables for users, rooms, roomPlayers, games, poems, lines, favorites
  Approach: Follow TASK.md section 7 data model exactly
  Pseudocode:
    defineSchema({
      users: defineTable({
        clerkUserId: v.optional(v.string()),
        guestId: v.optional(v.string()),
        displayName: v.string(),
        createdAt: v.number()
      }).index("by_clerk", ["clerkUserId"])
        .index("by_guest", ["guestId"]),
      rooms: defineTable({...}),
      // ... all tables from TASK.md 7.1-7.6
    })
  Success: Schema compiles, tables exist in Convex dashboard
  Test: npx convex dev → schema pushed, no errors
  Dependencies: Project initialization
  Time: 45min
  ```

**User Management Module**:

- [x] Implement users.ensureUser() mutation

  ```
  Files: convex/users.ts (new)
  Architecture: Single source of truth for user creation/lookup
  Interface: ensureUser(clerkId?, guestId, displayName) → User
  Pseudocode (from TASK.md 8.1):
    if (clerkId) {
      user = await db.query("users").withIndex("by_clerk", q => q.eq("clerkUserId", clerkId)).first()
      if (!user) user = await db.insert("users", { clerkUserId: clerkId, displayName, createdAt: Date.now() })
    } else {
      user = await db.query("users").withIndex("by_guest", q => q.eq("guestId", guestId)).first()
      if (!user) user = await db.insert("users", { guestId, displayName, createdAt: Date.now() })
    }
    return user
  Success: Creates or finds users correctly for both auth types
  Test: Call with clerkId twice → same user, call with new guestId → new user
  Dependencies: Convex schema
  Time: 30min
  ```

  ```
  Work Log:
  - Added lightweight convex/_generated scaffolding for typed Convex helpers.
  - Normalized displayName server-side to block blank or whitespace-only names.
  ```

**Room Management Module**:

- [x] Implement room creation and joining (rooms.ts)
  ```
  Files: convex/rooms.ts (new)
  Architecture: Room lifecycle (create, join, kick, start)
  Interface: createRoom(displayName) → { code, roomId }
            joinRoom(code, displayName) → RoomState
            kickPlayer(roomId, targetUserId) → void
  Pseudocode (TASK.md 8.2):
    createRoom:
      - user = ensureUser(...)
      - code = generateCode() // 4 uppercase letters, unique
      - room = insert({ code, hostUserId: user._id, status: "LOBBY", createdAt: now })
      - insert roomPlayers({ roomId, userId, displayName, joinedAt: now })
      - return { code, roomId }
    joinRoom:
      - validate room exists, status == LOBBY, <8 players
      - user = ensureUser(...)
      - insert roomPlayers
      - return room state
  Success: Create room → unique code, join room → player added
  Test: Create room twice → different codes, join full room → error
  Dependencies: User management
  Time: 1h
  ```

**Assignment Matrix Generator**:

- [x] Implement assignment matrix generation algorithm
  ```
  Files: convex/lib/assignmentMatrix.ts (new)
  Architecture: Pure function, no side effects, fully tested
  Interface: generateAssignmentMatrix(userIds: Id<"users">[]) → Id<"users">[][]
  Pseudocode (TASK.md 2.3.2):
    function generateMatrix(users) {
      matrix = []
      // Round 0: random permutation
      matrix[0] = shuffle([...users])
      // Rounds 1-8: ensure no consecutive assignments
      for (r = 1; r < 9; r++) {
        perm = shuffle([...users])
        while (hasConflicts(perm, matrix[r-1])) {
          // Try swaps to resolve conflicts
          for (j where perm[j] == matrix[r-1][j]) {
            k = findSwapTarget(j, perm, matrix[r-1])
            if (k != -1) swap(perm, j, k)
          }
          // Fallback: reshuffle problematic positions
          if (stillHasConflicts()) perm = shuffle([...users])
        }
        matrix[r] = perm
      }
      return matrix
    }
  Success: Matrix has 9 rows, each row is permutation, no consecutive assignments
  Test: Generate with 4 users → verify no user writes consecutive lines on same poem
  Dependencies: None (pure function)
  Time: 1.5h
  ```

**Game Initialization Module**:

- [ ] Implement startGame mutation
  ```
  Files: convex/game.ts (new)
  Architecture: Orchestrates game creation, poem setup, assignment generation
  Interface: startGame(code: string) → void
  Pseudocode (TASK.md 8.2):
    startGame(code):
      - validate caller is host
      - room = get room by code, validate status == LOBBY
      - players = get roomPlayers, validate count >= 2
      - assign seatIndices (0..P-1) to players
      - matrix = generateAssignmentMatrix(players.map(p => p.userId))
      - game = insert({ roomId, status: "IN_PROGRESS", currentRound: 0, assignmentMatrix: matrix })
      - for i in 0..P-1:
          insert poem({ roomId, indexInRoom: i, createdAt: now })
      - update room.status = "IN_PROGRESS"
  Success: Creates game, poems, sets assignment matrix, updates room status
  Test: Start game with 3 players → 3 poems created, matrix 9x3, room IN_PROGRESS
  Dependencies: Room management, assignment matrix
  Time: 1h
  ```

**Round Assignment Module**:

- [ ] Implement getCurrentAssignment query
  ```
  Files: convex/game.ts (modify)
  Architecture: Read-only query, no side effects
  Interface: getCurrentAssignment(roomCode: string) → Assignment | null
  Return: { poemId, lineIndex, targetWordCount, previousLineText? }
  Pseudocode (TASK.md 8.3):
    getCurrentAssignment(code):
      - room = get by code
      - game = get by roomId, validate status == IN_PROGRESS
      - user = getAuthUser()
      - player = get roomPlayer for (room, user)
      - r = game.currentRound
      - find poemIndex j where matrix[r][j] == user._id
      - poem = get poem where indexInRoom == j
      - targetWords = [1,2,3,4,5,4,3,2,1][r]
      - if r > 0:
          prevLine = get line where (poemId == poem._id && indexInPoem == r-1)
          previousText = prevLine.text
      - return { poemId, lineIndex: r, targetWordCount: targetWords, previousLineText }
  Success: Returns correct assignment for current user and round
  Test: User in round 2 → get correct poem, targetWords=3, previousLineText from round 1
  Dependencies: Game initialization
  Time: 45min
  ```

**Line Submission Module**:

- [ ] Implement submitLine mutation with validation
  ```
  Files: convex/game.ts (modify), convex/lib/wordCount.ts (new)
  Architecture: Validates assignment, word count, then saves line and advances round
  Interface: submitLine(poemId, lineIndex, text) → void
  Pseudocode (TASK.md 8.3):
    submitLine(poemId, lineIndex, text):
      - validate user is in room
      - game = get game, validate status == IN_PROGRESS
      - validate currentRound == lineIndex
      - poem = get poem, find poemIndex j
      - validate matrix[lineIndex][j] == user._id
      - existingLine = query line for (poemId, lineIndex)
      - if existingLine throw "Already submitted"
      - wordCount = countWords(text)
      - expected = [1,2,3,4,5,4,3,2,1][lineIndex]
      - if wordCount != expected throw "Expected X words, got Y"
      - insert line({ poemId, indexInPoem: lineIndex, text, wordCount, authorUserId: user._id })
      - allSubmitted = check all players submitted for currentRound
      - if allSubmitted:
          if lineIndex < 8: game.currentRound++
          else: complete game (status COMPLETED, mark poems completed)
  Success: Saves line, advances round when all submit, completes game after round 8
  Test: Submit with wrong word count → error, all submit → round advances
  Dependencies: Round assignment, word count utility
  Time: 1.5h
  ```

**Round Progress Query**:

- [ ] Implement getRoundProgress query
  ```
  Files: convex/game.ts (modify)
  Architecture: Read-only, returns submission status for waiting screen
  Interface: getRoundProgress(roomCode) → { round, players: { name, submitted }[] }
  Pseudocode (TASK.md 8.3):
    getRoundProgress(code):
      - room = get by code
      - game = get by roomId
      - r = game.currentRound
      - players = get all roomPlayers for room
      - for each player:
          find poemIndex j where matrix[r][j] == player.userId
          poem = get poem with indexInRoom == j
          line = query line for (poem._id, r)
          submitted = line != null
      - return { round: r, players: [{displayName, submitted}, ...] }
  Success: Returns accurate submission status for current round
  Test: 2 of 3 players submit → shows 2 submitted, 1 not
  Dependencies: Line submission
  Time: 30min
  ```

**Poem Queries Module**:

- [ ] Implement poem retrieval queries
  ```
  Files: convex/poems.ts (new)
  Architecture: Read-only queries for reveal and history
  Interface: getPoemsForRoom(roomCode) → Poem[]
            getPoemDetail(poemId) → { poem, lines[], authors }
            getPoemsForUser(userId) → Poem[]
  Pseudocode (TASK.md 8.4):
    getPoemsForRoom:
      - room = get by code
      - poems = query all poems for roomId
      - return with first line preview
    getPoemDetail:
      - poem = get by id
      - lines = query all lines for poemId, sort by indexInPoem
      - for each line, get author user for displayName
      - return { poem, lines: [{ text, author, index }] }
    getPoemsForUser:
      - lines = query all lines where authorUserId == userId
      - poemIds = unique poemIds from lines
      - poems = get all poems
      - group by roomId with metadata
  Success: Returns poems with correct line order and author info
  Test: Get poem detail → 9 lines in order, correct authors
  Dependencies: Line submission complete
  Time: 45min
  ```

**Favorites Module**:

- [ ] Implement toggleFavorite mutation and getFavorites query
  ```
  Files: convex/favorites.ts (new)
  Architecture: Simple toggle logic, works for guest + auth users
  Interface: toggleFavorite(poemId) → void
            getFavoritesForUser(userId) → Poem[]
  Pseudocode (TASK.md 8.5):
    toggleFavorite(poemId):
      - user = ensureUser(...)
      - existing = query favorite where (userId, poemId)
      - if existing: delete it
      - else: insert({ userId, poemId, createdAt: now })
    getFavoritesForUser:
      - favorites = query all where userId
      - poems = get all poems for favorite.poemId
      - return poems with metadata
  Success: Toggle creates/deletes favorite, query returns favorited poems
  Test: Toggle twice → back to unfavorited, query shows correct favorites
  Dependencies: Poem queries
  Time: 30min
  ```

## Frontend (Next.js + React)

**Auth Integration**:

- [ ] Setup Clerk with guest mode fallback
  ```
  Files: app/providers.tsx (new), lib/auth.ts (new), middleware.ts (new)
  Architecture: Clerk for auth users, localStorage guestId for guests
  Approach: ClerkProvider wraps app, custom hook for guest ID management
  Pseudocode:
    useUser():
      clerkUser = useClerk()
      [guestId, setGuestId] = useState(localStorage.getItem('guestId'))
      if (!clerkUser && !guestId) {
        newId = crypto.randomUUID()
        localStorage.setItem('guestId', newId)
        setGuestId(newId)
      }
      return { clerkId: clerkUser?.id, guestId, displayName }
  Success: Auth users get clerkId, guests get stable guestId
  Test: Visit as guest → guestId in localStorage, sign in → clerkId available
  Dependencies: Project initialization
  Time: 1h
  ```

**Convex Client Setup**:

- [ ] Configure Convex provider and hooks
  ```
  Files: app/providers.tsx (modify), lib/convex.ts (new)
  Architecture: ConvexProviderWithClerk for automatic auth token forwarding
  Approach: Wrap app with ConvexProviderWithClerk, expose useQuery/useMutation hooks
  Success: Convex queries work, Clerk auth tokens forwarded to Convex
  Test: Use useQuery in component → data loads, auth context available
  Dependencies: Auth integration, Convex setup
  Time: 30min
  ```

**Home Page**:

- [ ] Implement home page with Host/Join CTAs
  ```
  Files: app/page.tsx (modify)
  Architecture: Landing page with clear game pitch and primary CTAs
  Design: Hero with "Collaborative poetry game", large Host/Join buttons
  Approach: Follow design-tokens for colors, analog-digital aesthetic
  Success: Shows hero, CTAs navigate to /host and /join
  Test: Click Host → /host, Click Join → /join
  Dependencies: Design system
  Time: 1h
  ```

**Host Flow**:

- [ ] Implement host game page and lobby
  ```
  Files: app/host/page.tsx (new), components/RoomCode.tsx (new)
  Architecture: Create room, show code, redirect to /room/[code]
  Approach:
    - If no displayName, show inline form
    - Call createRoom mutation
    - Show large room code with copy button
    - Auto-redirect to /room/[code] for lobby
  Success: Creates room, shows code, redirects to lobby
  Test: Host → enter name → see code → redirect to lobby as host
  Dependencies: Room management backend, Convex client
  Time: 1.5h
  ```

**Join Flow**:

- [ ] Implement join game page
  ```
  Files: app/join/page.tsx (new), components/JoinForm.tsx (new)
  Architecture: Form with room code + display name, validation
  Approach:
    - Code input: uppercase auto-format, 4-6 chars
    - Display name input with localStorage default
    - Call joinRoom mutation
    - On success redirect to /room/[code]
    - Handle errors: invalid code, room full, already started
  Success: Join valid room → redirect to lobby
  Test: Invalid code → error, full room → error, valid → lobby
  Dependencies: Room management backend
  Time: 1.5h
  ```

**Lobby Screen**:

- [ ] Implement lobby UI with player list and host controls
  ```
  Files: app/room/[code]/page.tsx (new), components/Lobby.tsx (new)
  Architecture: Real-time player list via useQuery("rooms.getRoomState")
  Approach:
    - Show room code pill at top
    - Player list with display names, host badge
    - If current user is host: "Start Game" button, kick buttons
    - Live updates when players join
    - On start → show loading, wait for game state change
  Success: Shows players in real-time, host can start, others see updates
  Test: Join as 2nd player → see both players, host starts → transition to game
  Dependencies: Room backend complete, Convex queries
  Time: 2h
  ```

**Writing Screen**:

- [ ] Implement round writing UI with word count validation
  ```
  Files: app/room/[code]/page.tsx (modify), components/WritingScreen.tsx (new)
  Architecture: Query assignment, show previous line, live word count, submit
  Approach:
    - useQuery("game.getCurrentAssignment", { roomCode })
    - Display: round X/9, line Y - N words
    - If previousLineText, show in card component
    - Textarea with live word count: countWords(value)
    - Visual feedback: under target (gray), at target (green), over (red/warning)
    - Submit disabled unless count == target
    - On submit: useMutation("game.submitLine"), show animation, transition to waiting
  Pseudocode:
    const [text, setText] = useState('')
    const count = useMemo(() => countWords(text), [text])
    const isValid = count === assignment.targetWordCount
    <textarea value={text} onChange={e => setText(e.target.value)} />
    <div className={count === target ? 'text-green' : 'text-gray'}>
      {count} / {target} words
    </div>
    <button disabled={!isValid} onClick={() => submitLine.mutate(...)}>Submit</button>
  Success: Live count updates, validation prevents bad submissions
  Test: Type 3 words for 4-word line → submit disabled, add 1 more → enabled
  Dependencies: Round assignment backend, line submission
  Time: 2h
  ```

**Waiting Screen**:

- [ ] Implement waiting for round completion UI
  ```
  Files: components/WaitingScreen.tsx (new)
  Architecture: Query getRoundProgress, show player submission status
  Approach:
    - useQuery("game.getRoundProgress", { roomCode })
    - Display: "Waiting for everyone to finish..."
    - List players with checkmarks for submitted
    - Auto-advance when all submitted (watch game.currentRound)
  Success: Shows real-time progress, advances when all done
  Test: Submit as player 1 → see waiting screen, player 2 submits → advance
  Dependencies: Round progress backend
  Time: 1h
  ```

**Reveal Screen**:

- [ ] Implement poem reveal list and detail views
  ```
  Files: components/RevealList.tsx (new), components/PoemDetail.tsx (new)
  Architecture: Query poems for room, show list, detail view with animations
  Approach:
    RevealList:
      - useQuery("poems.getPoemsForRoom", { roomCode })
      - Grid of poem cards: "Poem 1", "Poem 2", etc.
      - On click → navigate to /poem/[id]
    PoemDetail:
      - useQuery("poems.getPoemDetail", { poemId })
      - Staggered line reveal: map with delay index * 150ms
      - Each line: text + author pill
      - Favorite button: useMutation("favorites.toggleFavorite")
      - Copy button: navigator.clipboard.writeText(fullText)
  Pseudocode:
    lines.map((line, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.15 }}
      >
        {line.text} <span>— {line.author}</span>
      </motion.div>
    ))
  Success: Poems load, detail shows staggered animation, favorite toggles
  Test: Complete game → reveal list, tap poem → lines animate in order
  Dependencies: Poem queries backend, favorites backend
  Time: 2.5h
  ```

**My Poems Page**:

- [ ] Implement user poem history page
  ```
  Files: app/me/poems/page.tsx (new)
  Architecture: Query user poems, group by game, show favorites section
  Approach:
    - useQuery("poems.getPoemsForUser", { userId })
    - useQuery("favorites.getFavoritesForUser", { userId })
    - Two sections: "My Games" (grouped by room/date), "Favorites"
    - Each entry: game date, player count, poem previews
    - Tap → /poem/[id]
  Success: Shows games user participated in, favorites section
  Test: Play game → finish → visit My Poems → see game listed
  Dependencies: Poem queries, favorites queries
  Time: 1.5h
  ```

**Profile Page**:

- [ ] Implement profile page with display name edit
  ```
  Files: app/me/profile/page.tsx (new)
  Architecture: Show/edit display name, auth status
  Approach:
    - Display current displayName
    - Edit mode: input + save button → updateUser mutation
    - Show auth status: "Signed in as X" or "Guest user"
    - Sign in/out buttons via Clerk
  Success: Edit name → saves, shows auth status
  Test: Change name → save → see updated in next game
  Dependencies: User management backend
  Time: 1h
  ```

## UI Components Library

**Base Components**:

- [ ] Create reusable UI component library
  ```
  Files: components/ui/Button.tsx, Input.tsx, Card.tsx, Badge.tsx (new)
  Architecture: Composable primitives following design tokens
  Approach: Use Tailwind + design tokens, support variants (primary, secondary, ghost)
  Success: Components work with design system, accessible, mobile-friendly
  Test: Render each variant → correct styles, keyboard navigation works
  Dependencies: Design system
  Time: 2h
  ```

**Word Count Utility**:

- [ ] Create shared word count utility matching backend
  ```
  Files: lib/wordCount.ts (new)
  Architecture: Exact same logic as backend for consistency
  Code:
    export function countWords(text: string): number {
      return text.trim().split(/\s+/).filter(Boolean).length
    }
  Success: Matches backend validation exactly
  Test: countWords("hello world") === 2, countWords("  hi  ") === 1
  Dependencies: None
  Time: 15min
  ```

## Testing

**Vitest Setup**:

- [ ] Configure Vitest for unit and integration tests
  ```
  Files: vitest.config.ts (new), tests/setup.ts (new)
  Architecture: Fast unit tests, separate integration tests for Convex
  Approach: Vitest + React Testing Library + happy-dom
  Success: vitest runs, tests pass
  Test: pnpm test → runs test suite
  Dependencies: Project initialization
  Time: 30min
  ```

**Assignment Matrix Tests**:

- [ ] Write comprehensive tests for assignment matrix generation
  ```
  Files: tests/assignmentMatrix.test.ts (new)
  Architecture: Pure function testing, property-based where possible
  Tests:
    - generates 9x P matrix
    - each row is permutation of all players
    - no consecutive assignments on same poem
    - works with edge cases (2 players, 8 players)
  Success: 100% coverage of assignment logic, edge cases handled
  Test: pnpm test assignmentMatrix → all pass
  Dependencies: Assignment matrix module
  Time: 1h
  ```

**Word Count Tests**:

- [ ] Test word counting edge cases
  ```
  Files: tests/wordCount.test.ts (new)
  Tests:
    - basic: "hello world" → 2
    - punctuation: "hello, world!" → 2
    - emoji: "🎉 party time!" → 3
    - whitespace: "  hi  there  " → 2
    - empty: "" → 0
  Success: All edge cases pass, frontend and backend logic identical
  Dependencies: Word count utility
  Time: 30min
  ```

**Game Flow Integration Test**:

- [ ] Write end-to-end game flow test
  ```
  Files: tests/e2e/gameFlow.test.ts (new)
  Architecture: Integration test with Convex test environment
  Flow:
    - Create room
    - Join 2 players
    - Start game
    - Submit all 9 rounds
    - Verify poems complete
  Success: Full game completes, poems have correct lines/authors
  Test: pnpm test:e2e gameFlow → passes
  Dependencies: All backend modules complete
  Time: 1.5h
  ```

## Polish & Deployment

**Animations**:

- [ ] Add polish animations for key interactions
  ```
  Files: components/*.tsx (modify)
  Architecture: Framer Motion for reveal animations, CSS for micro-interactions
  Animations:
    - Line submit: card flip/fly effect
    - Poem reveal: staggered line appearance
    - Lobby updates: player join fade-in
  Success: Smooth 60fps animations, feels polished
  Test: Complete game → reveal animations feel delightful
  Dependencies: All UI components
  Time: 2h
  ```

**Mobile Responsive**:

- [ ] Test and fix mobile layouts
  ```
  Files: All components (review/modify)
  Architecture: Mobile-first design, test on small screens (320px+)
  Approach: Use responsive Tailwind classes, test on actual devices
  Success: All screens work on mobile, no horizontal scroll, tap targets 44px+
  Test: Test on iPhone SE, Android phone → fully functional
  Dependencies: All UI complete
  Time: 2h
  ```

**Error States & Loading**:

- [ ] Implement comprehensive error and empty states
  ```
  Files: All pages/components (modify)
  Architecture: Suspense boundaries, error boundaries, empty state UIs
  States:
    - Loading: skeleton loaders
    - Errors: user-friendly messages with retry
    - Empty: "No games yet" with CTA
  Success: Never shows raw error or blank screen
  Test: Disconnect network → friendly error, empty state → helpful message
  Dependencies: All features complete
  Time: 1.5h
  ```

**Vercel Deployment**:

- [ ] Deploy to Vercel with environment setup
  ```
  Files: vercel.json (new if needed), .env.production (document)
  Architecture: Vercel for Next.js, Convex production instance, Clerk production
  Steps:
    - Create Convex production deployment
    - Create Clerk production instance
    - Configure Vercel env vars
    - Setup custom domain (optional)
  Success: Production app deployed, working end-to-end
  Test: Visit production URL → full game works
  Dependencies: All features complete, testing done
  Time: 1h
  ```

**Documentation**:

- [ ] Write README with setup instructions
  ```
  Files: README.md (new)
  Contents:
    - Project overview
    - Local development setup
    - Environment variables needed
    - Testing instructions
    - Deployment guide
  Success: Another developer can clone and run locally
  Test: Fresh clone → follow README → app runs
  Dependencies: Project complete
  Time: 30min
  ```

## Design Iteration Checkpoints

**After Core Backend Complete**:

- Review module boundaries: Are users/rooms/games properly separated?
- Check interface complexity: Do mutations have minimal surface area?
- Identify coupling: Can we test game logic without rooms?

**After Core Frontend Complete**:

- Review component hierarchy: Are we repeating ourselves?
- Check prop drilling: Do we need state management (Zustand)?
- Assess bundle size: Is code splitting needed?

**Pre-Launch**:

- Full playtest with 4-8 real people
- Mobile device testing (iOS + Android)
- Performance audit (Lighthouse, Core Web Vitals)
- Accessibility audit (keyboard nav, screen reader)

## Automation Opportunities

After v1 stable:

- Automated E2E tests for critical paths
- Visual regression testing for UI changes
- Database backup automation
- Stale room cleanup cron job
- Analytics/telemetry for game completion rates

---

## Validation Checklist

Before finalizing each task:

- [ ] Can engineer implement without questions?
- [ ] Module boundaries clear, dependencies explicit?
- [ ] Testable independently?
- [ ] Simplest breakdown that works?
- [ ] Follows existing patterns from TASK.md?

**Red Flags**:

- Shallow modules (wrapper functions with no added value)
- Pass-through tasks (just forwarding data)
- Temporal organization (step1, step2 instead of by responsibility)
- Heavy coupling preventing parallel work

---

## Implementation Priority

**Phase 1 - Foundation** (Can be parallelized):

1. Project initialization + infrastructure (quality gates, design system, logging, error tracking)
2. Convex schema + basic queries

**Phase 2 - Backend Core** (Some parallelization possible):

1. User + Room management (blocking)
2. Assignment matrix (can be parallel)
3. Game initialization → Round management → Line submission (sequential)
4. Poem queries + Favorites (can be parallel after line submission)

**Phase 3 - Frontend Core** (High parallelization):

1. Auth + Convex setup (blocking)
2. All pages can be built in parallel once setup done

**Phase 4 - Polish** (After feature-complete):

1. Testing (parallel with polish)
2. Animations + responsive + error states
3. Deployment + docs

**Total Estimated Time**: ~40-50 hours for solo developer

**Next Step**: Check out feature branch and begin with Phase 1 infrastructure tasks.
