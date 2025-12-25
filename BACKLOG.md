# BACKLOG.md

Last groomed: 2025-12-24
Analyzed by: 15 specialized perspectives (complexity-archaeologist, architecture-guardian, security-sentinel, performance-pathfinder, maintainability-maven, user-experience-advocate, product-visionary, design-systems-architect, grug, carmack, jobs, torvalds, ousterhout, fowler, beck)

---

## Strategic Direction

**Primary Focus**: Party game for friends in the same room

- Low-friction join via room code
- Shareable poem artifacts drive organic discovery
- "Jackbox for poetry" positioning

**Future Expansion** (when demand validated): Teacher/facilitator mode

**North Star Metric**: Completed sessions per week

**Key Unlocks**:

1. GameRules centralization (enables paid mode packs, variants)
2. Growth hooks (viral distribution after every session)
3. Moderation basics (kick player—table stakes for multiplayer)

---

## Now (Sprint-Ready, <2 weeks)

### [PRODUCT] Paginate the archive, and style it better

### [PRODUCT] Better AI poets

- better prompts
- more personas
- more robust implementation
- no fallbacks (or at least better fallbacks)
- smoother poem reveal screen

### [PRODUCT] More exquisite corpse poetry game variants

### 🔴 [CRITICAL - 3 Agents] Extract getRoomByCode helper

**Cross-validated by**: complexity-archaeologist, architecture-guardian, fowler
**Files**: convex/game.ts, convex/rooms.ts, convex/ai.ts, convex/poems.ts
**Why**: 14 occurrences of identical room lookup boilerplate:

```typescript
const room = await ctx.db
  .query('rooms')
  .withIndex('by_code', (q) => q.eq('code', code.toUpperCase()))
  .first();
```

**Fix**: Extract to `convex/lib/room.ts`:

```typescript
export async function getRoomByCode(ctx, code): Promise<Doc<'rooms'> | null>;
export async function requireRoomByCode(
  ctx,
  code,
  guestToken
): Promise<{ room; user }>;
```

**Effort**: 2h | **Impact**: Eliminates 14 duplication sites, enables evolution (caching, soft-delete)
**Acceptance**: Zero raw room queries outside helper

---

### 🟠 [HIGH - 2 Agents] Replace Math.random() with crypto.getRandomValues()

**Cross-validated by**: security-sentinel, architecture-guardian
**File**: convex/lib/assignmentMatrix.ts
**Why**: Shuffle function uses `Math.random()` which is predictable. Assignment matrix determines poem authorship—theoretically exploitable.
**Fix**: Use `crypto.getRandomValues()` for cryptographically secure shuffling.
**Effort**: 30m | **Impact**: Secure randomization
**Acceptance**: No Math.random() in security-relevant code

---

### 🟠 [HIGH - 2 Agents] Fix E2E test skipping

**Cross-validated by**: Beck, maintainability-maven
**Files**: tests/e2e/\*.spec.ts (5 files with test.skip)
**Why**: Skipped tests destroy refactoring confidence. Can't split game.ts safely without E2E coverage.
**Fix**: Either fix skipped tests or delete them. No `test.skip` in CI.
**Effort**: 2-3h | **Impact**: Refactoring confidence restored
**Acceptance**: Zero test.skip in E2E tests

---

### 🟠 [HIGH] Add beforeunload warning in WritingScreen

**File**: components/WritingScreen.tsx
**Perspectives**: user-experience-advocate, design-systems-architect
**Why**: User accidentally closes tab mid-game, loses draft text and disrupts game.
**Fix**: Add `beforeunload` handler when textarea has content.
**Effort**: 15m | **Impact**: Prevents accidental draft loss
**Acceptance**: Browser warns before closing with unsaved text

---

### 🟠 [HIGH] Assignment matrix silent failure

**File**: convex/lib/assignmentMatrix.ts:111-117
**Perspectives**: Torvalds, security-sentinel
**Why**: After 1000 attempts, allows potentially conflicting permutation with just `console.warn`. Silent game corruption.
**Fix**: Throw error instead of warn. Don't ship broken games.

