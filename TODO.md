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

---

## Aesthetic Evolution: Brutalist Editorial Maximalism

Based on comprehensive aesthetic audit - transforming from "good minimalism" to "unmistakably intentional design" by executing the stated "Japanese Editorial Minimalism" philosophy more boldly.

### Critical Fixes

- [x] Add missing semantic color tokens to design system

  ````
  Files:
  - app/globals.css:14-42 (@theme color definitions)
  - app/globals.css:101-116 (dark mode overrides)

  Pattern: Follow existing CSS custom property pattern with light/dark variants

  Context: --color-success and --color-error are referenced in 4 files (WritingScreen.tsx:79, join/page.tsx:101) but NOT defined in @theme, causing fallback to browser defaults and breaking visual consistency.

  Approach:
  1. Add state color tokens to @theme in globals.css after line 42:
     ```css
     /* State Colors */
     --color-success: #10b981;  /* Green-600 for validation */
     --color-error: #ef4444;    /* Red-600 for errors */
     --color-warning: #f59e0b;  /* Amber-600 for warnings */
     --color-info: #0ea5e9;     /* Sky-600 for info */
  ````

  2. Add dark mode overrides in :root.dark section after line 115:
     ```css
     --color-success: #10b981;
     --color-error: #ef4444;
     --color-warning: #f59e0b;
     --color-info: #0ea5e9;
     ```

  Success criteria: All color references resolve to design tokens, no browser fallbacks. Word counter in WritingScreen shows green when valid, red when over count. Error messages in join page use consistent error color.

  Edge Cases:
  - Dark mode colors may need slight adjustments for WCAG AA contrast
  - Existing usages must not break (verify WritingScreen, join page)

  Dependencies: None

  NOT in Scope:
  - Creating Alert component (separate task)
  - Updating all error messages app-wide

  Estimate: 15m

  ```

  ```

- [x] Create Label component for editorial typography pattern

  ````
  Files:
  - components/ui/Label.tsx (new file)

  Pattern: Follow Button.tsx:1-56 forwardRef pattern with variant prop

  Context: The label pattern `text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]` appears 24 times across 11 files. This is the most duplicated UI pattern in the codebase. Extracting it enables typography updates to propagate instantly.

  Approach:
  1. Create components/ui/Label.tsx with:
     ```tsx
     import { HTMLAttributes, forwardRef } from 'react';
     import { cn } from '@/lib/utils';

     interface LabelProps extends HTMLAttributes<HTMLParagraphElement> {
       variant?: 'default' | 'accent';
     }

     export const Label = forwardRef<HTMLParagraphElement, LabelProps>(
       ({ className, variant = 'default', ...props }, ref) => {
         return (
           <p
             ref={ref}
             className={cn(
               'text-xs font-mono uppercase tracking-widest',
               {
                 'text-[var(--color-text-muted)]': variant === 'default',
                 'text-[var(--color-primary)]': variant === 'accent',
               },
               className
             )}
             {...props}
           />
         );
       }
     );

     Label.displayName = 'Label';
  ````

  2. Export from components/ui/index.ts (if exists) or use direct imports

  Success criteria: Component renders with default muted color. Variant="accent" shows persimmon color. Accepts all standard p element props. forwardRef works for parent ref access. className prop merges correctly.

  Edge Cases:
  - Must accept children (text content)
  - Must support as={} prop for semantic HTML if needed (h6, span, etc.) - add in future iteration

  Dependencies: None (can be created independently)

  NOT in Scope:
  - Migration of existing 24 instances (separate tasks)
  - Additional variants beyond default/accent

  Estimate: 30m

  ```

  ```

