# TODO: Aesthetic Refinement — Strategic UX & System Improvements

> **Philosophy**: Ousterhout strategic programming. Invest in deep modules, system design, and information hiding over tactical fixes. Make the implementation match the aesthetic ambition.

**Context**: Aesthetic review identified visual design excellence (92/100 system coherence) undermined by interaction gaps. Current state: "Confident minimalist gallery with one foot in workshop." Target: "Ceremonial space for collaborative creation."

**Strategic Goal**: Extend the same care shown in typography/color/spacing to feedback/states/errors. Make invisible interactions visible and kind.

---

## Phase 1: Error Handling & Feedback System (STRATEGIC) ✅ COMPLETE

**Rationale**: Currently, all errors use `console.error`, creating silent failures. Build deep module for user-facing error communication that hides network/mutation complexity behind simple, kind error messages. Establish accessibility patterns (WCAG 2.1 AA) for input visibility and screen reader support.

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

- [x] **Add live region for screen reader validation announcements** ✅
  - File: `components/WritingScreen.tsx`
  - Added ARIA live region with sr-only class ✅
  - useEffect with 500ms debounce to announce state changes ✅
  - Added sr-only utility class to globals.css ✅
  - Success criteria: Blind users hear "Ready to submit" or "Remove 2 words" without seeing screen ✅
  - Estimated effort: 1h | Actual: ~45m
  - **Commit**: 59fd5b5

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

- [x] **Remove decorative border under title** ✅
  - File: `app/page.tsx`
  - Deleted decorative border `═══════════` ✅
  - Success criteria: Title stands alone confidently ✅
  - Estimated effort: 2m | Actual: 2m
  - **Commit**: 6ae7b50 (batched with other home page simplifications)

- [x] **Remove vertical Japanese text** ✅
  - File: `app/page.tsx`
  - Deleted right column, simplified grid to `max-w-4xl mx-auto` ✅
  - Success criteria: Cleaner layout, faster mobile render ✅
  - Estimated effort: 5m | Actual: 3m
  - **Commit**: 6ae7b50 (batched with other home page simplifications)

- [x] **Remove button ink spread animations** ✅
  - File: `app/page.tsx`
  - Deleted ink spread span overlays from both buttons ✅
  - Success criteria: Single animation language per button (stamp mechanics only) ✅
  - Estimated effort: 3m | Actual: 3m
  - **Commit**: 6ae7b50 (batched with other home page simplifications)

### 4.2 Component Simplification

- [x] **Remove RevealList border slide animation** ✅
  - File: `components/RevealList.tsx`
  - Deleted border slide div, removed `relative overflow-hidden` ✅
  - Kept shadow lift + translate-y (2 effects max) ✅
  - Success criteria: Hover feels responsive, not competing ✅
  - Estimated effort: 2m | Actual: 2m
  - **Commit**: df910d0

- [x] **Remove QR code corner accents** ✅
  - File: `components/RoomQr.tsx`
  - Deleted 10% opacity persimmon corners, removed `relative overflow-hidden` ✅
  - Success criteria: QR maintains washi paper metaphor without accent marks ✅
  - Estimated effort: 2m | Actual: 2m
  - **Commit**: 6e89698 (batched with other component simplifications)

- [x] **Remove Footer dagger ornament** ✅
  - File: `components/Footer.tsx`
  - Replaced `<Ornament type="dagger" />` with simple `·` separator ✅
  - Success criteria: Cleaner footer without decorative filler ✅
  - Estimated effort: 3m | Actual: 2m
  - **Commit**: 6e89698 (batched with other component simplifications)

- [x] **Remove WritingScreen redundant quote marks** ✅
  - File: `components/WritingScreen.tsx`
  - Removed `&ldquo;` and `&rdquo;` around previous line text ✅
  - Success criteria: Quotation signaled by bar + italic alone ✅
  - Estimated effort: 1m | Actual: 1m
  - **Commit**: 6e89698 (batched with other component simplifications)

### 4.3 Delete Dead Code

- [x] **Remove unused button-grow animation** ✅
  - File: `app/globals.css`
  - Deleted @keyframes button-grow and .animate-button-grow (15 lines) ✅
  - Verified zero usage with grep ✅
  - Success criteria: 15 lines of CSS removed, no functionality lost ✅
  - Estimated effort: 2m | Actual: 2m
  - **Commit**: 470ca6d (batched with other dead code deletion)

