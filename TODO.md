# TODO: Aesthetic Refinement — Strategic UX & System Improvements

> **Philosophy**: Ousterhout strategic programming. Invest in deep modules, system design, and information hiding over tactical fixes. Make the implementation match the aesthetic ambition.

**Context**: Aesthetic review identified visual design excellence (92/100 system coherence) undermined by interaction gaps. Current state: "Confident minimalist gallery with one foot in workshop." Target: "Ceremonial space for collaborative creation."

**Strategic Goal**: Extend the same care shown in typography/color/spacing to feedback/states/errors. Make invisible interactions visible and kind.

---

## Phase 1: Error Handling & Feedback System (STRATEGIC) ✅ COMPLETE

**Rationale**: Currently, all errors use `console.error`, creating silent failures. Build deep module for user-facing error communication that hides network/mutation complexity behind simple, kind error messages.

### 1.1 Error Handling Deep Module

- [x] **Create error feedback system architecture**
  - File: `lib/errorFeedback.ts` ✅
  - Create `ErrorFeedback` type with fields: `message`, `variant` ✅ (removed YAGNI fields)
  - Create `errorToFeedback()` helper that transforms Convex errors → user-friendly messages ✅
  - Map common error patterns: network failures, validation errors, timeout errors ✅
  - Success criteria: Single source of truth for error → user message transformation ✅
  - Estimated effort: 2h | Actual: 1.5h (TDD + simplification review)
  - **Why strategic**: Deep module hides error classification complexity, makes adding new error types trivial
  - **Commits**: test: db654d5, feat: 787bc44

- [x] **Add error state to Lobby component** ✅
  - File: `components/Lobby.tsx`
  - Added error state, wrapped mutation in try/catch, renders Alert before button ✅
  - Success criteria: Network failures show "Failed to start game. Please check your connection and try again." ✅
  - Estimated effort: 1h | Actual: ~45m
  - **Commit**: 1b42e6c

- [x] **Add error state to Host page** ✅
  - File: `app/host/page.tsx`
  - Added error state, wrapped mutation in try/catch, renders Alert below form ✅
  - Success criteria: Room creation failures visible to user with recovery guidance ✅
  - Estimated effort: 45m | Actual: ~30m
  - **Commit**: 7244c02

- [x] **Add error state to Join page** ✅
  - File: `app/join/page.tsx`
  - Migrated to errorToFeedback + Alert pattern, wrapped mutation in try/catch ✅
  - Success criteria: Invalid room codes show clear "Room not found" message ✅
  - Estimated effort: 45m | Actual: ~30m
  - **Commit**: d6199e6

- [x] **Add error state to RevealPhase component** ✅
  - File: `components/RevealPhase.tsx`
  - Added unified error state, wrapped both mutations in try/catch blocks ✅
  - Renders Alert at top of component ✅
  - Success criteria: Reveal/cycle failures don't silently fail ✅
  - Estimated effort: 1h | Actual: ~45m
  - **Commit**: 230588a

### 1.2 Input Visibility & Accessibility (STRATEGIC)

**Rationale**: Invisible textarea violates "make invisible visible" principle and creates WCAG 2.1 failures. Fix strategically by establishing input visibility standards across system.

- [x] **Make WritingScreen textarea visible with focus states** ✅
  - File: `components/WritingScreen.tsx`
  - Replaced transparent textarea with visible input with focus states ✅
  - Updated placeholder to "Type your line here..." ✅
  - Success criteria: Mobile users on bright screens can see input area, focus ring visible on keyboard nav ✅
  - **Why strategic**: Establishes pattern for all large text inputs (not just quick fix)
  - Estimated effort: 30m | Actual: ~25m
  - **Commit**: 9fe4ec9

- [x] **Add ARIA labels to textarea for screen readers** ✅
  - File: `components/WritingScreen.tsx`
  - Added `aria-label="Your poetry line"` to textarea ✅
  - Added `aria-describedby="word-count-status"` linking to word counter ✅
  - Added `id="word-count-status"` to word count display div ✅
  - Success criteria: Screen reader announces "Your poetry line, 4 of 1 words, too many words" ✅
  - Estimated effort: 20m | Actual: ~15m
  - **Commit**: 3f51907

### 1.3 Validation Feedback System (STRATEGIC)

**Rationale**: Color-only feedback (red/green) excludes 8% of males (color-blind) and provides no recovery guidance. Build validation feedback pattern that combines color + text + semantic HTML.