- [x] Migrate high-traffic components to Label component (Phase 1: Game Flow)

  ````
  Files:
  - components/WritingScreen.tsx:68, 100, 115 (3 instances)
  - components/WaitingScreen.tsx:28, 46 (2 instances)
  - components/Lobby.tsx:36 (1 instance)
  - components/RevealPhase.tsx:116 (1 instance)

  Pattern: Import Label, replace <p className="text-xs font-mono..."> with <Label>

  Context: These 7 instances are in the core game flow screens (Lobby → WritingScreen → WaitingScreen → RevealPhase). Migrating these first has highest visibility impact.

  Approach:
  1. Add import to each file: `import { Label } from '../ui/Label';`
  2. Replace each instance:
     ```tsx
     // Before:
     <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
       Label Text
     </p>

     // After:
     <Label>Label Text</Label>

     // For accent variant (primary color):
     <Label variant="accent">Label Text</Label>
  ````

  3. Keep any additional className props by passing them through

  Success criteria: All 7 labels render identically to before. No visual regressions. TypeScript compiles without errors. Label text remains readable in light and dark modes.

  Edge Cases:
  - WritingScreen.tsx:68 has "Contribution" label - check if accent variant needed
  - Some labels may have additional classes (mb-2, etc.) - preserve these
  - Verify mobile responsive behavior unchanged

  Dependencies:
  - Requires Label component created first

  NOT in Scope:
  - Other 17 label instances (covered in Phase 2)
  - Changing label text content

  Estimate: 45m

  ```

  ```

- [x] Migrate utility and static pages to Label component (Phase 2: Complete Coverage)

  ```
  Files:
  - components/RoomQr.tsx:19 (1 instance)
  - app/join/page.tsx:63 (1 instance)
  - app/host/page.tsx:63 (1 instance)
  - app/me/poems/page.tsx:38, 88 (2 instances)
  - app/me/profile/page.tsx:25, 40, 53, 78 (4 instances)
  - app/poem/[id]/page.tsx:51 (1 instance)
  - components/RevealList.tsx:30 (1 instance)

  Pattern: Same as Phase 1 - import Label, replace className string

  Context: Remaining 11 instances in lower-traffic pages. Completing migration achieves 100% label consistency and eliminates duplication.

  Approach:
  1. Add Label import to each file
  2. Replace label pattern with <Label> component
  3. Preserve any page-specific styling via className prop
  4. Run visual QA on each page to verify no regressions

  Success criteria: All 24 label instances migrated. Grep search for "text-xs font-mono uppercase tracking-widest" only finds definition in Label.tsx. No visual differences from before. All pages render correctly in light/dark modes.

  Edge Cases:
  - Profile page has 4 instances - verify vertical spacing consistent
  - Some labels may be in flex containers - ensure alignment preserved
  - Check mobile breakpoints on poems archive page

  Dependencies:
  - Requires Label component created
  - Should complete after Phase 1 for risk reduction

  NOT in Scope:
  - Refactoring non-label text elements
  - Changing label content or semantics

  Estimate: 1h
  ```

- [x] Create Alert component for inline error handling

  ````
  Files:
  - components/ui/Alert.tsx (new file)

  Pattern: Follow Card.tsx:1-64 composition pattern with variant styling

  Context: Error messages currently use either browser alert() (breaks aesthetic) or duplicated inline divs with border/background styling. Need consistent, reusable error display component.

  Approach:
  1. Create components/ui/Alert.tsx:
     ```tsx
     import { HTMLAttributes, forwardRef } from 'react';
     import { cn } from '@/lib/utils';

     interface AlertProps extends HTMLAttributes<HTMLDivElement> {
       variant?: 'error' | 'success' | 'warning' | 'info';
     }

     export const Alert = forwardRef<HTMLDivElement, AlertProps>(
       ({ className, variant = 'info', children, ...props }, ref) => {
         return (
           <div
             ref={ref}
             role="alert"
             className={cn(
               'p-4 border text-sm rounded-[var(--radius-sm)]',
               {
                 'border-[var(--color-error)] bg-[var(--color-error)]/5 text-[var(--color-error)]':
                   variant === 'error',
                 'border-[var(--color-success)] bg-[var(--color-success)]/5 text-[var(--color-success)]':
                   variant === 'success',
                 'border-[var(--color-warning)] bg-[var(--color-warning)]/5 text-[var(--color-warning)]':
                   variant === 'warning',
                 'border-[var(--color-info)] bg-[var(--color-info)]/5 text-[var(--color-info)]':
                   variant === 'info',
               },
               className
             )}
             {...props}
           >
             {children}
           </div>
         );
       }
     );

     Alert.displayName = 'Alert';
  ````

  Success criteria: Component renders with correct border/background for each variant. role="alert" announces to screen readers. Text color has sufficient contrast (WCAG AA). Works in light and dark modes.

  Edge Cases:
  - Empty children - should still render container
  - Long error messages - text should wrap
  - Dark mode - 5% opacity backgrounds must be visible

  Dependencies:
  - Requires semantic color tokens added first

  NOT in Scope:
  - Dismissible alerts with close button
  - Icon support (save for future iteration)
  - Auto-dismiss timers

  Estimate: 30m

  ```

  ```