```typescript
if (attempts >= MAX_ATTEMPTS) {
  throw new Error(`Cannot generate valid assignment for ${numPlayers} players`);
}
```

**Effort**: 10m | **Impact**: Prevents corrupted game state
**Acceptance**: Assignment failures throw, not warn

---

### [Product] Add timer/pace control system

**Perspectives**: product-visionary
**Why**: No time pressure. Games can stall indefinitely. One slow player kills energy.
**Approach**: Configurable round timer (30/60/90s), visual countdown, auto-submit on expiry
**Effort**: 4-6h | **Value**: Transforms game feel
**Acceptance**: Timer visible, auto-submit works

---

### [Product] Sound/audio feedback

**Why**: Ambient music, submit/round/reveal effects. "Feels like a real game" polish.
**Effort**: 3-4h | **Value**: Immersive experience

---

### [Product] Post-reveal growth hook

**File**: components/RevealPhase.tsx
**Perspectives**: product-visionary
**Why**: After reveal, users just... leave. No invitation to replay, share, or invite others.
**Approach**: After final poem reveal, show:

1. "Copy invite link" button
2. "Share your favorite poem" with OG card preview
   **Effort**: 2h | **Value**: Viral loop activation
   **Acceptance**: Every completed session surfaces 3 growth CTAs

---

### [Product] Moderation primitives (kick player)

**Perspectives**: user-experience-advocate, product-visionary
**Why**: Can't remove disruptive player or troll. Table stakes for multiplayer.
**Approach**:

1. Host can kick player (removes from roomPlayers)
2. Kicked player sees "You were removed" message
   **Effort**: 1-2h | **Value**: Basic troll defense
   **Acceptance**: Host has kick button next to each player in lobby

---

### [UX] Silent failure on room creation

**File**: app/host/page.tsx:35-38
**Perspectives**: user-experience-advocate
**Why**: Host clicks "Create Room", button stops spinning, nothing happens.
**Fix**: Add error state and display message to user.
**Effort**: 15m | **Impact**: Users can recover from failures
**Acceptance**: Errors display user-friendly message

---

### [Design] Profile page uses Tailwind grays instead of design tokens

**File**: app/me/profile/page.tsx
**Perspectives**: design-systems-architect
**Why**: 8+ hardcoded gray values break visual coherence with rest of app.
**Fix**: Replace all grays with design tokens.
**Effort**: 30m | **Impact**: Visual consistency restored
**Acceptance**: Zero Tailwind color utilities in profile page

---

### [Infrastructure] Centralize CI commit SHA env var list

**File**: tests/lib/sentry.test.ts:121-126
**Why**: Test hardcodes list of CI providers. If release-derivation logic changes, tests may drift.
**Fix**: Create shared `CI_COMMIT_SHA_ENV_VARS` constant.
**Effort**: 10m | **Impact**: Tests and implementation stay in sync

---

### [Infrastructure] Session Replay sampling may consume quota

**File**: sentry.client.config.ts:12
**Why**: 10% session sampling may hit Sentry free tier limits.
**Fix**: Reduce `replaysSessionSampleRate: 0.0`, keep errors at 100%.
**Effort**: 5m | **Impact**: Conserves quota

---

### [Architecture] Centralize GameRules in games table

**Files**: convex/schema.ts, convex/game.ts, components/WritingScreen.tsx
**Perspectives**: architecture-guardian, product-visionary
**Why**: 9 rounds, word counts scattered across files. "New mode" requires touching 4+ files. This is monetization unlock.
**Approach**:

1. Add `rules` field to `games` table: `{ totalRounds, wordCounts[], mode }`
2. startGame accepts optional rules (defaults to classic mode)
3. UI renders from `games.rules` not hardcoded constants
   **Unlocks**: Haiku mode, speed mode, paid mode packs
   **Effort**: 3-4h | **Impact**: Monetization foundation
   **Acceptance**: Zero hardcoded game rules outside `games.rules`

