# BACKLOG.md

Last groomed: 2025-12-12
Analyzed by: 8 specialized perspectives (complexity-archaeologist, architecture-guardian, security-sentinel, performance-pathfinder, maintainability-maven, user-experience-advocate, product-visionary, design-systems-architect)

---

## Strategic Direction

**Primary Focus**: Party game for friends in the same room

- Low-friction join via QR
- Shareable poem artifacts drive organic discovery
- "Jackbox for poetry" positioning

**Future Expansion** (when demand validated): Teacher/facilitator mode

- Defer classroom features until user research validates demand

**North Star Metric**: Completed sessions per week

- Captures activation + engagement + retention + sharing

**Key Unlocks**:

1. GameRules centralization (enables paid mode packs, variants)
2. Growth hooks (viral distribution after every session)
3. Moderation basics (kick player—table stakes for multiplayer)

---

## Now (Sprint-Ready, <2 weeks)

### [Product] Sound/audio feedback\*\* - Ambient music, submit/round/reveal effects. "Feels like a real game" polish.

### [Product] Add timer/pace control system

**Perspectives**: product-visionary
**Why**: No time pressure. Games can stall indefinitely. One slow player kills energy.
**Approach**: Configurable round timer (30/60/90s), visual countdown, auto-submit on expiry
**Effort**: 4-6h | **Value**: Transforms game feel
**Business Case**: Timers create energy and laughs

### [Maintainability] Centralize CI commit SHA env var list

**File**: test/lib/sentry.test.ts:121-126
**Perspectives**: maintainability-maven
**Impact**: Test hardcodes list of CI commit SHA env vars to override. If release-derivation logic adds new providers, tests may drift.
**Fix**: Create shared constant used both in Sentry module and tests:

```typescript
// lib/sentry.ts or similar
export const CI_COMMIT_SHA_ENV_VARS = [
  'VERCEL_GIT_COMMIT_SHA',
  'GITHUB_SHA',
  'CI_COMMIT_SHA',
  'CIRCLE_SHA1',
  'TRAVIS_COMMIT',
];
```

**Effort**: 10m | **Impact**: Tests and implementation stay in sync
**Acceptance**: Single source of truth for CI commit SHA detection

---

### [UX] Silent failure on room creation

**File**: app/host/page.tsx:35-38
**Perspectives**: user-experience-advocate
**Impact**: Host clicks "Create Room", button stops spinning, nothing happens. No feedback on failure.
**Fix**: Add error state and display message to user.
**Effort**: 15m | **Impact**: Users can recover from failures
**Acceptance**: Errors display user-friendly message

---

### [UX] No beforeunload warning for draft loss

**File**: components/WritingScreen.tsx
**Perspectives**: user-experience-advocate
**Impact**: User accidentally closes tab mid-game, loses draft text and disrupts game for all players.
**Fix**: Add `beforeunload` handler when textarea has content.
**Effort**: 15m | **Impact**: Prevents accidental draft loss
**Acceptance**: Browser warns before closing with unsaved text

---

### [Design] Profile page uses Tailwind grays instead of design tokens

**File**: app/me/profile/page.tsx
**Perspectives**: design-systems-architect
**Impact**: 8+ hardcoded gray values (`bg-gray-50`, `text-gray-500`, etc.). Page looks completely different from rest of app. Breaks visual coherence.
**Fix**: Replace all grays with design tokens:

```typescript
// Before: bg-gray-50 text-gray-500 border-gray-100
// After: bg-[var(--color-background)] text-[var(--color-text-muted)] border-[var(--color-border)]
```

**Effort**: 30m | **Impact**: Visual consistency restored
**Acceptance**: Zero Tailwind color utilities in profile page

---

### [Infrastructure] Test coverage targets global instead of critical paths

**File**: vitest.config.ts:24-29
**Perspectives**: maintainability-maven
**Impact**: Global 60% threshold treats all code equally. Game logic in `convex/*.ts` has 0% coverage but passes. Profile page CSS could fail coverage but doesn't matter.
**Fix**: Target critical paths:

```typescript
thresholds: {
  'convex/*.ts': { lines: 80, functions: 80, branches: 80, statements: 80 },
  global: { lines: 50, functions: 50, branches: 50, statements: 50 },
}
```

**Effort**: 20m | **Impact**: Coverage enforced where it matters
**Acceptance**: CI fails if game logic drops below 80% coverage

---

### [Infrastructure] Session Replay sampling may consume quota quickly

**File**: sentry.client.config.ts:12
**Perspectives**: architecture-guardian
**Severity**: LOW
**Impact**: `replaysSessionSampleRate: 0.1` (10%) records 1 in 10 sessions. Sentry free tier has limited replay quota. May hit limits before catching errors.
**Recommendation**: Reduce to 0% routine sampling, keep 100% on errors:

```typescript
replaysSessionSampleRate: 0.0,  // Was 0.1
replaysOnErrorSampleRate: 1.0,  // Keep at 100%
```

**Effort**: 5m | **Impact**: Conserves quota for actual error debugging
**Acceptance**: Replays only captured when errors occur

---

### [Architecture] Centralize GameRules in games table

**Files**: convex/schema.ts, convex/game.ts, components/WritingScreen.tsx
**Perspectives**: architecture-guardian, product-visionary
**Why**: 9 rounds, word counts, assignment rules are scattered across assignmentMatrix generator, UI, and tests. Any "new mode" change requires touching 4+ files. This is the #1 architecture unlock for monetization.
**Approach**:

1. Add `rules` field to `games` table: `{ totalRounds, wordCounts[], mode, constraints }`
2. startGame accepts optional rules (defaults to classic mode)
3. UI renders from `games.rules` not hardcoded constants
4. Backfill existing games with classic rules
   **Unlocks**: Haiku mode, speed mode, paid mode packs
   **Effort**: 3-4h | **Impact**: Monetization foundation
   **Acceptance**: Zero hardcoded game rules outside `games.rules`

---

### [Testing] Add E2E full game completion test

**File**: e2e/full-session.spec.ts (new)
**Perspectives**: maintainability-maven
**Why**: Can't refactor with confidence. Unit tests cover pieces; nothing validates the full flow.
**Approach**: Playwright test that:

1. Creates room (host)
2. Joins 2 players
3. Starts game
4. All players submit 9 rounds
5. Reveals all poems
6. Starts new cycle
   **Effort**: 3-4h | **Impact**: 80% of regression coverage
   **Acceptance**: CI blocks on full-session test failure

---

### [Product] Post-reveal growth hook

**File**: components/RevealPhase.tsx
**Perspectives**: product-visionary
**Why**: After reveal, users just... leave. No invitation to replay, share, or invite others. Wasted distribution opportunity.
**Approach**: After final poem reveal, show:

1. QR code: "Start your own Linejam" (deep-link to host flow)
2. "Copy invite link" button
3. "Share your favorite poem" with OG card preview
   **Effort**: 2h | **Value**: Viral loop activation
   **Acceptance**: Every completed session surfaces 3 growth CTAs

---

### [Product] Moderation primitives (kick player)

**Perspectives**: user-experience-advocate
**Why**: Can't remove disruptive player or troll. Table stakes for any multiplayer party game (Jackbox has this).
**Approach**:

1. Host can kick player (removes from roomPlayers, player sees "You were removed")
2. Kicked player can rejoin with new name (not permanent ban—keep it lightweight)
   **Effort**: 1-2h | **Value**: Basic troll defense
   **Acceptance**: Host has kick button next to each player in lobby

---

## Next (This Quarter, <3 months)

### [UX] Mid-Game Exit Strategy

**Status**: Needs UX decision
**Complexity**: Medium
**Perspectives**: user-experience-advocate, design-systems-architect
**Description**: Add ability to leave room during WritingScreen and RevealPhase. Players currently have no way to abandon game mid-round or exit after viewing completed poem.

**Current State**: Only Lobby has "Leave Lobby" button. Once game starts, no exit option.

**Implementation Options**:

1. **WritingScreen**: "Abandon Game" button with confirmation modal
   - Warning: "Abandon game? Your submitted lines will remain."
   - Navigates to `/` (home)
   - Clear exit path for accidental joins

2. **RevealPhase**: "Return Home" button after poem completion
   - Placed with "Close" button
   - Allows exit without browser back button

**Blocked by**: Product decision on mid-game exit policy:

- Should players be able to leave during active gameplay?
- What happens to submitted lines if player leaves?
- Should host have different permissions (can't abandon, must end game for all)?

**Effort**: 2-3h (WritingScreen + RevealPhase + confirmation modal)
**Impact**: Prevents user frustration from accidental joins, provides clear exit paths
**Acceptance**: Players can leave from any game phase, appropriate warnings shown
**Priority**: Medium

---

### [Documentation] Docstring Coverage Improvement

**Status**: Deferred (warning-level, not blocking)
**Complexity**: Low
**Current**: 16.13% docstring coverage | **Target**: 80%
**Perspectives**: maintainability-maven
**Triggered by**: CodeRabbit pre-merge check on PR #6

**Analysis**: This is a design system/UI PR, not API/library code. Most files are React components with JSX where docstrings provide limited value. Strategic focus should be on deep modules (errorFeedback.ts, LoadingState.tsx, etc.) rather than global percentage.

**Approach**:

1. Run `@coderabbitai generate docstrings` command in PR after merge
2. Review generated docstrings for accuracy
3. Focus on deep modules and exported utilities
4. Accept lower coverage for pure UI components

**Defer Rationale**:

- Not blocking merge (warning-level check)
- Better addressed systematically across codebase post-merge
- Higher ROI to fix functional bugs first (pause logic, ARIA attributes)
- UI components have self-documenting component APIs

**Effort**: 1-2h (automated generation + review)
**Impact**: Improved IDE autocomplete, onboarding documentation
**Acceptance**: Critical modules (errorFeedback, LoadingState, deep modules) have comprehensive docstrings
**Priority**: P3

---

### [Architecture] Split game.ts god object into focused modules

**File**: convex/game.ts (436 lines, 8 exports, 6 responsibilities)
**Perspectives**: architecture-guardian, complexity-archaeologist
**Why**: Single file handles game lifecycle, assignments, submission, validation, round progression, reveal management. "What does game.ts do?" → "Everything"
**Approach**: Split into:

- `convex/game/lifecycle.ts` - startGame
- `convex/game/assignments.ts` - getCurrentAssignment
- `convex/game/submission.ts` - submitLine, validation
- `convex/game/reveal.ts` - getRevealPhaseState, revealPoem
  **Effort**: 2h | **Impact**: Clear ownership, testable units

---

### [Maintainability] Add tests for Convex mutations/queries

**Files**: convex/\*.ts
**Perspectives**: maintainability-maven
**Why**: Zero test coverage for all backend functions. `startGame`, `submitLine`, `revealPoem` have no tests. Any refactor could break game without detection.
**Approach**: Create tests for critical paths:

- `startGame`: host-only, 2+ players, correct matrix/poems
- `submitLine`: word count validation, assignment validation
- `joinRoom`: room full, already started, existing player
  **Effort**: 4-6h | **Impact**: Refactoring confidence

---

### [UX] Add basic accessibility

**Perspectives**: user-experience-advocate
**Why**: Zero ARIA attributes in codebase. SVG icons without labels. No keyboard navigation for modals.
**Approach**:

- Add `aria-hidden="true"` to decorative icons
- Add `aria-label` to interactive buttons (favorites heart)
- Add `role="status" aria-live="polite"` to loading states
- Add Escape key handler for overlays
  **Effort**: 2h | **Impact**: Makes app usable for screen reader users

---

### [UX] Improve backend error messages

**Perspectives**: user-experience-advocate
**Why**: Technical messages like "Cannot join a room that is not in LOBBY status". Users don't understand jargon.
**Approach**: User-friendly messages:

- "This game has already started. Ask the host to create a new room."
- "This room is full (8/8 players)."
- "Room code 'ABCD' not found. Check the code and try again."
  **Effort**: 30m | **Impact**: Users can self-recover

---

### [Design] Extract PageContainer component

**Perspectives**: design-systems-architect
**Why**: Same 6-class pattern duplicated 15+ times:

```typescript
<div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-6">
```

**Approach**: Create `components/ui/PageContainer.tsx`
**Effort**: 1.5h | **Impact**: DRY, easier to update

---

### [Design] Extract LoadingScreen component

**Perspectives**: design-systems-architect
**Why**: Each component implements loading state differently. Some "Loading...", some "Loading poems...", no spinners/skeletons.
**Approach**: Standardized loading screen with customizable message
**Effort**: 50m | **Impact**: Consistent loading experience

---

### [UX] Player presence / ghost seat cleanup

**Perspectives**: user-experience-advocate
**Why**: If player closes tab, their seat persists forever. Confuses host ("who is 'Anonymous'?"), blocks capacity.
**Approach**:

1. Add `lastSeenAt` to roomPlayers (updated on any action)
2. Host sees "inactive" indicator after 2 min silence
3. Host can remove inactive players
   **Effort**: 2-3h | **Value**: Clean room state
   **Acceptance**: Inactive players visually distinguished, removable by host

---

### [Security] Add authorization to favorites queries

**Perspectives**: security-sentinel
**Why**: Favorites queries (`getFavorites`, `toggleFavorite`) don't verify user owns the favorites they're accessing. While poems queries now have participation checks (via `checkParticipation`), favorites remain unprotected.
**Approach**: Add user ownership checks to favorites queries in `convex/favorites.ts`
**Effort**: 1h | **Impact**: Prevents viewing/modifying other users' favorites
**Acceptance**: All favorites queries verify `userId` matches authenticated user

---

### [Infrastructure] Instrument completion funnel

**Perspectives**: product-visionary
**Why**: No visibility into drop-off. Don't know if users abandon in lobby, round 3, or reveal.
**Approach**: Add events table or send to analytics:

- room_created, room_joined, game_started
- round_completed (per round)
- game_completed, poem_shared
  **Effort**: 2-3h | **Value**: Data-driven prioritization
  **Acceptance**: Can answer "what % of started games reach reveal?"

---

### [Security] Codify privacy policy

**Perspectives**: security-sentinel
**Why**: Mixed model—some queries are public, some participant-only. No single source of truth. Not urgent for party game, but good hygiene.
**Approach**: Document endpoint-by-endpoint access levels; add helpers for consistent enforcement.
**Effort**: 2h | **Impact**: Clarity for future development

---

## Soon (Exploring, 3-6 months)

- **[Product] Game mode variations** - Haiku (5-7-5), Limerick (AABBA), Speed mode (30s timer), Theme mode (random prompts). Major replay value. Premium tier candidate.
- **[Product] Spectator mode** - Non-players watch reveal phase. Good for events/streams, larger groups.
- **[Architecture] Create React hook abstractions for Convex** - Components directly import `api` generated types. Can't swap backend without changing all components.
- **[Security] Implement rate limiting** - Room creation, joining, line submission. Prevents DoS and enumeration.
- **[Design] Enhance Input component** - Add label, error, hint props with accessibility attributes. Transform shallow wrapper into deep module.
- **[Testing] Visual regression via Playwright** - Screenshots for key states. Refactoring confidence.

---

## Later (Someday/Maybe, 6+ months)

- **[Product] Premium tier** - Game modes, room size, advanced sharing. $5/month or $20/year.
- **[Product] Education package** - Teacher dashboard, themes/prompts, content moderation. $5/student/year.
- **[Product] Corporate package** - Large rooms (50+), branding, SSO. $500-2000/event.
- **[Product] Slack/Discord bot** - Play inside chat apps. New distribution channel.
- **[Product] AI-assisted mode** - AI completes lines when stuck. Premium differentiator.
- **[Platform] Mobile app** - iOS/Android native or React Native
- **[Platform] Plugin system** - User-extensible commands
- **[Product] Export poems as PDF/printable** - Teachers/facilitators want tangible outputs. Lower priority until teacher demand validated. Trigger: teacher/facilitator demand signal.

---

## Learnings

**From this grooming session:**

1. **Infrastructure exists but isn't used** - Logger and Sentry are perfectly configured but zero calls in application code. The "build it" was done, the "use it" was forgotten. Pattern: infrastructure setup without adoption.

2. **Authorization was overlooked in MVP** - All Convex queries return data without checking if caller should have access. Pattern: authentication ≠ authorization.

3. **N+1 queries in Convex look different** - Sequential `await ctx.db.query()` in loops. Same performance problem as SQL N+1, but the pattern is less obvious. Every loop with DB access is suspect.

4. **The 80/20 for party games** - Share, rematch, timer. Without these three features, retention is fundamentally broken. Play Again button being a no-op is critical.

5. **Design tokens work** - The Zen Garden system in globals.css is excellent. One file (Profile) bypassed it and immediately stands out as broken. Tokens create visual coherence; violations are obvious.

6. **Quality gates exist but aren't optimized** - Lefthook is configured but runs full typecheck on every commit (too slow). CI runs sequentially despite independent steps. No secrets scanning. Pattern: quality infrastructure setup without performance tuning.

**From external consultation (Dec 2025):**

1. **"Rules" are the monetization unlock** — Every scattered game constant (9 rounds, word counts) is a future paid mode you can't sell. Centralizing rules in the database is infrastructure investment.

2. **Artifacts are distribution** — Poem pages with OG images are not vanity; they're the viral loop. Lean into sharing and beautiful outputs.

3. **Room codes are fine for party games** — Jackbox, Wavelength, and similar games use 4-letter codes without issue. The threat model accepts trolls joining random rooms—that's an annoyance, not a privacy breach. Real mitigations: short-lived rooms, kick functionality, rate limiting.

4. **Moderation is table stakes** — Any multiplayer game needs basic kick/remove. This isn't a "teacher feature"—it's baseline troll defense.

5. **Growth hooks are free distribution** — Post-reveal is a wasted moment. Every completed session should surface CTAs to start another game, share poems, invite others.

---

## Summary

| Priority | Count    | Effort  | Key Theme                                                                                 |
| -------- | -------- | ------- | ----------------------------------------------------------------------------------------- |
| Now      | 30 items | ~26-32h | GameRules centralization, E2E testing, growth hooks, moderation, UX basics, quality gates |
| Next     | 14 items | ~44-54h | Architecture refactoring, funnel instrumentation, privacy policy, product features        |
| Soon     | 8 items  | ~60h    | Game variations, polish, advanced features                                                |
| Later    | 8 items  | 100h+   | Monetization, verticals, platform plays, PDF export                                       |

**Highest-impact new items (from consultation):**

1. Centralize GameRules in games table (3-4h) - monetization foundation, enables mode packs
2. E2E full game completion test (3-4h) - 80% regression coverage
3. Post-reveal growth hook (2h) - viral loop activation
4. Kick player moderation (1-2h) - table stakes troll defense

**Most impactful quick wins (existing):**

1. Extract `getUser` helper (30m) - eliminates 60 lines of duplication
2. Replace `alert()` with inline errors (30m) - fixes jarring UX
3. Migrate profile page to design tokens (30m) - restores visual coherence
4. Parallelize N+1 queries (2h) - 5-10x performance improvement

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
  - Glowing ink spread on focus: `box-shadow: 0 0 0 3px var(--color-primary), 0 0 12px 4px rgba(232, 93, 43, 0.3)`
  - Replaces standard focus rings
  - Estimate: 30m

- **Lobby player stagger timing increase** (`Lobby.tsx:69`)
  - Change from 100ms to 150ms for more theatrical entry
  - Trivial change but noticeable impact
  - Estimate: 5m

- **Add motion easing tokens** (`globals.css:91-96`)
  - Define signature easing curves:
    - `--ease-stamp`: Overshoot for stamp effects
    - `--ease-typewriter`: Stepped animation
    - `--ease-settle`: Smooth settle after motion
  - Estimate: 30m

### Typography Component Expansion

- **Create Heading component** (`components/ui/Heading.tsx`)
  - 22 instances of `font-[var(--font-display)]` pattern
  - Props: `as` (h1-h6), `size` (display, xl, lg, md, sm)
  - Consolidates responsive typography
  - Estimate: 1h

- **Migrate heading instances** (13 files)
  - Replace scattered heading patterns
  - Achieve 100% typography component coverage
  - Estimate: 2h

### Dark Mode Enhancement

- **Transform dark mode to ink-on-black**
  - True black background (`#000` not `#1c1917`)
  - Text glow: `text-shadow: 0 0 20px rgba(255, 107, 61, 0.1)`
  - Brighter persimmon: `#ff6b3d`
  - Inverted grain (white noise on black)
  - Add vignette: `box-shadow: inset 0 0 200px rgba(0, 0, 0, 0.5)`
  - Estimate: 1h

### UX Hardening (Deferred from TODO.md)

- **Add `beforeunload` warning** (`WritingScreen.tsx`)
  - Prevents accidental data loss when typing in progress
  - Browser prompt: "You have unsaved changes"
  - Estimate: 20m

- **Improve backend error messages** (`convex/rooms.ts`, `lib/rateLimit.ts`)
  - "Room not found" → "Room code not found. Check the code and try again..."
  - "Cannot join a room that is not in LOBBY status" → "This room has already started. Please wait for the next session..."
  - "Rate limit exceeded" → "Too many rooms created. Please wait [X] minutes..."
  - Estimate: 30m

- **Add loading states** (`host/page.tsx`, `join/page.tsx`, `me/poems/page.tsx`)
  - Replace `return null` with elegant loading spinner
  - Matches WaitingScreen pulse animation
  - Estimate: 30m

- **Fix clipboard copy feedback** (`RoomQr.tsx`)
  - Silent failure → inline error message
  - "Failed to copy. Try manually."
  - Estimate: 15m

- **Add error recovery UI** (`RevealPhase.tsx`)
  - Replace silent console.error with inline error display
  - User can retry failed actions
  - Estimate: 2h

- **Keyboard navigation for PoemDisplay**
  - Escape key to close poem modal
  - Focus management
  - Estimate: 1h

**Total Phase 2 Estimate**: 16 hours

---

## Phase 3: Advanced Effects (Months 2-3, ~13 hours)

### Spatial Composition Enhancements

- **Vertical word counter sidebar** (`WritingScreen.tsx`)
  - Move from top-center to right-edge vertical orientation
  - Japanese-style writing mode
  - Ink well graphic that fills as approaching target
  - Estimate: 2h

- **Torn paper edges on cards** (`Card.tsx`)
  - SVG clip-paths for irregular edges
  - Adds materiality and print aesthetic
  - Estimate: 2h

- **Custom cursor** (Global CSS)
  - Pen nib or ink dot SVG cursor
  - Changes on hover states (writing mode, selection)
  - Estimate: 1h

- **Parallax scroll effects** (`PoemDisplay.tsx`)
  - Multi-layer depth on scrollable poems
  - Foreground lines move faster than background
  - Estimate: 3h

### Additional Visual Details

- **Brush stroke decorative elements**
  - Replace text decorative border on homepage with SVG brush stroke
  - Calligraphic underlines on headings
  - Estimate: 2h

- **Embossed text effects**
  - Subtle letterpress effect on display headings
  - Via text-shadow: `0 1px 0 rgba(255,255,255,0.3), 0 -1px 0 rgba(0,0,0,0.7)`
  - Estimate: 30m

- **Custom scrollbars**
  - Thin scrollbar with persimmon accent
  - Webkit-scrollbar styling
  - Estimate: 30m

### Component Polish

- **Component documentation** (JSDoc)
  - Add usage examples to all 12+ components
  - IDE autocomplete improvement
  - Estimate: 2h

- **Component tests** (React Testing Library)
  - Button, Card, Input, Label, Alert, Stamp, Ornament
  - 80% coverage target for UI primitives
  - Estimate: 3h (1h per component × 3 priority components)

**Total Phase 3 Estimate**: 13 hours

---

## Nice-to-Have Aesthetic Improvements

### Animation Choreography

- **Stamp appearance animation**
  - Rotate + scale + fade-in when stamp appears
  - Dust particles on "stamp down" moment
  - Estimate: 2h

- **Page transition effects**
  - Smooth transitions between game states
  - Ink wash wipe transitions
  - Estimate: 4h

- **Scroll-triggered reveals**
  - Content reveals as user scrolls
  - Intersection Observer API
  - Estimate: 3h

### Decorative Language

- **Ink splatter micro-interactions**
  - Random ink dots on button clicks
  - Canvas API for organic shapes
  - Estimate: 3h

- **Calligraphic underlines**
  - SVG paths under important headings
  - Animated draw-on effect
  - Estimate: 2h

- **Marginalia elements**
  - Editorial side notes, asterisks, hand-drawn arrows
  - Pure decoration, no functional purpose
  - Estimate: 4h

### Editorial Typography

- **Pull quote styling**
  - Preceding line in WritingScreen as editorial pull quote
  - Large quotation marks, offset layout
  - Estimate: 1h

- **Typographic hierarchy refinement**
  - Establish 6-level heading system
  - Document type scale rationale
  - Estimate: 2h

- **Vertical text for labels**
  - Japanese-style vertical orientation on select labels
  - `writing-mode: vertical-rl`
  - Estimate: 1h

### Accessibility Enhancements

- **Focus management for errors**
  - Auto-focus error messages for screen readers
  - `role="alert"`, `tabIndex={-1}`
  - Estimate: 45m across all error states

- **Theme toggle aria-live region**
  - Announce theme changes to screen readers
  - "Dark mode active" / "Light mode active"
  - Estimate: 10m

- **Semantic HTML improvements**
  - Player lists as `<ul>/<li>` instead of `<div>`
  - Proper heading hierarchy
  - Estimate: 1h

### Performance & Polish

- **Lazy loading for stamps/ornaments**
  - Dynamic imports for decorative components
  - Reduces initial bundle size
  - Estimate: 30m

- **SVG optimization**
  - SVGO for stamp/divider SVGs
  - Reduce file size 30-50%
  - Estimate: 30m

- **Animation performance**
  - Use `will-change` for animated elements
  - Prefer `transform` and `opacity` over layout properties
  - Estimate: 1h

---

## Design System Technical Debt

### Component Architecture

- **Storybook setup**
  - Visual component reference
  - Isolated development environment
  - Interactive prop testing
  - Estimate: 4h setup + 30m per component = 10h total

- **Design token documentation**
  - Markdown file documenting color/typography/spacing philosophy
  - Usage guidelines for each token
  - Estimate: 2h

- **Unused token cleanup**
  - Remove or document custom font-size tokens (rarely used)
  - Decide: rely on Tailwind scale OR enforce custom tokens
  - Estimate: 1h

- **Layout primitives** (`Stack`, `Container`)
  - Extract repeated flex/grid patterns
  - `<Stack direction="vertical" gap={4}>`
  - Estimate: 2h

- **Loading component library**
  - Standardize 3 loading patterns (spinner, skeleton, screen)
  - Consistent across all loading states
  - Estimate: 1h

- **Button loading states**
  - `<Button isLoading>` prop
  - Spinner replaces button text
  - Estimate: 30m

### Code Quality

- **Extract magic numbers**
  - Stagger timings, animation durations as constants
  - `const POEM_REVEAL_DELAY = 800;`
  - Estimate: 30m

- **Consolidate repeated classNames**
  - Create utility classes for common patterns
  - Example: `.editorial-label`, `.ink-stamp`
  - Estimate: 1h

---

## Aesthetic Backlog Summary

| Phase          | Focus                                            | Estimated Effort |
| -------------- | ------------------------------------------------ | ---------------- |
| Phase 2        | Motion, Typography, Dark Mode, UX Hardening      | 16 hours         |
| Phase 3        | Advanced Effects, Visual Polish, Tests           | 13 hours         |
| Nice-to-Have   | Animation, Decorative Elements, Accessibility    | ~25 hours        |
| Technical Debt | Storybook, Documentation, Component Architecture | ~10 hours        |

**Total Additional Aesthetic Work**: ~64 hours beyond Week 1 foundation (12 hours in TODO.md)

---

## Aesthetic Goals

Transform Linejam from "good minimalism" to "unmistakably intentional design" by:

1. **Executing stated philosophy visually** - Ink stamps, asymmetry, ornaments
2. **Creating signature motion language** - Typewriter, overshoot, ink bleed
3. **Hardening editorial aesthetic** - Vertical text, drop caps, pull quotes
4. **Achieving anti-convergence** - No AI defaults, distinctive choices throughout

**Success Metric**: Users recognize Linejam from a screenshot without seeing logo or title.

---

# AESTHETIC REFINEMENT 2.0: Interaction Kindness & System Polish

Last added: 2025-11-24
Based on: Creative Council aesthetic review (Rams, Hara, Norman, Vignelli lenses)

> **Context**: November 2024 aesthetic audit identified visual excellence (92/100 system coherence) undermined by interaction gaps. The design system is intentional; the interaction design needs to match that care.

## Delight Micro-Interactions (Nice-to-Have)

### First Word Typed Celebration

- **Description**: Brief encouraging message when user types first word of line in WritingScreen
- **Implementation**: Track `previousWordCount` in state, trigger on 0 → 1 transition
- **Message**: Subtle "✓ Beautiful start..." in success color, fades after 2s
- **Value**: Positive reinforcement, reduces intimidation of blank canvas
- **Estimated effort**: 1h
- **Priority**: Medium
- **File**: `components/WritingScreen.tsx`

### Exact Word Count Reached Animation

- **Description**: Button celebrates with animation when word count validation passes
- **Implementation**: Watch `isValid` state transition false → true, trigger stamp animation
- **Effect**: Trigger `animate-stamp` class on Button for satisfying "click" moment
- **Value**: Clear feedback when constraint satisfied
- **Estimated effort**: 1h
- **Priority**: Medium
- **File**: `components/WritingScreen.tsx`, `components/ui/Button.tsx`

### All Players Ready Celebration

- **Description**: Waiting screen shows visual celebration when last player submits
- **Implementation**: Watch `submittedCount === totalPlayers`, trigger confetti or stamp burst
- **Effect**: Brief animation acknowledging group coordination
- **Value**: Builds anticipation for reveal, acknowledges collaboration
- **Estimated effort**: 2h
- **Priority**: Low
- **File**: `components/WaitingScreen.tsx`

## Enhanced Waiting Experience

### Estimated Wait Time Display

- **Description**: Show "Average wait: ~45s" on waiting screen based on historical data
- **Implementation**:
  - Track submission timestamps in Convex
  - Calculate rolling average per round
  - Display in waiting screen UI
- **Value**: Reduces perceived wait time, manages expectations
- **Estimated effort**: 3h (backend tracking + frontend display)
- **Priority**: Medium
- **Files**: `convex/game.ts`, `components/WaitingScreen.tsx`

### Rotating Poetry Quotes

- **Description**: Cycle through 10-15 literary quotes instead of single static one
- **Implementation**: Array of quote objects, `useMemo` to select random on mount
- **Value**: Reduces boredom during wait, educational/inspiring
- **Estimated effort**: 1h
- **Priority**: Low
- **File**: `components/WaitingScreen.tsx`

### "What We're Creating" Context

- **Description**: Show "5 poets crafting 5 unique poems. Round 3 of 9 complete."
- **Implementation**: Simple text interpolation with player count and round number
- **Value**: Reminds users of collaborative creation happening in real-time
- **Estimated effort**: 30m
- **Priority**: Low
- **File**: `components/WaitingScreen.tsx`

## Focus Management & Accessibility

### Focus Trap in PoemDisplay Modal

- **Description**: Prevent tab key from cycling to background content when poem modal open
- **Implementation**: Use `@react-aria/focus` or custom trap with event listeners
- **Value**: WCAG 2.1 Level A compliance (2.4.3 Focus Order)
- **Estimated effort**: 2h
- **Priority**: High (move to TODO.md if WCAG compliance required)
- **File**: `components/PoemDisplay.tsx`

### Prefers-Reduced-Motion Testing

- **Description**: Thoroughly test all animations respect `prefers-reduced-motion: reduce`
- **Current state**: Global CSS rule exists but needs comprehensive testing
- **Value**: Better experience for vestibular disorder users
- **Estimated effort**: 1h testing + fixes
- **Priority**: Medium

## Design System Expansion (Future)

### Storybook Component Catalog

- **Description**: Visual catalog of all components with interactive prop testing
- **Value**: Discoverability for designers/developers, visual regression testing
- **Setup**: Storybook 7+ with Next.js integration
- **Estimated effort**: 1d setup + 30m per component
- **Priority**: Low (only if team grows beyond solo developer)
- **When**: Team reaches 2+ frontend developers OR designer joins

### Figma Design Token Sync

- **Description**: Export design tokens from globals.css to Figma variables
- **Tools**: Style Dictionary + Figma Tokens plugin
- **Value**: Design-dev workflow stays in sync, single source of truth
- **Estimated effort**: 2-3d (Style Dictionary setup + Figma plugin config)
- **Priority**: Low (only if designer joins team)
- **When**: Designer collaboration begins

### Component Library Extraction

- **Description**: Extract `components/ui/*` to `@linejam/ui` npm package
- **Value**: Reusability if building second app with same aesthetic
- **Estimated effort**: 1-2d (package setup, exports, build config)
- **Priority**: Very Low
- **When**: Building second application that needs same design system

## Technical Debt Opportunities

### Input Component Size Variants

- **Current**: Size overridden via `className="h-14 text-lg"`
- **Proposal**: Add `size` prop matching Button's API (`sm | md | lg | xl`)
- **Benefit**: API consistency across form components
- **Trade-off**: Adds API surface, most inputs use default size
- **Estimated effort**: 1h
- **Decision**: Defer until multiple input sizes needed in practice

### Typography Component Abstraction

- **Current**: Direct className usage like `className="text-5xl font-[var(--font-display)]"`
- **Proposal**: `<Hero>Linejam</Hero>` or `<Display>Join Session</Display>`
- **Benefit**: Semantic component API, centralized responsive logic
- **Trade-off**: Adds indirection, Tailwind classes already semantic
- **Module analysis**: Would be shallow module (interface ≈ implementation)
- **Estimated effort**: 2h
- **Decision**: Defer — only valuable if typography requires complex responsive logic

### Ceremonial Animation Hook

- **Current**: Declarative CSS animations with utility classes
- **Proposal**: `const { trigger } = useCeremonialAnimation('stamp')`
- **Benefit**: Centralized animation orchestration, easier sequencing
- **Trade-off**: Adds JavaScript complexity for what CSS handles simply
- **Estimated effort**: 3h
- **Priority**: Low — current approach simpler and more performant
- **Decision**: Keep CSS-first approach

## Option C: Editorial Maximalism (Alternate Aesthetic Direction)

> **Warning**: Only pursue if intentionally pivoting from current minimalism to maximalism. Requires 5-6 weeks and radical aesthetic shift.

### Typography Expansion (1 week)

- Add third display serif for poetry (EB Garamond or Cormorant Garamond)
- Extreme poster scale headlines: `text-[12rem]` on desktop
- Drop caps on first line of every revealed poem
- Vertical text orientation for ALL section labels (not just decoration)
- **Risk**: Could overwhelm poetry content (content should sing, not design)

### Color System Expansion (3 days)

- Add secondary accent: Indigo (traditional Japanese ink #4f46e5)
- Two-color stamp system (persimmon primary, indigo secondary)
- Alternating poem card colors in archive (persimmon/indigo rotation)
- **Risk**: Dilutes current color restraint (violates Vignelli's "one color" principle)

### Layout Drama (2 weeks)

- Asymmetric grids everywhere (break centered max-width containers)
- Overlapping card layers with z-index depth
- Magazine-style text wrapping around visual elements
- Full-bleed sections with edge-to-edge content
- **Risk**: Mobile adaptation complexity, accessibility concerns with overlapping content

### Motion Expansion (1 week)

- Page transition animations (slide reveals between game rounds)
- Parallax scroll effects on poem reveal
- Ink ripple effects on all interactions (Canvas API or SVG filters)
- More aggressive stamp rotations (-15deg instead of -8deg)
- **Risk**: Performance on low-end mobile devices

### Texture & Detail (1 week)

- Halftone texture overlays (SVG filters)
- Ink splatters on hover states
- Torn paper edges on cards (CSS clip-path)
- Japanese woodblock print patterns as backgrounds
- **Risk**: Visual weight could overwhelm minimalist core aesthetic

**Total Effort**: 5-6 weeks
**Recommendation**: Only pursue if user wants radical aesthetic pivot from current minimalism. Option B (The Craftsperson) preserves excellent 92/100 design system while fixing interaction gaps.

---

## Aesthetic Refinement Summary

| Category                   | Items   | Total Effort | Priority                       |
| -------------------------- | ------- | ------------ | ------------------------------ |
| Delight Micro-Interactions | 3       | 4h           | Medium-Low                     |
| Enhanced Waiting           | 3       | 4.5h         | Medium-Low                     |
| Accessibility              | 2       | 3h           | High (if WCAG required)        |
| Design System Expansion    | 3       | 4-6 days     | Very Low (team-size dependent) |
| Technical Debt             | 3       | 6h           | Low (defer until needed)       |
| Option C Maximalism        | 5 areas | 5-6 weeks    | Special (alternate direction)  |

**Key Insight**: Most "future enhancement" items are LOW priority because the current aesthetic foundation is already excellent (92/100 system coherence). The CRITICAL work is in TODO.md (making invisible interactions visible and kind). These backlog items are polish, not foundation.

**Decision Framework**: Promote backlog item to TODO.md only when:

1. User explicitly requests feature
2. Team size grows (Storybook, Figma sync)
3. WCAG compliance becomes requirement (focus trap, screen reader enhancements)
4. Performance data shows need (estimated wait times reduce perceived lag)

---