- [x] Replace browser alert() with Alert component in WritingScreen

  ````
  Files:
  - components/WritingScreen.tsx:22-61 (error state handling)

  Pattern: Follow join/page.tsx:71-75, 100-104 inline error display pattern

  Context: WritingScreen.tsx:59 uses alert('Failed to submit line') which breaks the zen editorial aesthetic with ugly browser modal. Need graceful inline error display.

  Approach:
  1. Add error state: `const [error, setError] = useState<string | null>(null);`
  2. Import Alert component
  3. Update catch block in handleSubmit (line 57-60):
     ```tsx
     catch (error) {
       captureError(error, { roomCode, poemId: assignment.poemId });
       setIsSubmitting(false);
       setError('Failed to submit line. Please try again.');
     }
  ````

  4. Render Alert above submit button (around line 128):
     ```tsx
     {
       error && (
         <Alert variant="error" className="mb-4">
           {error}
         </Alert>
       );
     }
     ```
  5. Clear error on successful submit or text change

  Success criteria: Failed submit shows red inline error instead of alert(). Error clears when user types. Error announces to screen readers. Maintains editorial aesthetic. No layout shift when error appears.

  Edge Cases:
  - Rapid submissions - prevent multiple error states stacking
  - Network timeout - error message should be clear
  - Mobile keyboard - error should be visible above keyboard

  Dependencies:
  - Requires Alert component created
  - Requires semantic color tokens

  NOT in Scope:
  - Other alert() instances (RevealPhase, host/join pages)
  - Error retry logic
  - Network error classification

  Estimate: 30m

  ```

  ```

### High-Impact Visual Changes

- [x] Create Stamp component for ink seal graphics

  ````
  Files:
  - components/ui/Stamp.tsx (new file)

  Pattern: Custom SVG component with rotation and shadow effects

  Context: The "Persimmon Stamp" design philosophy is stated but not visually executed. Need actual hanko (Japanese seal) graphics to appear on state transitions, executing the ink metaphor.

  Approach:
  1. Create components/ui/Stamp.tsx with three stamp types:
     ```tsx
     import { cn } from '@/lib/utils';

     interface StampProps {
       type: 'hanko' | 'sealed' | 'approved';
       size?: 'sm' | 'md' | 'lg';
       className?: string;
     }

     const sizeClasses = {
       sm: 'w-8 h-8',
       md: 'w-12 h-12',
       lg: 'w-16 h-16',
     };

     export function Stamp({ type, size = 'md', className }: StampProps) {
       return (
         <div
           className={cn(
             'inline-block transform rotate-[-5deg]',
             'filter drop-shadow-[3px_3px_8px_rgba(232,93,43,0.4)]',
             sizeClasses[size],
             className
           )}
           aria-hidden="true"
         >
           {type === 'hanko' && <HankoSVG />}
           {type === 'sealed' && <SealedSVG />}
           {type === 'approved' && <ApprovedSVG />}
         </div>
       );
     }

     // SVG subcomponents with red ink styling:
     function HankoSVG() {
       return (
         <svg viewBox="0 0 100 100" fill="none">
           <circle cx="50" cy="50" r="45"
             fill="var(--color-primary)"
             opacity="0.9"
           />
           <text x="50" y="65"
             textAnchor="middle"
             fontSize="40"
             fontFamily="serif"
             fill="var(--color-text-inverse)"
             fontWeight="bold"
           >
             詩
           </text>
         </svg>
       );
     }

     function SealedSVG() {
       return (
         <svg viewBox="0 0 100 100" fill="none">
           <rect x="10" y="10" width="80" height="80"
             fill="var(--color-primary)"
             opacity="0.9"
           />
           <text x="50" y="40"
             textAnchor="middle"
             fontSize="16"
             fontFamily="monospace"
             fill="var(--color-text-inverse)"
           >
             SEALED
           </text>
         </svg>
       );
     }

     function ApprovedSVG() {
       return (
         <svg viewBox="0 0 100 100" fill="none">
           <circle cx="50" cy="50" r="45"
             fill="var(--color-primary)"
             opacity="0.9"
           />
           <path d="M30 50 L45 65 L75 35"
             stroke="var(--color-text-inverse)"
             strokeWidth="8"
             strokeLinecap="round"
             strokeLinejoin="round"
             fill="none"
           />
         </svg>
       );
     }
  ````

  Success criteria: Three stamp variants render with rotation, shadow, and ink aesthetic. Size variants scale correctly. Stamps feel like rubber stamp impressions (slight rotation, ink spread shadow). Work in light and dark modes.

  Edge Cases:
  - SVG text must render on Safari/Firefox (test font fallbacks)
  - Japanese character (詩 = poetry) must display correctly
  - Shadow must be visible but not overwhelming

  Dependencies: None

  NOT in Scope:
  - Animation on stamp appearance (add in separate task)
  - Additional stamp types
  - Stamp click interactions

  Estimate: 1.5h

  ```

  ```

