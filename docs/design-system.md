# Linejam Design System

**Ink & Anticipation** — A Japanese Editorial Minimalist Design System

---

## 1. Philosophy

### Japanese Editorial Minimalism

Linejam's aesthetic draws from Japanese editorial design traditions—the restrained elegance of literary journals, the confident use of negative space in Muji catalogs, and the careful hierarchy of print layouts.

**Core Principles:**

1. **Ma (間) — The Space Between**
   - Emptiness is not absence but presence
   - Generous whitespace creates breathing room for content
   - Vertical rhythm guides the eye naturally
   - Content earns attention through placement, not decoration

2. **Ink on Rice Paper**
   - Warm neutrals evoke washi (rice paper) and sumi (ink)
   - Organic texture over clinical precision
   - Soft contrast honors readability over stark black-on-white
   - Material metaphor extends to shadows (ink bleed) and borders (paper edges)

3. **Persimmon Stamp — One Strong Accent**
   - Single vermillion accent (#e85d2b) like a hanko seal
   - Confident restraint: color signals action, not decoration
   - Reserved for primary interactions and host identity

4. **Vertical Hierarchy**
   - Mobile-first: portrait orientation is primary
   - Large display type establishes authority
   - Generous line-height for editorial breathing
   - Content stacks naturally without complex grids

**Design Influences:**

- **Kenya Hara**: Designer for Muji, author of "Designing Design" — emptiness as a quality, not a problem
- **Brutalist Editorial**: Hard shadows, confident typography, deliberate asymmetry
- **Literary Journals**: Generous margins, clear hierarchy, respect for reader's time

**Why This Matters:**

Most collaborative writing tools feel like Google Docs clones or Notion derivatives—sterile productivity interfaces. Linejam is a _ceremonial space_ for creative collaboration. The design should feel like opening a leather-bound journal, not launching a CRUD app.

---

## 2. Color System

### Rationale: Sumi & Persimmon

Traditional Japanese ink painting (sumi-e) uses minimal color: black ink on white paper, occasionally punctuated by vermillion seals. This restraint creates hierarchy without noise.

### Palette Structure

#### Primary — Persimmon Stamp (Japanese Hanko Seal)

```css
--color-primary: #e85d2b; /* Base: vermillion/persimmon */
--color-primary-hover: #c44521; /* Darker on interaction */
--color-primary-active: #a8391a; /* Darkest on press */
```

**Usage:**

- Primary action buttons (host game, submit line)
- Host marker stamp in lobby
- Focus rings and active states

**Never use for:**

- Body text (readability failure)
- Multiple elements simultaneously (loses hierarchy)
- Decorative accents (dilutes impact)

#### Base — Ink on Rice Paper

```css
--color-background: #faf9f7; /* Warm off-white (washi paper) */
--color-foreground: #1c1917; /* Deep warm black (sumi ink) */
--color-surface: #ffffff; /* True white for cards */
```

**Why warm neutrals:**

- Clinical white (#fff) feels sterile, digital
- Warm off-white (#faf9f7) evokes paper texture
- Deep warm black (#1c1917) instead of pure black reduces eye strain
- Creates organic feeling without literal texture overlays

#### Text Colors — Fading Ink

```css
--color-text-primary: #1c1917; /* Main content */
--color-text-secondary: #57534e; /* Supporting content */
--color-text-muted: #a8a29e; /* Metadata, labels */
--color-text-inverse: #faf9f7; /* Text on dark */
```

**Hierarchy:**

- Primary: poem lines, titles, core content
- Secondary: descriptions, explanations
- Muted: timestamps, labels, counts (uppercase + tracking)

#### State Colors

```css
--color-success: #10b981; /* Validation success */
--color-error: #ef4444; /* Errors, over-limit */
--color-warning: #f59e0b; /* Warnings */
--color-info: #0ea5e9; /* Informational */
```

**Why not custom state colors:**

- Accessibility: standard green/red/amber work for most users
- Familiarity: matches user expectations from other interfaces
- Color-blindness: combined with text ("Add 2 words"), not color-only

### Dark Mode

Dark mode inverts the ink-and-paper metaphor: white ink on black paper.

---

## 3. Typography

### Rationale: Editorial Authority + Technical Clarity

Poetry deserves editorial typography. Metadata deserves technical precision. Never mix the two.

### Font Families

```css
--font-display: 'Libre Baskerville', serif; /* Editorial */
--font-sans: 'IBM Plex Sans', sans-serif; /* Technical */
--font-mono: 'JetBrains Mono', monospace; /* Code/counts */
```

**Libre Baskerville (Display)**

- Transitional serif with high contrast
- Designed for body text but works at display sizes
- Elegant without being precious
- _Used for:_ Titles, poem lines, quoted text, anything poetic

**IBM Plex Sans (Body/UI)**

- Grotesque sans with subtle warmth
- Excellent legibility at small sizes
- Technical without being cold
- _Used for:_ Buttons, labels, descriptions, UI chrome

**JetBrains Mono (Monospace)**

- Clear distinction between characters (0 vs O, 1 vs l)
- Even spacing for word counts, room codes
- _Used for:_ Room codes, word counts, timestamps

### When to Use Each

| Element              | Font           | Why                             |
| -------------------- | -------------- | ------------------------------- |
| Page titles          | Display        | Establishes editorial authority |
| Poem lines           | Display italic | Honors creative content         |
| Previous line prompt | Display italic | Quotation context               |
| Button text          | Sans           | Clarity over elegance           |
| Labels (uppercase)   | Sans           | Technical precision             |
| Room codes           | Mono           | Disambiguation                  |
| Word counts          | Mono           | Tabular clarity                 |

### Type Scale — Poster Proportions

```css
--font-size-xs: 0.75rem; /* 12px - Fine print */
--font-size-sm: 0.875rem; /* 14px - Small labels */
--font-size-base: 1rem; /* 16px - Body text */
--font-size-lg: 1.25rem; /* 20px - Large body */
--font-size-xl: 1.5rem; /* 24px - Subheadings */
--font-size-2xl: 2rem; /* 32px - Section titles */
--font-size-3xl: 3rem; /* 48px - Page titles */
--font-size-4xl: 4rem; /* 64px - Hero text */
--font-size-5xl: 6rem; /* 96px - Home title (desktop) */
--font-size-6xl: 8rem; /* 128px - Reserved */
```

**Scale jumps are dramatic:**

- Mobile: 3xl-4xl for titles (48-64px)
- Desktop: 5xl-6xl for hero text (96-128px)
- Creates **poster-like** impact, not timid web typography

**Why not use Tailwind's default scale:**

- Default scale (text-xl = 20px, text-6xl = 60px) is too conservative
- We want **editorial drama**, not SaaS blandness

---

## 4. Shadows

### Rationale: Hard Graphic Offset + Persimmon Tint

Traditional Japanese woodblock prints use flat colors with hard edges—no gradients, no soft shadows. Modern brutalist editorial design embraces hard drop shadows as a graphic element, not faux-realism.

### Shadow System

```css
--shadow-color: 232 93 43; /* Persimmon RGB */

--shadow-sm: 2px 2px 0px rgba(var(--shadow-color) / 0.15);
--shadow-md: 4px 4px 0px rgba(var(--shadow-color) / 0.1);
--shadow-lg: 8px 8px 0px rgba(var(--shadow-color) / 0.12);

--shadow-active: 0px 0px 0px var(--color-border);
```

**Characteristics:**

- **Hard offset:** No blur, pure offset (2px, 4px, 8px)
- **Persimmon tint:** Shadows inherit brand color at low opacity
- **Graphic element:** Shadow is part of design, not faux-depth

**Usage:**

| Shadow   | When                       | Why                |
| -------- | -------------------------- | ------------------ |
| `sm`     | Cards, inputs              | Subtle elevation   |
| `md`     | Focused cards, hover state | Moderate elevation |
| `lg`     | Modals, popovers           | Clear hierarchy    |
| `active` | Button press state         | No shadow (press)  |

**Note on removed tokens:**

- `--shadow-xl`: Removed (0 uses, unnecessary fourth scale)
- `--shadow-stamp`: Removed (Stamp component uses inline drop-shadow for specificity)
- `--shadow-hover`: Removed (buttons use `--shadow-md` for hover)

**Hover/Active Pattern:**

Buttons transition from base shadow → `--shadow-md` on hover → `--shadow-active` (none) on press.

**Why not soft shadows:**

- Soft shadows (blur radius) create faux-realistic depth
- Hard shadows are **graphic**, **intentional**, **editorial**
- Aligns with brutalist aesthetic (confident, not apologetic)

---

## 5. Spacing

### Rationale: 8/12/16/24 Rhythm

Tailwind's default spacing scale (4px base) works for dense UIs. Editorial design needs more breathing room.

### Rhythm System

**Base unit: 8px** (Tailwind space-2)

Common multipliers:

- 12px (space-3): Tight grouping
- 16px (space-4): Related elements
- 24px (space-6): Section breaks
- 48px (space-12): Major breaks
- 96px (space-24): Chapter-level separation

**Why not custom scale:**

- Tailwind's scale is flexible enough
- Key is _choosing large values_, not redefining the system
- `space-12` (48px) is minimum for page-level breaks

### Vertical Rhythm

Mobile-first: stack with generous gaps.

```tsx
<div className="space-y-16">
  {' '}
  {/* 64px between major sections */}
  <h1>Title</h1>
  <div className="space-y-8">
    {' '}
    {/* 32px between related content */}
    <p>Tagline</p>
    <div className="space-y-4">
      {' '}
      {/* 16px between form elements */}
      <Button />
      <Button />
    </div>
  </div>
</div>
```

**Principle: Parent controls gaps**

- Use `space-y-*` on container, not margins on children
- Creates predictable rhythm
- Easy to adjust globally

---

## 6. Motion

### Rationale: Mechanical Timing, Metaphorical Animation

Animation should feel **mechanical**, not organic. We're not simulating physics—we're creating intentional transitions that respect user attention.

### Duration System

```css
--duration-instant: 75ms; /* Immediate feedback */
--duration-fast: 150ms; /* Quick transitions */
--duration-normal: 250ms; /* Standard */
```

**Usage:**

| Duration       | When           | Examples            |
| -------------- | -------------- | ------------------- |
| Instant (75ms) | Hover states   | Button color change |
| Fast (150ms)   | UI transitions | Dropdown open/close |
| Normal (250ms) | Content reveal | Card fade-in        |

**Ceremonial timing:** Some animations deserve slower timing to create ritual:

- Stamp animation: 500ms (tactile hanko press)
- Breathe animation: 6s (ambient breathing)

### Easing

```css
--ease-mechanical: cubic-bezier(0.25, 1, 0.5, 1);
```

**Why mechanical:**

- Not ease-in-out (too smooth, physics-like)
- Quick start, slower end (intentional, not natural)
- Feels like **operating a mechanism**, not watching gravity

### Animation Metaphors

1. **Stamp Press (Hanko)**
   - Button scales + rotates on success
   - 500ms duration for tactile satisfaction
   - Metaphor: Physical seal stamping ink

2. **Breathe (Ambient)**
   - Subtle scale/opacity pulse
   - 6s duration for calm rhythm
   - Used sparingly (not everything breathes)

3. **Fade-In-Up (Content Reveal)**
   - Opacity 0→1 + translate-y
   - 250ms duration
   - Content "rises" into view

**Never use:**

- Bounce (too playful for poetry)
- Elastic (too physics-based)
- Spin (disorienting, no metaphor)

---

## 7. Intentional Breaks

Good design systems have **intentional violations**—moments where the rules break for good reason. Document these to prevent "fixing" them.

### WritingScreen Canvas Textarea

**File:** `components/WritingScreen.tsx`

**The Break:**

```tsx
<textarea
  className="text-3xl md:text-4xl font-[var(--font-display)]"
  // Uses display font (Libre Baskerville) instead of sans
/>
```

**Why:**

- Poetry input deserves editorial typography
- User sees their line as it will appear in final poem
- Creates "writing in the poem" feeling, not "form input"

**Do not refactor to:**

- `font-[var(--font-sans)]` (loses poetic context)
- Smaller text (poetry needs visual weight)

### Stamp Variants

**File:** `components/ui/Stamp.tsx`

**The Break:**

- Hardcoded SVG shapes (circle vs square)
- Hardcoded text content (詩 character, SEALED label)
- No prop-based customization

**Why:**

- Only 2 variants needed (hanko, sealed)
- Adding `text` prop would encourage misuse (stamps are symbolic, not labels)
- Premature abstraction makes component harder to understand

**Do not refactor to:**

- Generic `<Icon>` component with text prop
- SVG icon library (stamps are metaphorically distinct)

### Icon Library Standard

**Library:** lucide-react

**Why lucide-react:**

- Industry-standard icon library (19.7k GitHub stars, battle-tested)
- Tree-shakeable: only imported icons add to bundle size
- Stroke-based design matches Japanese Editorial Minimalism aesthetic
- Easy icon swapping: change import instead of hunting SVG paths
- Consistent with design system philosophy

**Usage pattern:**

```tsx
import { Crown, Sun, Moon } from 'lucide-react';

<Crown className="w-4 h-4 text-[var(--color-primary)]" />;
```

**Components using lucide-react:**

- `HostBadge` (Crown icon)
- `ThemeToggle` (Sun/Moon icons)

**Do not:**

- Create inline SVG components (use lucide-react instead)
- Install additional icon libraries (maintain single standard)

### Host Badge Component

**File:** `components/ui/HostBadge.tsx`

**The Break:**

```tsx
<div
  role="status"
  aria-label="Room host"
  className="inline-flex items-center gap-2 px-2 py-1
             bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20
             dark:bg-[var(--color-primary)]/10 dark:border-[var(--color-primary)]/30"
>
  <Crown className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
  <span>HOST</span>
</div>
```

**Why:**

- Universal symbol (crown = authority) without cultural specificity
- Horizontal layout integrates better inline with player names
- Icon + text provides immediate clarity
- Badge is informational label, not ceremonial stamp
- Semantically distinct from submission stamps (sealed)
- Uses lucide-react Crown icon (professional, recognizable)

**Do not refactor to:**

- Extend Stamp component (different semantic meaning)
- Icon-only badge (reduces clarity)
- Full background fill (too prominent, violates "use accent sparingly")
- Custom SVG paths (use lucide-react for all icons)

---

## 8. Implementation Notes

### CSS Custom Properties in @theme

**Why @theme instead of :root:**

- Tailwind 4's `@theme` directive integrates with Tailwind utilities
- Allows `bg-[var(--color-primary)]` to work properly
- Generates CSS with proper specificity

### Font Loading

Fonts are loaded via next/font in `app/layout.tsx`:

```tsx
import {
  Libre_Baskerville,
  IBM_Plex_Sans,
  JetBrains_Mono,
} from 'next/font/google';
```

**Why Google Fonts:**

- Reliable CDN, good caching
- Self-hosting adds ~500KB to bundle
- Performance: subsetting via next/font optimizes

### Dark Mode Toggle

Dark mode uses `.dark` class (not system preference only):

```tsx
<html className={darkMode ? 'dark' : ''}>
```

**Why explicit class:**

- Allows user control (toggle in UI)
- Fallback to system preference via CSS media query
- More predictable than `prefers-color-scheme` alone

---

## 9. Future Considerations

### What NOT to Add

❌ **Color variants** (primary-light, primary-dark, etc.)

- Current system uses hover/active variants, sufficient
- More variants dilute brand hierarchy

❌ **Animation library** (Framer Motion, etc.)

- Current animations are CSS-based, performant
- Library adds 50KB+ for minimal benefit

❌ **Design token JSON export**

- Tokens live in CSS where they're used
- JSON export creates sync burden

### What MIGHT Be Needed

✅ **Prose component** for long-form text

- If adding FAQ, about page, blog posts
- Needs typographic rhythm distinct from UI

✅ **Loading skeleton pattern**

- Current loading states use text only
- Skeleton screens for image-heavy content

✅ **Toast/notification system**

- Current errors are inline only
- Global notifications for async actions

---

## 10. Maintenance

### When Updating Design Tokens

1. **Update `app/globals.css` first** (source of truth)
2. **Update this document** (rationale for changes)
3. **Search for hardcoded values** (grep for hex codes)
4. **Test dark mode** (tokens must work in both modes)

### When Adding Components

1. **Check existing patterns** before creating new variants
2. **Document intentional breaks** if violating system
3. **Use semantic tokens** (`--color-primary`, not `#e85d2b`)
4. **Follow font hierarchy** (display vs sans vs mono)

### When Reviewing PRs

Ask:

- "Does this honor Ma (negative space)?"
- "Is the accent color used sparingly?"
- "Does typography follow editorial hierarchy?"
- "Are animations mechanical, not organic?"

---

## Summary

Linejam's design system is a **strategic constraint**—not a collection of components, but a philosophy. Every choice serves the goal: creating a **ceremonial space** for collaborative poetry, not a productivity CRUD interface.

**Remember:**

- **Ma:** Emptiness is presence
- **Ink & Paper:** Warm, organic, editorial
- **One Accent:** Persimmon stamp, used sparingly
- **Hard Shadows:** Graphic, intentional, brutalist
- **Mechanical Motion:** Timing serves metaphor, not physics

When in doubt, ask: "Would this feel at home in a Japanese literary journal?" If not, reconsider.