- [x] **Delete unused Divider component** ✅
  - File: `components/ui/Divider.tsx`
  - Deleted entire file (40 lines), removed import from Footer ✅
  - Footer simplified without decorative SVG wave ✅
  - Success criteria: Footer simplified, 40 lines deleted ✅
  - Estimated effort: 5m | Actual: 3m
  - **Commit**: 470ca6d (batched with other dead code deletion)

- [x] **Audit and document unused Stamp variants** ✅
  - File: `components/ui/Stamp.tsx`
  - Removed unused 'approved' variant (YAGNI) ✅
  - Added JSDoc documenting 'hanko' and 'sealed' usage ✅
  - Noted removal for future reference ✅
  - Success criteria: Simplified + documented (strategic) ✅
  - Estimated effort: 10m | Actual: 5m
  - **Commit**: 470ca6d (batched with other dead code deletion)

---

## Phase 5: Design System Documentation (STRATEGIC)

**Rationale**: Ousterhout — "Documentation belongs in code where it can't get out of sync." But high-level architectural decisions need separate documentation. Current system is 92/100 coherent but undocumented WHY.

- [x] **Create design system documentation page** ✅
  - File: `docs/design-system.md` (577 lines)
  - All 7 sections complete with rationale for every decision ✅
  - Documents WHY (philosophy) not just WHAT (tokens) ✅
  - Intentional breaks documented to prevent "fixing" them ✅
  - Success criteria: New developers understand design system rationale, not just API ✅
  - **Why strategic**: Information hiding at system level. Preserves design intent as code evolves.
  - Estimated effort: 4h | Actual: ~2.5h
  - **Commit**: cb511c0

- [x] **Add architectural decision records to component docs** ✅
  - Files: Updated JSDoc in `components/ui/Button.tsx` (Lobby.tsx and RoomQr.tsx already had comprehensive docs)
  - Documented WHY decisions made, not WHAT code does:
    - Button: Why Hanko press (translate + shadow) vs Washi compress (scale) per variant ✅
    - Lobby: Why split-view information architecture (already documented, lines 14-41) ✅
    - RoomQr: Why material metaphor overrides dark mode token usage (already documented, lines 7-22) ✅
  - Followed existing pattern from RoomQr.tsx and Lobby.tsx
  - Success criteria: Strategic decisions documented inline, readable by future maintainers ✅
  - Estimated effort: 2h | Actual: ~20m (2 components already complete)
  - **Commit**: fad9941

---

## Phase 6: Polish & System Consolidation (STRATEGIC)

**Rationale**: System currently uses 6 different animation durations (75/150/250/300/400/500ms) without semantic meaning. Consolidate to token values for consistency.

- [x] **Consolidate animation durations to design tokens** ✅
  - Audited all `duration-*` and `transition-*` values across codebase ✅
  - Mapped to tokens: `--duration-instant` (75ms), `--duration-fast` (150ms), `--duration-normal` (250ms) ✅
  - Replaced arbitrary values: 300ms → `--duration-normal` (250ms) ✅
  - Files affected: ThemeToggle.tsx, RevealList.tsx, app/me/poems/page.tsx ✅
  - Documented ceremonial exceptions: PoemDisplay (800ms/1000ms reveal), globals.css (500ms stamp) ✅
  - Success criteria: All UI uses token values, ceremonial timing documented as intentional ✅
  - Estimated effort: 2h | Actual: ~25m (cleaner codebase than expected)
  - **Commit**: 06c0445

- [x] **Reserve persimmon hover for primary actions only** ✅
  - Audited all `hover:text-[var(--color-primary)]` uses (14 total) ✅
  - Kept: Header logo (primary nav), ThemeToggle, join/host "← Home" links (4 uses) ✅
  - Removed: Footer (2), RevealPhase, RevealList, app/page, poem pages (3), me/poems (2), me/profile (11 uses) ✅
  - Replaced with: `hover:underline` for text links, `hover:opacity-60` for icon buttons ✅
  - Rationale: Persimmon signals "primary action", not decorative hover ✅
  - Success criteria: Color hierarchy clearer (persimmon = important action) ✅
  - Estimated effort: 2h | Actual: ~15m (straightforward find-replace pattern)
  - **Commit**: 33a0783

- [~] **Audit and remove unused shadow tokens**
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