---

### [Testing] Add E2E full game completion test

**File**: e2e/full-session.spec.ts (new)
**Why**: Can't refactor with confidence. Unit tests cover pieces; nothing validates full flow.
**Approach**: Playwright test: create room → join 2 players → complete 9 rounds → reveal poems
**Effort**: 3-4h | **Impact**: 80% of regression coverage
**Acceptance**: CI blocks on full-session test failure

---

## Next (This Quarter, <3 months)

### [Architecture] Split game.ts submitLine into focused modules

**File**: convex/game.ts (589 lines, 7 exports)
**Cross-validated by**: Ousterhout, architecture-guardian, complexity-archaeologist
**Why**: `submitLine` is 150+ lines mixing validation, submission, round completion, reader assignment, AI scheduling. Change amplification risk.
**Approach**: Split into:

- `convex/game/validation.ts` - validateSubmission, validateWordCount
- `convex/game/roundCompletion.ts` - checkRoundComplete, advanceRound
- `convex/game/gameCompletion.ts` - completeGame, assignReaders
  **Effort**: 4h | **Impact**: Clear ownership, testable units
  **Blocked by**: E2E test coverage (fix skipped tests first)

---

### [Architecture] Split ai.ts concerns

**File**: convex/ai.ts (538 lines, 11 exports)
**Perspectives**: Ousterhout, architecture-guardian
**Why**: Module mixes AI lifecycle + LLM integration + game flow.
**Approach**:

- Keep `addAiPlayer`, `removeAiPlayer` in ai.ts (public mutations)
- Extract LLM generation to `convex/lib/ai/generate.ts`
  **Effort**: 4h | **Impact**: Clearer AI vs game boundaries

---

### [Testing] Remove internal mocks from remaining tests

**Files**:

- `tests/convex/*.test.ts` (5 files mock `convex/lib/auth`)
- `tests/convex/rooms.test.ts` (mocks `convex/lib/rateLimit`, `convex/users`)
- `tests/convex/lib/auth.test.ts` (mocks `convex/lib/guestToken`)
- `tests/hooks/useSharePoem.test.ts` (mocks `lib/sentry`)
- `tests/lib/auth.test.ts` (mocks `@/lib/error`)
- `tests/app/api/guest-session.test.ts` (mocks `@/lib/logger`)

**Why**: Tests mock internal collaborators, hiding integration bugs. Component tests were fixed (Dec 2025), but Convex and utility tests remain.

**Approach**:

1. **Quick fixes** (non-Convex tests): Mock external libraries (`@sentry/nextjs`, `pino`) instead of internal wrappers
2. **Convex tests**: Either use `convex-test` library to set up proper auth context, or accept current mocks as "auth boundary" (pragmatic)

**Effort**: 2-4h for quick fixes, 6-8h if adding convex-test | **Impact**: True integration testing
**Acceptance**: No `vi.mock()` calls with `@/` or `../../` paths targeting internal modules

---

### [Maintainability] Add tests for Convex mutations/queries

**Files**: convex/\*.ts
**Why**: Zero test coverage for backend functions. `startGame`, `submitLine`, `revealPoem` have no tests.
**Approach**: Test critical paths: startGame, submitLine, joinRoom
**Effort**: 4-6h | **Impact**: Refactoring confidence

---

### [UX] Mid-Game Exit Strategy

**Status**: Needs UX decision
**Why**: Players have no way to leave mid-game or exit after viewing poems.
**Approach**:

1. WritingScreen: "Abandon Game" with confirmation
2. RevealPhase: "Return Home" button
   **Effort**: 2-3h | **Impact**: Prevents frustration from accidental joins

---

### [UX] Improve backend error messages

**Why**: Technical messages like "Cannot join a room that is not in LOBBY status".
**Fix**: User-friendly messages:

- "This game has already started. Ask the host to create a new room."
- "This room is full (8/8 players)."
  **Effort**: 30m | **Impact**: Users can self-recover

---

### [UX] Add basic accessibility