- [x] Add stamp graphics to WaitingScreen sealed lines

  ````
  Files:
  - components/WaitingScreen.tsx:39-62 (sealed lines list)

  Pattern: Add decorative element next to "[SEALED]" text

  Context: WaitingScreen shows which lines are sealed with "[SEALED]" text. Adding actual stamp graphic reinforces the ink metaphor and makes sealed state more visually distinct.

  Approach:
  1. Import Stamp component
  2. Replace or augment "[SEALED]" text (line 55) with:
     ```tsx
     <div className="flex items-center gap-2">
       <span className="font-mono text-xs text-[var(--color-text-muted)]">
         SEALED
       </span>
       <Stamp type="sealed" size="sm" />
     </div>
  ````

  3. Ensure stamp doesn't break responsive layout
  4. Add subtle fade-in animation when stamp appears

  Success criteria: Sealed lines show small red stamp next to text. Stamp appears when line is sealed. Layout doesn't shift when stamp renders. Mobile view maintains readable spacing.

  Edge Cases:
  - Long player names - ensure stamp doesn't get pushed off screen
  - Rapid sealing - stamps should appear smoothly
  - Dark mode - stamp shadow must be visible

  Dependencies:
  - Requires Stamp component created first

  NOT in Scope:
  - Stamp animation choreography
  - Different stamp types for different players

  Estimate: 30m

  ```

  ```

- [x] Add hanko stamp to host badge in Lobby

  ````
  Files:
  - components/Lobby.tsx:79-83 (host badge)

  Pattern: Replace or augment "Host" text badge with hanko stamp

  Context: The host badge currently shows "Host" in a border. Adding a hanko stamp with Japanese character creates editorial authority and reinforces the ink aesthetic.

  Approach:
  1. Import Stamp component
  2. Update host badge (line 79-83) to show stamp + text:
     ```tsx
     {player.userId === room.hostUserId && (
       <div className="flex items-center gap-2">
         <Stamp type="hanko" size="sm" />
         <span className="text-xs font-mono uppercase tracking-wider border border-[var(--color-primary)] text-[var(--color-primary)] px-2 py-1">
           Host
         </span>
       </div>
     )}
  ````

  3. Alternatively, replace text entirely with just stamp for minimalism

  Success criteria: Host has distinctive visual marker combining stamp + text OR just stamp. Stamp is visible but doesn't overwhelm player name. Layout works on mobile. Clear which player is host.

  Edge Cases:
  - Small screens - stamp + text may be too wide, consider stamp-only
  - Multiple hosts (edge case) - each should get stamp
  - Self vs other host - no distinction needed

  Dependencies:
  - Requires Stamp component created

  NOT in Scope:
  - Hover states on stamp
  - Tooltip explaining host role

  Estimate: 20m

  ```

  ```

