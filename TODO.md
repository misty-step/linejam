- [x] Refine aesthetic: cleaner, softer, more beautiful design

  ```
  Files:
  - app/globals.css:14-96 (design token definitions)
  - components/ui/Button.tsx:14-51 (variant styles)
  - components/ui/Card.tsx:9-15 (card base styles)
  - components/Lobby.tsx:32-119 (typography, spacing)
  - components/WritingScreen.tsx:64-141 (all UI elements)
  - components/WaitingScreen.tsx:23-72 (quote text)

  Pattern: Follow existing CSS variable system in globals.css, maintain brutalist aesthetic but soften

  Approach:
  1. Update color tokens in globals.css
     - Reduce primary saturation: oklch(0.5 0.22 25) → oklch(0.5 0.16 25)
     - Soften border color: oklch(0.15 0.02 260) → oklch(0.25 0.02 260)
     - Adjust shadows to be less stark
  2. Increase spacing in components
     - Button padding: px-5 → px-6 in Button.tsx:43-45
     - Card padding: p-6 → p-8 in relevant components
  3. Replace generic quotes with poetry-specific content
     - WaitingScreen.tsx:65-68 (find meaningful poetry quote)
  4. Soften hard edges
     - Increase border radius slightly: 2-4px → 3-6px in globals.css:72-75

  Success Criteria:
  - [ ] Colors feel warmer and less harsh (visual QA)
  - [ ] Spacing feels more generous (compare before/after)
  - [ ] Quotes are poetry-relevant and meaningful
  - [ ] Design maintains editorial/brutalist character while being softer

  Edge Cases:
  - Dark mode colors must maintain same softening
  - Accessibility contrast ratios must stay WCAG AA compliant

  NOT in Scope:
  - Complete design system overhaul
  - New fonts or typography scale
  - Animation timing changes (separate task)

  Estimate: 2h
  ```

- [x] Replace vague "imprints" terminology with clear, direct language

  ```
  Files:
  - components/WritingScreen.tsx:135 (button text)
  - components/WaitingScreen.tsx:32 (heading text)

  Pattern: Use simple, direct verbs throughout UI (see "Begin Session" in Lobby.tsx:96)

  Approach:
  1. Replace button text in WritingScreen.tsx:135
     - Change: "Stamp Line" → "Submit Line"
     - Change: "Imprinting..." → "Submitting..."
  2. Replace heading in WaitingScreen.tsx:29-32
     - Change: "Awaiting\nImprints" → "Awaiting\nSubmissions" or "Waiting for\nOther Poets"

  Success Criteria:
  - [ ] No mentions of "imprint" or "stamp" in user-facing text
  - [ ] All button/heading text is clear and obvious
  - [ ] Language matches poetry domain without being precious

  Edge Cases:
  - None - pure text replacement

  NOT in Scope:
  - Backend terminology (can keep internal naming)
  - Comments or variable names

  Estimate: 15m
  ```

- [x] Reduce room codes from 6 characters to 4 characters

  ```
  Files:
  - convex/rooms.ts:7-20 (generateRoomCode function)
  - lib/roomCode.ts:7-9 (formatRoomCode function)
  - Tests: may need to update any room code validation tests

  Pattern: Follow existing crypto.getRandomValues pattern in generateRoomCode

  Approach:
  1. Update generateRoomCode in convex/rooms.ts:9
     - Change: const codeLength = 6; → const codeLength = 4;
  2. Verify formatRoomCode still works correctly
     - 4 chars formats as "AB CD" (2 pairs)
     - Test with formatRoomCode("ABCD") to confirm
  3. Update collision check logic (optional)
     - 36^4 = 1,679,616 combinations
     - Collision probability with 1000 rooms ≈ 0.03% (acceptable)

  Success Criteria:
  - [ ] New rooms generate 4-char codes
  - [ ] Codes format correctly as "AB CD" in UI
  - [ ] Existing 6-char room codes still work (backward compat)
  - [ ] No increase in collision errors in logs

  Edge Cases:
  - Existing 6-char codes must continue working
  - formatRoomCode must handle both 4 and 6 char codes gracefully

  Dependencies:
  - None

  NOT in Scope:
  - Migrating existing 6-char codes to 4-char
  - Changing character set (keep A-Z0-9)

  Estimate: 30m
  ```

- [x] Reorganize reading phase: make user's poem primary focus

  ```
  Files:
  - components/RevealPhase.tsx:100-236 (entire layout)

  Pattern: Follow Lobby.tsx:32-119 two-column layout (1/3 left, 2/3 right)

  Approach:
  1. Swap column content in RevealPhase.tsx
     - Move "My Poem" card (lines 118-151) to right column (md:w-2/3)
     - Move "Poem Status" manifest (lines 192-234) to left column (md:w-1/3)
  2. Increase poem preview size
     - Text size: text-2xl → text-3xl for poem preview (line 126)
     - Button size already lg, keep as-is
  3. Update visual hierarchy
     - Remove border-2 emphasis from poem card (line 120)
     - Add more spacing around poem content
  4. Simplify status list styling
     - Make status indicators more subtle
     - Reduce padding/spacing to fit narrower column

  Success Criteria:
  - [ ] User's poem is visually dominant (right side, larger)
  - [ ] Poem status is visible but secondary (left side, smaller)
  - [ ] Layout feels balanced and intentional
  - [ ] Mobile view (single column) still works

  Edge Cases:
  - Long player names in status list must not overflow
  - When allRevealed=true, ensure host actions still visible

  NOT in Scope:
  - Changing PoemDisplay component behavior
  - Animation changes

  Estimate: 1h
  ```

- [x] Improve poem display: faster animation, left-align, prevent re-animation, better title

  ```
  Files:
  - components/PoemDisplay.tsx:15-75 (entire component)
  - components/RevealPhase.tsx:88-96 (track revealed state)

  Pattern: Follow existing animation system with useEffect + setTimeout

  Approach:
  1. Speed up animation in PoemDisplay.tsx:20
     - Change: 2000ms → 800ms
  2. Left-align poem text in PoemDisplay.tsx:38-56
     - Change: text-center → text-left in container (line 38)
     - Change: text-center → text-left in poem lines (implied by parent)
  3. Prevent re-animation on re-open
     - Add alreadyRevealed prop to PoemDisplay
     - If alreadyRevealed, set revealedCount to lines.length immediately
     - Skip setTimeout loop in useEffect
  4. Update title logic in PoemDisplay.tsx:30-35
     - Option A: Remove title entirely (delete div)
     - Option B: Use first line as title: {lines[0]?.split(' ').slice(0, 3).join(' ')}...
     - Recommended: Option A (cleaner)

  Success Criteria:
  - [ ] Animation completes in ~7 seconds for 9-line poem (800ms × 9)
  - [ ] Poem text is left-aligned
  - [ ] Re-opening same poem shows instantly (no animation)
  - [ ] Title is either removed or shows first line fragment

  Edge Cases:
  - Empty lines array → show loading state
  - Single-line poem → animation still works
  - Very long first line as title → truncate to ~3 words

  Dependencies:
  - Need to pass revealed state from RevealPhase to PoemDisplay

  NOT in Scope:
  - Different animation styles (fade, slide, etc)
  - Customizable animation speed

  Estimate: 1.5h
  ```