**Why**: Zero ARIA attributes. SVG icons without labels. No keyboard navigation for modals.
**Approach**:

- Add `aria-hidden="true"` to decorative icons
- Add `aria-label` to interactive buttons
- Add Escape key handler for overlays
  **Effort**: 2h | **Impact**: Screen reader usability

---

### [UX] Player presence / ghost seat cleanup

**Why**: If player closes tab, their seat persists forever.
**Approach**:

1. Add `lastSeenAt` to roomPlayers
2. Host sees "inactive" indicator after 2 min
3. Host can remove inactive players
   **Effort**: 2-3h | **Value**: Clean room state

---

### [Security] Add authorization to favorites queries

**File**: convex/favorites.ts
**Perspectives**: security-sentinel
**Why**: Favorites queries don't verify user owns the favorites they're accessing.
**Fix**: Add user ownership checks.
**Effort**: 1h | **Impact**: Prevents viewing/modifying other users' favorites

---

### [Design] Extract PageContainer component

**Why**: Same 6-class pattern duplicated 15+ times.
**Effort**: 1.5h | **Impact**: DRY, easier to update

---

### [Design] Extract LoadingScreen component

**Why**: Each component implements loading state differently.
**Effort**: 50m | **Impact**: Consistent loading experience

---

### [Infrastructure] Instrument completion funnel

**Why**: No visibility into drop-off. Don't know if users abandon in lobby, round 3, or reveal.
**Approach**: Add events: room_created, room_joined, game_started, round_completed, game_completed, poem_shared
**Effort**: 2-3h | **Value**: Data-driven prioritization

---

### [Security] Codify privacy policy

**Why**: Mixed model—some queries public, some participant-only. No single source of truth.
**Effort**: 2h | **Impact**: Clarity for future development

---

### [Cleanup] Delete lib/utils.ts cn() wrapper

**File**: lib/utils.ts (11 lines)
**Perspectives**: Ousterhout, complexity-archaeologist
**Why**: Pass-through wrapper. Interface = implementation. Just forwards to twMerge(clsx()).
**Fix**: Delete and import twMerge(clsx()) directly, or add real value.
**Effort**: 30m | **Impact**: Removes shallow module

---

### [Cleanup] Delete lib/tokens.ts

**File**: lib/tokens.ts (15 lines)
**Perspectives**: complexity-archaeologist
**Why**: Obsolete—tokens already in globals.css as CSS variables. Theme system handles this.
**Effort**: 30m | **Impact**: Removes dead code

---

### [Documentation] Add cross-platform test for wordCount

**Files**: lib/wordCount.ts, convex/lib/wordCount.ts
**Why**: Identical 4-line function in two locations (different runtimes). Need test to prevent divergence.
**Effort**: 30m | **Impact**: Prevents silent bugs

---

## Soon (Exploring, 3-6 months)

- **[Product] Game mode variations** - Haiku (5-7-5), Limerick, Speed mode (30s timer). Major replay value. Premium candidate.
- **[Product] Spectator mode** - Non-players watch reveal. Good for events/streams.
- **[Architecture] Create React hook abstractions for Convex** - Components directly import api types. Can't swap backend.
- **[Security] Implement rate limiting** - Room creation, joining, submission. Prevents DoS.
- **[Design] Enhance Input component** - Add label, error, hint props. Transform shallow wrapper into deep module.
- **[Testing] Visual regression via Playwright** - Screenshots for key states.
- **[Reliability] Add AI model fallback strategy** - `google/gemini-3-flash-preview` has stability issues. Configure fallback model.
- **[Cleanup] Remove unused showAttribution prop from PoemDisplay** - Prop declared but unused. Source: PR #18 review.
- **[Accessibility] Focus trap in modals** - Tab key escapes to background in HelpModal/PoemDisplay. Use focus-trap-react.

---

## Later (Someday/Maybe, 6+ months)