- [x] Create Ornament component for typographic decorations

  ````
  Files:
  - components/ui/Ornament.tsx (new file)

  Pattern: Simple functional component returning decorative character

  Context: Editorial typography uses ornaments (fleurons, daggers, section marks) as decorative dividers. Replace boring " · " separators with characterful editorial marks.

  Approach:
  1. Create components/ui/Ornament.tsx:
     ```tsx
     import { cn } from '@/lib/utils';

     interface OrnamentProps {
       type: 'dagger' | 'section' | 'fleuron' | 'asterism';
       className?: string;
     }

     const ornaments = {
       dagger: '†',
       section: '§',
       fleuron: '❦',
       asterism: '⁂',
     };

     export function Ornament({ type, className }: OrnamentProps) {
       return (
         <span
           className={cn(
             'inline-block px-2 text-[var(--color-text-muted)]',
             className
           )}
           aria-hidden="true"
         >
           {ornaments[type]}
         </span>
       );
     }
  ````

  2. Export from ui/index.ts

  Success criteria: Four ornament types render correctly. Unicode characters display on all browsers. Color matches muted text. Horizontal padding creates breathing room. aria-hidden prevents screen reader announcement.

  Edge Cases:
  - Font support - characters must render (system fonts should support these)
  - Vertical alignment - may need align-middle depending on font
  - RTL languages - spacing may need adjustment (not in scope)

  Dependencies: None

  NOT in Scope:
  - Animated ornaments
  - Color variations
  - Size variations

  Estimate: 20m

  ```

  ```

- [x] Replace footer separators with Ornament components

  ````
  Files:
  - app/page.tsx:119 (footer separator " · ")
  - app/poem/[id]/page.tsx (if footer exists)

  Pattern: Replace <span>·</span> with <Ornament type="dagger" />

  Context: Footer currently uses " · " which is generic. Using typographic ornaments adds editorial character and reinforces print aesthetic.

  Approach:
  1. Import Ornament component in app/page.tsx
  2. Replace line 119 separator:
     ```tsx
     // Before:
     <span>·</span>

     // After:
     <Ornament type="dagger" />
  ````

  3. Verify visual spacing - may need to adjust Ornament padding
  4. Check other pages with separators and replace consistently

  Success criteria: Footer separators use dagger ornament. Spacing feels natural. Ornament color matches surrounding text. No layout shift from before.

  Edge Cases:
  - Mobile footer - ensure ornament doesn't get too small
  - Long text items - wrapping should still work
  - Dark mode - ornament must be visible

  Dependencies:
  - Requires Ornament component created

  NOT in Scope:
  - Changing footer content
  - Different ornament types for different contexts (could vary later)

  Estimate: 15m

  ```

  ```

- [x] Enhance shadows with persimmon color tint

  ````
  Files:
  - app/globals.css:79-86 (shadow definitions)

  Pattern: Replace current shadow tokens with color-tinted versions

  Context: Current shadows use grayscale `var(--color-border)` which feels cold. Adding persimmon tint creates warmth and reinforces the ink stamp metaphor.

  Approach:
  1. Update shadow tokens in @theme section (lines 79-86):
     ```css
     /* Before: */
     --shadow-sm: 2px 2px 0px var(--color-border);
     --shadow-md: 4px 4px 0px var(--color-border);
     --shadow-lg: 8px 8px 0px var(--color-border);
     --shadow-xl: 12px 12px 0px var(--color-border);

     /* After: */
     --shadow-sm: 2px 2px 0px rgba(232, 93, 43, 0.15);
     --shadow-md: 4px 4px 0px rgba(232, 93, 43, 0.1);
     --shadow-lg: 8px 8px 0px rgba(232, 93, 43, 0.12);
     --shadow-xl: 12px 12px 0px rgba(232, 93, 43, 0.08);

     /* Add new: */
     --shadow-stamp: 3px 3px 8px rgba(232, 93, 43, 0.4);
  ````

  2. Keep --shadow-hover and --shadow-active unchanged (they work with button press)
  3. Test shadows on light and dark backgrounds

  Success criteria: Shadows show subtle warm persimmon tint. Cards and buttons feel warmer, more organic. Shadows are still subtle (not overwhelming). Dark mode shadows remain visible. No WCAG contrast issues.

  Edge Cases:
  - Dark mode - may need separate dark mode shadow definitions
  - Very light backgrounds - ensure shadows still visible
  - Print styles - shadows may need to be removed for printing

  Dependencies: None

  NOT in Scope:
  - Changing shadow sizes/offsets
  - Adding blur to shadows (keep hard edges for brutalism)

  Estimate: 15m

  ```

  ```

- [x] Implement asymmetric homepage layout with vertical label

  ````
  Files:
  - app/page.tsx:34-92 (main content section)
  - app/globals.css (add vertical text utility if needed)

  Pattern: Follow asymmetric grid layouts from editorial/magazine design

  Context: Homepage currently uses centered card layout which is AI default. Moving title to top-left, adding vertical Japanese label, and breaking symmetry creates distinctive visual identity.

  Approach:
  1. Replace centered layout with 12-column grid in main (line 34):
     ```tsx
     <main className="flex-grow grid grid-cols-12 gap-8 p-6 md:p-12 lg:p-24">
       {/* Left: Title & Actions (8 cols on desktop) */}
       <div className="col-span-12 md:col-span-8 space-y-16">
         <div className="space-y-3">
           <h1 className="text-7xl md:text-9xl font-[var(--font-display)] font-bold leading-[0.85] text-[var(--color-text-primary)]">
             Linejam
           </h1>
           {/* Keep decorative border or replace with brush stroke */}
           <div className="text-[var(--color-text-muted)] text-sm tracking-[0.2em]" aria-hidden="true">
             ═══════════════════
           </div>
         </div>
         {/* Rest of content: tagline, buttons, archive link */}
       </div>

       {/* Right: Vertical Label (4 cols on desktop, hidden on mobile) */}
       <div className="hidden md:flex md:col-span-4 justify-end items-center">
         <div
           className="text-sm font-mono tracking-[0.3em] text-[var(--color-text-muted)] opacity-60"
           style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
         >
           詩的共同創作
         </div>
       </div>
     </main>
  ````

  2. Adjust spacing and sizing for asymmetric balance
  3. Test mobile responsive (single column)

  Success criteria: Title is top-left aligned on desktop, not centered. Vertical Japanese text appears on right side (desktop only). Layout feels intentional, not accidental. Mobile view (single column) still works. Japanese characters render correctly.

  Edge Cases:
  - Mobile - vertical label hidden, layout stacks normally
  - Wide screens - right label doesn't drift too far from content
  - Safari - vertical text support (should work with writingMode CSS)
  - Font support - 詩的共同創作 characters must render

  Dependencies: None

  NOT in Scope:
  - Translating existing English text to Japanese
  - Adding brush stroke SVG (can be future enhancement)
  - Parallax effects

  Estimate: 1.5h

  ```

  ```