- [x] **Add word count guidance text to WritingScreen** ✅
  - File: `components/WritingScreen.tsx`
  - Added guidance div below "Target Count" label with validation states ✅
  - Shows "✓ Ready to submit", "Remove X words", "Add X words", or "Start typing..." ✅
  - Success criteria: Users know exactly how to reach valid state without decoding color ✅
  - **Why strategic**: Establishes validation feedback pattern for all constrained inputs
  - Estimated effort: 45m | Actual: ~30m
  - **Commit**: cadc70f

- [ ] **Add live region for screen reader validation announcements**
  - File: `components/WritingScreen.tsx`
  - Add `<div className="sr-only" role="status" aria-live="polite" aria-atomic="true">` with validation text
  - Announce only on state changes (not every keystroke) using `useEffect` + debounce
  - Success criteria: Blind users hear "Ready to submit" or "Remove 2 words" without seeing screen
  - Estimated effort: 1h

---

## Phase 2: Submission Feedback & Confirmation (STRATEGIC) ✅ COMPLETE

**Rationale**: Instant transition from submit → waiting creates anxiety ("Did it work?"). Build submission confirmation pattern that provides closure + celebrates contribution.

- [x] **Create submission confirmation state in WritingScreen**
  - File: `components/WritingScreen.tsx` ✅
  - Add `const [submissionState, setSubmissionState] = useState<'idle' | 'submitting' | 'confirmed' | 'waiting'>('idle')` ✅
  - On submit success: Set to 'confirmed', wait 1500ms, then transition to 'waiting' ✅
  - Success criteria: Brief success state between submit and waiting screen ✅
  - Estimated effort: 1h | Actual: 20m
  - **Commit**: 693f17d

- [x] **Render submission confirmation UI**
  - File: `components/WritingScreen.tsx` ✅
  - Success card with checkmark + submitted line text ✅
  - Fade-in animation, displays during confirmed state ✅
  - Success criteria: Users see their submitted line echoed back, confirming receipt ✅
  - **Why strategic**: Creates closure pattern for all submission flows
  - Estimated effort: 1.5h | Actual: 10m
  - **Commit**: 2a6ce49

- [x] **Add stamp animation to submit button on success**
  - File: `components/ui/Button.tsx` ✅
  - Added `stampAnimate` prop that triggers animate-stamp class ✅
  - Button stamps in with rotation/scale when submission succeeds ✅
  - Success criteria: Tactile "hanko press" feedback on successful submission ✅
  - Estimated effort: 1h | Actual: 15m
  - **Commit**: 81fced4

---

## Phase 3: Loading State Deep Module (STRATEGIC) ✅ COMPLETE

**Rationale**: Generic "Loading..." or blank screens create doubt ("Is this working?"). Build contextual loading pattern that communicates system state clearly.

- [x] **Create loading state component system** ✅
  - File: `components/ui/LoadingState.tsx`
  - Accepts `message` prop (string) ✅
  - Renders: Pulsing persimmon dot + message in Libre Baskerville italic ✅
  - Deep module: Hides animation complexity, exposes semantic message ✅
  - Exports preset messages: `LoadingMessages.LOADING_ROOM`, `LoadingMessages.UNSEALING_POEMS`, etc. ✅
  - Success criteria: Single component for all contextual loading states ✅
  - Estimated effort: 1.5h | Actual: ~15m
  - **Commit**: 18463e0

- [x] **Replace WaitingScreen generic loading with contextual** ✅
  - File: `components/WaitingScreen.tsx`
  - Replaced dot spinner with `<LoadingState message={LoadingMessages.LOADING_ROOM} />` ✅
  - Success criteria: "Preparing your writing desk..." instead of anonymous dots ✅
  - Estimated effort: 15m | Actual: ~5m
  - **Commit**: 18308f0 (batched with other integrations)

- [x] **Replace RevealPhase generic loading with contextual** ✅
  - File: `components/RevealPhase.tsx`
  - Replaced "Loading..." with `<LoadingState message={LoadingMessages.UNSEALING_POEMS} />` ✅
  - Success criteria: Poetic language during poem loading ✅
  - Estimated effort: 15m | Actual: ~5m
  - **Commit**: 18308f0 (batched with other integrations)

- [x] **Add loading states to Host/Join pages (currently null)** ✅
  - File: `app/host/page.tsx`, `app/join/page.tsx`
  - Replaced `null` returns with LoadingState component ✅
  - Messages: "Setting up your room..." / "Joining the session..." ✅
  - Success criteria: No blank screens during data fetch ✅
  - Estimated effort: 30m | Actual: ~10m
  - **Commit**: 18308f0 (batched with other integrations)

---

## Phase 4: Strategic Simplification (REMOVE NOISE)

**Rationale**: Ousterhout principle — "Complexity is anything hard to understand or modify." Remove decorative elements that add visual weight without function. Every removal makes system clearer.