- **[Product] Premium tier** - Game modes, room size, advanced sharing. $5/month.
- **[Product] Education package** - Teacher dashboard, themes/prompts. $5/student/year.
- **[Product] Corporate package** - Large rooms (50+), branding, SSO. $500-2000/event.
- **[Product] Slack/Discord bot** - Play inside chat apps.
- **[Product] AI-assisted mode** - AI completes lines when stuck.
- **[Platform] Mobile app** - iOS/Android native or React Native.
- **[Product] Export poems as PDF** - Teachers want tangible outputs.

---

## Learnings

**From this grooming session (Dec 2025):**

1. **Cross-validation reveals true priority** - When 4 agents (Grug, Torvalds, Ousterhout, Beck) all flag the same issue (unused logger.ts), it's not opinion—it's consensus. Delete it.

2. **Speculative abstraction is tactical programming** - logger.ts is 111 lines of "good architecture" that nobody uses. Building infrastructure before demand = waste.

3. **Duplication isn't always bad** - wordCount.ts exists in lib/ and convex/ because different runtimes. Document it, test it, but don't over-engineer a shared package.

4. **Deep modules compound** - errorFeedback.ts, guestToken.ts, avatarColor.ts are textbook deep modules. Study them. Replicate that discipline in game.ts.

5. **150-line functions are complexity bombs** - submitLine does 11 things: auth, validation, submission, round completion, game completion, reader assignment, AI scheduling. Each responsibility should be a module.

**From previous sessions:**

1. **Infrastructure exists but isn't used** - Logger and Sentry configured but zero adoption. Pattern: setup without adoption.

2. **Authorization was overlooked in MVP** - Authentication ≠ authorization. Favorites still unprotected.

3. **80/20 for party games** - Share, rematch, timer. Without these, retention broken.

4. **Design tokens work** - Profile page bypassed them and immediately looks broken. Violations are obvious.

---

## Summary

| Priority | Count    | Effort  | Key Theme                                       |
| -------- | -------- | ------- | ----------------------------------------------- |
| Now      | 16 items | ~22-28h | Dead code cleanup, security fixes, growth hooks |
| Next     | 15 items | ~30-40h | Architecture refactoring, UX polish             |
| Soon     | 9 items  | ~40h    | Game variations, advanced features              |
| Later    | 7 items  | 100h+   | Monetization, platform plays                    |

**Highest-impact cross-validated items (multiple agents agree):**

1. ~~Delete logger.ts (4 agents, 1h) - clarifies error strategy~~ ✅ DONE
2. Extract getRoomByCode (3 agents, 2h) - eliminates 14 duplication sites
3. Fix E2E test skipping (2 agents, 2-3h) - unblocks refactoring
4. Replace Math.random() (2 agents, 30m) - security

**Design system health:** Excellent (92/100 coherence). Theme system is textbook deep module. Profile page is only violator.

---

# AESTHETIC EVOLUTION: Brutalist Editorial Maximalism

Last groomed: 2025-11-23
Based on: Comprehensive aesthetic audit with frontend-design framework

## Phase 2: Motion & Interaction (Weeks 2-4, ~16 hours)

### Motion System Enhancements

- **Typewriter placeholder animation** (`WritingScreen.tsx`)
  - Character-by-character reveal with monospace tracking
  - Uses CSS `steps()` animation
  - Estimate: 1h

- **Overshoot button press effect** (`Button.tsx`)
  - Replace linear translate with spring-like overshoot
  - Add `--ease-stamp: cubic-bezier(0.68, -0.55, 0.27, 1.55)`
  - Estimate: 30m

- **Ink bleed focus states** (`Input.tsx`, `Button.tsx`)
  - Glowing ink spread on focus
  - Replaces standard focus rings
  - Estimate: 30m

- **Add motion easing tokens** (`globals.css`)
  - Define signature easing curves: `--ease-stamp`, `--ease-typewriter`, `--ease-settle`
  - Estimate: 30m

### Typography Component Expansion

- **Create Heading component** (`components/ui/Heading.tsx`)
  - 22 instances of `font-[var(--font-display)]` pattern
  - Props: `as` (h1-h6), `size` (display, xl, lg, md, sm)
  - Estimate: 1h