- [x] Implement staggered asymmetric poem reveal

  ````
  Files:
  - components/PoemDisplay.tsx:36-56 (poem lines rendering)

  Pattern: Editorial layout with alternating alignment and drop cap

  Context: Poem reveal currently uses uniform center-aligned lines. Asymmetric alignment creates visual rhythm and reinforces editorial aesthetic. Drop cap on first line adds print magazine character.

  Approach:
  1. Update line rendering logic (lines 38-56) with asymmetric alignment:
     ```tsx
     <div className="space-y-6 flex flex-col">
       {lines.map((line, index) => {
         const isVisible = index < revealedCount;
         const isFirst = index === 0;

         // Alternate alignment: left, center, right
         const alignment =
           index % 3 === 0 ? 'text-left' :
           index % 3 === 1 ? 'text-center' :
           'text-right';

         return (
           <div
             key={index}
             className={cn(
               'transition-all duration-800 transform',
               alignment,
               isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
             )}
           >
             {isFirst && (
               <span className="float-left text-8xl pr-4 leading-none text-[var(--color-primary)] font-[var(--font-display)]">
                 {line[0]}
               </span>
             )}
             <p className={cn(
               'font-[var(--font-display)] leading-tight text-[var(--color-text-primary)]',
               isFirst ? 'text-5xl' : 'text-3xl md:text-4xl lg:text-5xl'
             )}>
               {isFirst ? line.slice(1) : line}
             </p>
           </div>
         );
       })}
     </div>
  ````

  2. Add ink stamp ornament after line 5 (between stanzas):
     ```tsx
     {
       index === 4 && (
         <div className="flex justify-center py-4">
           <Ornament type="asterism" />
         </div>
       );
     }
     ```

  Success criteria: First line has drop cap in persimmon color. Lines alternate left/center/right alignment. Visual rhythm feels intentional. Stagger animation (800ms) still works. Mid-poem ornament creates visual break. Mobile view remains readable.

  Edge Cases:
  - Single-character first word - drop cap still works
  - Empty first line - handle gracefully (no drop cap)
  - Very long lines - wrapping should preserve alignment
  - Mobile - may need different alignment pattern (all left?)

  Dependencies:
  - Ornament component if adding mid-poem separator

  NOT in Scope:
  - Different font sizes based on line position
  - Varying stagger timing
  - Parallax scroll effects

  Estimate: 2h

  ```

  ```

### Micro-Animations & Delight

- [x] Implement Ink Stamp Press animation

  ````
  Files:
  - components/ui/Button.tsx:14-51 (active press state)
  - app/globals.css (add keyframe animation)

  Pattern: Scale transform on active press with radial ripple effect

  Context: "Start a Game" and "Join a Room" buttons need visceral tactile feedback. Button should compress like rubber stamp pressing into paper, with ink-like ripple emanating from press point.

  Approach:
  1. Add keyframe animation to globals.css:
     ```css
     @keyframes ink-ripple {
       0% {
         box-shadow: 0 0 0 0 rgba(232, 93, 43, 0.4);
       }
       100% {
         box-shadow: 0 0 0 20px rgba(232, 93, 43, 0);
       }
     }
     ```
  2. Update Button.tsx active state (line 43):
     ```tsx
     'active:scale-[0.97] active:translate-y-[2px]',
     'active:animate-[ink-ripple_0.6s_ease-out]',
     ```
  3. Ensure animation plays once per click (not on hold)

  Success criteria: Button compresses to 97% scale on active press. Radial ripple expands outward like ink spreading. Animation completes in 600ms. Works on touch and mouse events. No jank or layout shift.

  Edge Cases:
  - Rapid clicks - each click should trigger new ripple
  - Long press - ripple plays once, not continuously
  - Mobile - touch feedback clear despite smaller target

  Dependencies:
  - Requires --color-primary defined in globals.css

  NOT in Scope:
  - Click coordinates for ripple origin (uniform radial is fine)
  - Different ripple colors per variant

  Estimate: 45m

  ```

  ```

  ````

- [x] Implement Shadow Crushing animation

  ````
  Files:
  - components/ui/Button.tsx:14-51 (shadow state transitions)
  - app/globals.css:79-86 (shadow tokens)

  Pattern: Hard brutalist shadow compresses to zero on active press

  Context: Current buttons have `active:shadow-none` which is instant. Need smooth crushing animation where hard 2px/2px shadow compresses to 0px/0px, reinforcing the stamp pressing metaphor.

  Approach:
  1. Add transition property to Button base styles (line 42):
     ```tsx
     'transition-all duration-[var(--duration-fast)]',
     'hover:shadow-[var(--shadow-md)]',
     'active:shadow-none',
     ```
  2. Ensure --duration-fast (150ms) creates smooth crush
  3. Test with different shadow sizes (sm, md, lg variants)

  Success criteria: Shadow smoothly compresses from full size to zero in 150ms. Feels like paper pressing onto surface. No pop or jump. Works with all button variants. Combined with scale animation creates unified stamp press feel.

  Edge Cases:
  - Dark mode - shadow must be visible before crushing
  - Disabled state - no shadow crush animation
  - Focus state - don't interfere with focus ring

  Dependencies:
  - Requires shadow tokens defined in globals.css
  - Works best combined with Ink Stamp Press animation

  NOT in Scope:
  - Elastic bounce back
  - Different crush speeds per button size

  Estimate: 30m

  ```

  ```

  ````

- [ ] Implement Persimmon Glow Pulse animation

  ````
  Files:
  - components/ui/Button.tsx:14-51 (hover state)
  - app/globals.css (add keyframe animation)

  Pattern: Subtle persimmon-tinted glow pulses around button on hover

  Context: Hover state needs more presence. Pulsing glow creates warm invitation to click while reinforcing persimmon accent color. Should be subtle, not overwhelming.

  Approach:
  1. Add keyframe animation to globals.css:
     ```css
     @keyframes persimmon-pulse {
       0%, 100% {
         box-shadow: 0 0 0 0 rgba(232, 93, 43, 0.0),
                     0 0 20px 0 rgba(232, 93, 43, 0.1);
       }
       50% {
         box-shadow: 0 0 0 4px rgba(232, 93, 43, 0.1),
                     0 0 30px 4px rgba(232, 93, 43, 0.15);
       }
     }
     ```
  2. Update Button.tsx hover state (line 41):
     ```tsx
     'hover:animate-[persimmon-pulse_2s_ease-in-out_infinite]',
     ```
  3. Apply only to primary variant (not secondary/ghost)

  Success criteria: Glow pulses slowly (2s cycle). Creates warm halo around button. Visible but not distracting. Stops on active press. Only applies to primary CTA buttons.

  Edge Cases:
  - Glow + shadow - must layer correctly (glow behind shadow)
  - Dark mode - glow should be more visible, may need brighter opacity
  - Reduced motion preference - disable pulse animation

  Dependencies:
  - Requires --color-primary
  - Should respect prefers-reduced-motion

  NOT in Scope:
  - Different glow colors per variant
  - Glow animation on focus (keep for hover only)

  Estimate: 40m

  ```

  ```

  ````

- [ ] Implement Typewriter Character Shift animation

  ````
  Files:
  - components/ui/Button.tsx:14-51 (text element within button)

  Pattern: Button text shifts vertically on hover/active for mechanical typewriter feel

  Context: Text should feel like typewriter keys striking paper. Subtle vertical shift on hover (preparing to strike) and larger shift on active (striking). Reinforces editorial print aesthetic.

  Approach:
  1. Wrap button children in span for targeted animation:
     ```tsx
     // In Button component render:
     <button className={buttonClasses} {...props}>
       <span className="inline-block transition-transform duration-[var(--duration-fast)] group-hover:-translate-y-[1px] group-active:translate-y-[2px]">
         {children}
       </span>
     </button>
     ```
  2. Use group/group-hover for parent button state
  3. Combine with existing button translations for additive effect

  Success criteria: Text lifts 1px on hover (anticipation). Text drops 2px on active (strike). Feels mechanical and deliberate. Doesn't interfere with button scale/shadow animations. Works with multi-line button text.

  Edge Cases:
  - Icons in buttons - should icons shift too? (yes, wrap all children)
  - Long text wrapping - each line shifts together
  - Disabled buttons - no shift animation

  Dependencies:
  - Requires group utilities from Tailwind

  NOT in Scope:
  - Horizontal text shift
  - Character-by-character stagger (too subtle)

  Estimate: 35m

  ```

  ```

  ````

- [ ] Implement Rotation Wiggle animation

  ````
  Files:
  - components/ui/Button.tsx:14-51 (hover state)
  - app/globals.css (add keyframe animation)

  Pattern: Button rotates ±0.5deg on hover, matching stamp -5deg rotation aesthetic

  Context: Stamps in the design system use -5deg rotation. Buttons should subtly wiggle on hover like stamps being positioned before pressing. Creates playful anticipation.

  Approach:
  1. Add keyframe animation to globals.css:
     ```css
     @keyframes stamp-wiggle {
       0%, 100% {
         transform: rotate(0deg);
       }
       25% {
         transform: rotate(-0.5deg);
       }
       75% {
         transform: rotate(0.5deg);
       }
     }
     ```
  2. Update Button.tsx hover state:
     ```tsx
     'hover:animate-[stamp-wiggle_0.8s_ease-in-out_infinite]',
     ```
  3. Ensure rotation doesn't conflict with scale/translate transforms
  4. Apply to primary buttons only

  Success criteria: Button wiggles ±0.5deg in 800ms cycle. Feels like stamp being positioned. Subtle and playful, not distracting. Stops on active press. Doesn't cause layout shift of surrounding elements.

  Edge Cases:
  - Transform composition - rotation must combine with scale/translate
  - Text readability - 0.5deg should not affect legibility
  - Mobile - may be too subtle on small screens, consider disabling

  Dependencies:
  - Must compose with other transform animations
  - Should respect prefers-reduced-motion

  NOT in Scope:
  - Different rotation degrees per button size
  - Direction variation (always ±0.5deg)

  Estimate: 40m

  ```

  ```

  ````

- [ ] Implement Ink Spread on Hover animation

  ````
  Files:
  - components/ui/Button.tsx:14-51 (hover background)
  - app/globals.css (add keyframe animation)

  Pattern: Radial gradient expands from center outward on hover like ink soaking into paper

  Context: Hover state needs background transition that feels organic. Radial gradient spreading creates ink-on-paper metaphor. Should be subtle, visible as darkening/lightening rather than color change.

  Approach:
  1. Add CSS custom property for hover gradient:
     ```css
     /* In @theme section of globals.css */
     --gradient-ink-spread: radial-gradient(
       circle at center,
       rgba(232, 93, 43, 0.08) 0%,
       rgba(232, 93, 43, 0.04) 50%,
       transparent 100%
     );
     ```
  2. Add keyframe animation:
     ```css
     @keyframes ink-spread {
       from {
         background-size: 0% 0%;
         background-position: center;
       }
       to {
         background-size: 200% 200%;
         background-position: center;
       }
     }
     ```
  3. Update Button.tsx hover state:
     ```tsx
     'relative overflow-hidden',
     'before:absolute before:inset-0 before:bg-[var(--gradient-ink-spread)]',
     'before:animate-[ink-spread_0.6s_ease-out] before:opacity-0',
     'hover:before:opacity-100',
     ```

  Success criteria: Gradient expands from button center on hover in 600ms. Creates subtle darkening/tinting effect. Feels like ink spreading. Doesn't obscure button text. Works with existing button backgrounds.

  Edge Cases:
  - Button variants - gradient tint may need adjustment per variant
  - Text contrast - ensure text remains WCAG AA compliant
  - Rapid hover on/off - animation should reset gracefully

  Dependencies:
  - Requires before: pseudo-element support
  - Must layer correctly with button content (z-index)

  NOT in Scope:
  - Click origin tracking for spread direction
  - Different spread speeds
  - Color variation per button variant (all use persimmon)

  Estimate: 1h

  ```

  ```
  ````