### 4.1 Home Page Simplification

- [ ] **Remove decorative border under title**
  - File: `app/page.tsx` lines 17-22
  - Delete entire `<div>` containing `═══════════`
  - Rationale: Title at 7xl/9xl has typographic authority alone. Border is fear of emptiness.
  - Success criteria: Title stands alone confidently
  - Estimated effort: 2m

- [ ] **Remove vertical Japanese text**
  - File: `app/page.tsx` lines 69-77
  - Delete entire right column div (4-col grid becomes 12-col single column)
  - Update grid: `grid grid-cols-12` → `max-w-4xl mx-auto`
  - Rationale: Trying to claim "Japaneseness" instead of embodying it. Emptiness is already Japanese.
  - Success criteria: Cleaner layout, faster mobile render (no hidden-then-shown desktop element)
  - Estimated effort: 5m

- [ ] **Remove button ink spread animations**
  - File: `app/page.tsx` lines 41-42, 52-53
  - Delete `<span className="absolute inset-0 bg-[var(--color-primary-hover)] transform -translate-x-full..."/>` layers
  - Keep only Button component's native hover states
  - Rationale: Competing with Button's perfect press mechanics. Duplicates existing hover system.
  - Success criteria: Single animation language per button (press mechanics only)
  - Estimated effort: 3m

### 4.2 Component Simplification

- [ ] **Remove RevealList border slide animation**
  - File: `components/RevealList.tsx` line 42
  - Delete `<div className="absolute top-0 left-0 w-full h-1 bg-[var(--color-primary)] transform -translate-x-full..."/>`
  - Keep shadow lift + translate up (2 effects max)
  - Rationale: 3 simultaneous hover effects is 2 too many. Border slide is slowest (500ms), conflicts with 300ms shadow/translate.
  - Success criteria: Hover feels responsive, not competing
  - Estimated effort: 2m

- [ ] **Remove QR code corner accents**
  - File: `components/RoomQr.tsx` lines 70-71
  - Delete both 10% opacity persimmon corner divs
  - Rationale: Material metaphor (rice paper slip) complete with border + shadow. 10% opacity = barely visible = unnecessary.
  - Success criteria: QR maintains washi paper metaphor without accent marks
  - Estimated effort: 2m

- [ ] **Remove Footer dagger ornament**
  - File: `components/Footer.tsx` line 37
  - Replace `<Ornament type="dagger" />` with vertical layout or simple `·` separator
  - Alternative: Stack "Archive" and "Est. 2025" vertically instead of horizontal separation
  - Rationale: Traditional editorial ornament feels dated. Could be simpler.
  - Success criteria: Cleaner footer without decorative filler
  - Estimated effort: 3m

- [ ] **Remove WritingScreen redundant quote marks**
  - File: `components/WritingScreen.tsx` line 105
  - Remove `&ldquo;` and `&rdquo;` around `{assignment.previousLineText}`
  - Keep italic + left accent bar
  - Rationale: Already has 4 visual markers (bar, card, shadow, italic). Quotes are 5th redundant marker.
  - Success criteria: Quotation signaled by bar + italic alone
  - Estimated effort: 1m

### 4.3 Delete Dead Code

- [ ] **Remove unused button-grow animation**
  - File: `app/globals.css` lines 249-264
  - Delete `@keyframes button-grow` and `.animate-button-grow` class
  - Search codebase for any usage: `grep -r "animate-button-grow"` (should be 0 results)
  - Rationale: Defined during exploration, never cleaned up. Zero instances in codebase.
  - Success criteria: 15 lines of CSS removed, no functionality lost
  - Estimated effort: 2m

- [ ] **Delete unused Divider component**
  - File: `components/ui/Divider.tsx`
  - Delete entire file (40 lines)
  - Replace usage in Footer with simple `<div className="w-24 h-px bg-[var(--color-border)] mx-auto" />`
  - Or remove entirely (footer link already establishes separation)
  - Rationale: 40 lines for decorative wave is shallow module (high complexity, low value)
  - Success criteria: Footer simplified, 40 lines deleted
  - Estimated effort: 5m

- [ ] **Audit and document unused Stamp variants**
  - File: `components/ui/Stamp.tsx`
  - Types: `'hanko' | 'sealed' | 'approved'`
  - Search usage: Only `'hanko'` used (Lobby host marker)
  - Decision: Keep sealed/approved for future use OR delete and add back when needed
  - Add JSDoc comment documenting future use if keeping
  - Success criteria: Either deleted (simpler) or documented intent (strategic)
  - Estimated effort: 10m

---

## Phase 5: Design System Documentation (STRATEGIC)