- **Migrate heading instances** (13 files)
  - Achieve 100% typography component coverage
  - Estimate: 2h

### Dark Mode Enhancement

- **Transform dark mode to ink-on-black**
  - True black background (`#000` not `#1c1917`)
  - Text glow: `text-shadow: 0 0 20px rgba(255, 107, 61, 0.1)`
  - Estimate: 1h

### UX Hardening

- **Improve backend error messages** (`convex/rooms.ts`)
  - "Room not found" → "Room code not found. Check the code and try again..."
  - Estimate: 30m

- **Add loading states** (`host/page.tsx`, `join/page.tsx`)
  - Replace `return null` with elegant loading spinner
  - Estimate: 30m

- **Keyboard navigation for PoemDisplay**
  - Escape key to close, focus management
  - Estimate: 1h

**Total Phase 2 Estimate**: 16 hours

---

## Phase 3: Advanced Effects (Months 2-3, ~13 hours)

### Spatial Composition

- **Vertical word counter sidebar** (`WritingScreen.tsx`) - 2h
- **Torn paper edges on cards** (`Card.tsx`) - 2h
- **Custom cursor** (pen nib SVG) - 1h
- **Parallax scroll effects** (`PoemDisplay.tsx`) - 3h

### Visual Details

- **Brush stroke decorative elements** - 2h
- **Embossed text effects** (letterpress style) - 30m
- **Custom scrollbars** (thin with persimmon accent) - 30m

**Total Phase 3 Estimate**: 13 hours

---

## Nice-to-Have Aesthetic Improvements

### Animation Choreography

- Stamp appearance animation with dust particles - 2h
- Page transition effects (ink wash wipe) - 4h
- Scroll-triggered reveals - 3h

### Decorative Language

- Ink splatter micro-interactions - 3h
- Calligraphic underlines (SVG paths) - 2h
- Marginalia elements - 4h

### Accessibility Enhancements

- Focus management for errors - 45m
- Theme toggle aria-live region - 10m
- Semantic HTML improvements - 1h

---

## Design System Technical Debt

- **Storybook setup** - 10h total (4h setup + 30m/component)
- **Design token documentation** - 2h
- **Layout primitives** (`Stack`, `Container`) - 2h
- **Loading component library** - 1h
- **Button loading states** - 30m

---

## Aesthetic Goals

Transform Linejam from "good minimalism" to "unmistakably intentional design":

1. **Execute stated philosophy visually** - Ink stamps, asymmetry, ornaments
2. **Create signature motion language** - Typewriter, overshoot, ink bleed
3. **Harden editorial aesthetic** - Vertical text, drop caps, pull quotes
4. **Achieve anti-convergence** - No AI defaults, distinctive choices

**Success Metric**: Users recognize Linejam from a screenshot without seeing logo.

---

# AESTHETIC REFINEMENT 2.0: Interaction Kindness

Last added: 2025-11-24
Based on: Creative Council aesthetic review

## Delight Micro-Interactions

- **First Word Typed Celebration** - Brief "✓ Beautiful start..." message, 1h
- **Exact Word Count Reached Animation** - Button stamp animation on valid, 1h
- **All Players Ready Celebration** - Confetti/stamp burst when last submits, 2h

## Enhanced Waiting Experience

- **Estimated Wait Time Display** - "Average wait: ~45s", 3h
- **Rotating Poetry Quotes** - 10-15 literary quotes, 1h
- **"What We're Creating" Context** - "5 poets crafting 5 poems. Round 3/9", 30m

## Focus Management

- **Focus Trap in Modals** - Prevent tab escape in HelpModal/PoemDisplay, 2h
- **Prefers-Reduced-Motion Testing** - Verify all animations respect setting, 1h

---

**Key Insight**: Most aesthetic items are LOW priority. The 92/100 design system is already excellent. CRITICAL work is in Now section (dead code, security, growth hooks). These backlog items are polish, not foundation.