**Rationale**: Ousterhout — "Documentation belongs in code where it can't get out of sync." But high-level architectural decisions need separate documentation. Current system is 92/100 coherent but undocumented WHY.

- [ ] **Create design system documentation page**
  - File: `docs/design-system.md`
  - Sections:
    1. Philosophy (Japanese Editorial Minimalism, Kenya Hara, Ma)
    2. Color System (persimmon accent, warm neutrals, token structure)
    3. Typography (Libre Baskerville + IBM Plex Sans, why chosen, hierarchy rationale)
    4. Shadows (hard offset + persimmon tint, brutalist editorial aesthetic)
    5. Spacing (8/12/16/24 rhythm)
    6. Motion (mechanical timing, stamp/breathe/press metaphors)
    7. Intentional Breaks (QR code material metaphor, WritingScreen canvas textarea)
  - Success criteria: New developers understand design system rationale, not just API
  - **Why strategic**: Information hiding at system level. Preserves design intent as code evolves.
  - Estimated effort: 4h

- [ ] **Add architectural decision records to component docs**
  - Files: Update JSDoc in `components/ui/Button.tsx`, `components/Lobby.tsx`, `components/RoomQr.tsx`
  - Document WHY decisions made, not WHAT code does:
    - Button: Why Hanko press vs Washi compress per variant
    - Lobby: Why split-view information architecture
    - RoomQr: Why material metaphor overrides dark mode token usage
  - Follow existing pattern in RoomQr.tsx (lines 12-23) as template
  - Success criteria: Strategic decisions documented inline, readable by future maintainers
  - Estimated effort: 2h

---

## Phase 6: Polish & System Consolidation (STRATEGIC)

**Rationale**: System currently uses 6 different animation durations (75/150/250/300/400/500ms) without semantic meaning. Consolidate to token values for consistency.

- [ ] **Consolidate animation durations to design tokens**
  - Audit all `duration-*` and `transition-*` values across codebase
  - Map to tokens: `--duration-instant` (75ms), `--duration-fast` (150ms), `--duration-normal` (250ms)
  - Replace arbitrary values: 300ms → `--duration-normal`, 400ms → custom if ceremonial
  - Files affected: `app/page.tsx`, `components/RevealList.tsx`, possibly others
  - Success criteria: Only token values OR documented exceptional ceremonial timing (500ms+ for stamps)
  - Estimated effort: 2h

- [ ] **Reserve persimmon hover for primary actions only**
  - Audit all `hover:text-[var(--color-primary)]` uses
  - Keep: Primary buttons, main navigation
  - Remove: Footer metadata links, secondary archive links
  - Replace with: `hover:underline` or subtle opacity change
  - Rationale: Persimmon should signal "primary action", not decorate all links
  - Success criteria: Color hierarchy clearer (persimmon = important action)
  - Estimated effort: 2h

- [ ] **Audit and remove unused shadow tokens**
  - Search codebase for each shadow token usage
  - Found: `--shadow-xl` has 0 uses
  - Decision: Remove from `app/globals.css` OR document future use
  - Also audit: `--shadow-stamp` defined but stamp uses inline drop-shadow
  - Success criteria: Design tokens reflect actual system usage
  - Estimated effort: 1h

---

## Acceptance Criteria (System-Level)

**After all phases complete, verify:**

1. **Visibility**: First-time users don't ask "where do I type?" — input is obvious
2. **Feedback**: All errors explain what happened + how to fix (no silent failures)
3. **Confirmation**: Users KNOW their submission succeeded (not anxious during wait)
4. **Accessibility**: Keyboard navigation works, screen readers announce state changes, WCAG 2.1 AA compliant
5. **Simplification**: ~200 lines removed (decorations without function deleted)
6. **Documentation**: Design system rationale documented for future maintainers
7. **Aesthetic Unchanged**: Still minimalist, still elegant, still Japanese editorial (92/100 → 95/100)

---

## Estimated Total Effort

- **Phase 1** (Error Handling & Feedback): 8h estimated → ~5h actual ✅ COMPLETE (1 task remaining: live region)
- **Phase 2** (Submission Confirmation): 3.5h estimated → ~45m actual ✅ COMPLETE
- **Phase 3** (Loading States): 2.5h estimated → ~35m actual ✅ COMPLETE
- **Phase 4** (Simplification): 30 minutes
- **Phase 5** (Documentation): 6 hours
- **Phase 6** (Polish): 5 hours

**Total: ~25h estimated | ~6.5h actual for Phases 1-3 (74% faster than estimated)**
**Remaining: ~11.5h for Phases 4-6**

---

**Next Step**: Phase 4 (Strategic Simplification) — Remove decorative elements that add visual weight without function. Quick wins: ~30 minutes total estimated.
