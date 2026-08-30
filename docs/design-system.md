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
   - A single vermillion accent supports the action and focus roles
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

### Identity and appearance modes

**Ink & Anticipation** is Linejam's single fixed visual identity. It is not a collection of interchangeable skins: only the color mode changes. The supported preferences are **Light**, **Dark**, and **System**.

`lib/design/tokens.ts` is the source of truth for the complete Light and Dark token sets. `lib/colorMode/` owns the mode-only API (`ColorModeProvider`, `useColorMode`, `setModePreference`, `applyColorMode`, and `getAppliedColorMode`) and persists the preference under `linejam-theme-mode`. `ColorModeControl` is the sole appearance control; System follows `prefers-color-scheme`.

---

## 2. Color System

### Rationale: Sumi & Persimmon

Traditional Japanese ink painting (sumi-e) uses minimal color: black ink on white paper, occasionally punctuated by vermillion seals. This restraint creates hierarchy without noise.

### Palette Structure

#### Action and focus — Persimmon Stamp

The action token (`--color-primary`) and focus token (`--color-focus-ring`) are intentionally distinct. Action color identifies a primary operation; focus color makes keyboard focus and active states visible.

```css
/* Light */
--color-primary: #b43a12; /* Action */
--color-primary-hover: #c44521;
--color-primary-active: #a8391a;
--color-focus-ring: #e85d2b; /* Focus */

/* Dark */
--color-primary: #f06b3b; /* Action */
--color-primary-hover: #f06b3b;
--color-primary-active: #e86b3b;
--color-focus-ring: #e85d2b; /* Focus */
```

**Usage:**

- `--color-primary`: primary action buttons (host game, submit line) and the host marker stamp in the lobby
- `--color-focus-ring`: focus rings (keyboard focus and focus-within states)

**Never use action color for:**

- Body text (readability failure)
- Focus indication (use the dedicated focus token)
- Multiple decorative elements simultaneously (loses hierarchy)

#### Base — Ink on Rice Paper

The core surfaces invert by effective color mode while preserving the ink-and-paper metaphor:

```css
/* Light */
--color-background: #faf9f7; /* Warm off-white (washi paper) */
--color-foreground: #1c1917; /* Deep warm black (sumi ink) */
--color-surface: #ffffff; /* True white for cards */

/* Dark */
--color-background: #1c1917; /* Near-black paper */
--color-foreground: #faf9f7; /* White ink */
--color-surface: #292524; /* Warm dark card */
```

**Why warm neutrals:**

- Clinical white (#fff) feels sterile, digital
- Warm off-white (#faf9f7) evokes paper texture
- Deep warm black (#1c1917) instead of pure black reduces eye strain
- Creates organic feeling without literal texture overlays

#### Text Colors — Fading Ink

```css
/* Light */
--color-text-primary: #1c1917; /* Main content */
--color-text-secondary: #57534e; /* Supporting content */
--color-text-muted: #5f5f5f; /* Metadata, labels */
--color-text-inverse: #faf9f7; /* Text on dark */

/* Dark */
--color-text-primary: #faf9f7; /* Main content */
--color-text-secondary: #d6d3d1; /* Supporting content */
--color-text-muted: #b0b0b0; /* Metadata, labels */
--color-text-inverse: #1c1917; /* Text on light */
```

**Hierarchy:**

- Primary: poem lines, titles, core content
- Secondary: descriptions, explanations
- Muted: timestamps, labels, counts (uppercase + tracking)

#### State Colors

```css
/* Light */
--color-success: #18794e; /* Validation success */
--color-error: #b42318; /* Errors, over-limit */
--color-warning: #8a5a00; /* Warnings */
--color-info: #075985; /* Informational */

/* Dark */
--color-success: #10b981; /* Validation success */
--color-error: #f87171; /* Errors, over-limit */
--color-warning: #f59e0b; /* Warnings */
--color-info: #0ea5e9; /* Informational */
```

**Why not custom state colors:**

- Accessibility: standard green/red/amber work for most users
- Familiarity: matches user expectations from other interfaces
- Color-blindness: combined with text ("Add 2 words"), not color-only

### Light, Dark, and System

Light and Dark each apply a complete token set. System resolves to Light or Dark from `prefers-color-scheme`; it is a preference, not a third token set. `ColorModeControl` calls `useColorMode` from `lib/colorMode/`, and `setModePreference` accepts only `'light'`, `'dark'`, or `'system'`.

The mode owner persists the preference under `COLOR_MODE_STORAGE_KEY` (`linejam-theme-mode`) and applies tokens through `applyColorMode`. There is no identity picker or theme registry.

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
--text-xs: 0.75rem; /* 12px - Fine print */
--text-sm: 0.875rem; /* 14px - Small labels */
--text-base: 1rem; /* 16px - Body text */
--text-md: 1.125rem; /* 18px - Large body */
--text-lg: 1.333rem; /* 21px - Subheadings */
--text-xl: 1.777rem; /* 28px - Section titles */
--text-2xl: 2.369rem; /* 38px - Feature titles */
--text-3xl: 3.157rem; /* 50px - Page titles */
--text-4xl: 4.209rem; /* 67px - Hero text */
--text-5xl: 5.61rem; /* 90px - Home title (desktop) */
```

**Scale jumps are dramatic:**

- Mobile: `text-3xl`–`text-4xl` for titles (about 50–67px)
- Desktop: `text-5xl` for hero text (about 90px)
- Creates **poster-like** impact, not timid web typography

**Why not use Tailwind's default scale:**

- The runtime scale in `lib/design/tokens.ts` is intentionally editorial rather than conservative
- We want **editorial drama**, not SaaS blandness

---

## 4. Shadows

### Rationale: Hard Graphic Offset + Persimmon Tint

Traditional Japanese woodblock prints use flat colors with hard edges—no gradients, no soft shadows. Modern brutalist editorial design embraces hard drop shadows as a graphic element, not faux-realism.

### Shadow System

```css
--shadow-color: 232 93 43; /* Persimmon RGB */

/* Light */
--shadow-sm: 2px 2px 0px rgba(232, 93, 43, 0.15);
--shadow-md: 4px 4px 0px rgba(232, 93, 43, 0.1);
--shadow-lg: 8px 8px 0px rgba(232, 93, 43, 0.12);

/* Dark */
--shadow-sm: 2px 2px 0px rgba(232, 93, 43, 0.2);
--shadow-md: 4px 4px 0px rgba(232, 93, 43, 0.15);
--shadow-lg: 8px 8px 0px rgba(232, 93, 43, 0.18);
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
- `--shadow-stamp`: Removed (the success animation uses `animate-stamp` from `app/globals.css`)
- `--shadow-hover`: Removed (buttons use `--shadow-md` for hover)

**Hover/Active Pattern:**

Buttons transition from base shadow → `--shadow-md` on hover → no shadow on press. The active state has no separate design token.

**Why not soft shadows:**

- Soft shadows (blur radius) create faux-realistic depth
- Hard shadows are **graphic**, **intentional**, **editorial**
- Aligns with brutalist aesthetic (confident, not apologetic)

---

## 5. Spacing

### Rationale: 4/8/16/24 Rhythm with Editorial Jumps

Tailwind's default spacing scale (4px base) works for dense UIs. Editorial design needs more breathing room, so the runtime tokens retain a compact start and large page-level jumps.

### Rhythm System

The runtime spacing tokens in `lib/design/tokens.ts` are:

- `space-1`: 4px
- `space-2`: 8px (base unit)
- `space-3`: 16px
- `space-4`: 24px
- `space-5`: 40px
- `space-6`: 64px
- `space-7`: 96px
- `space-8`: 144px

Choose the larger values for page-level breaks; the key is choosing generous gaps rather than redefining the scale.

**Why not custom scale:**

- Tailwind's scale is flexible enough
- Key is _choosing large values_, not redefining the system
- The runtime values are centralized in `lib/design/tokens.ts`

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
--duration-slow: 400ms; /* Deliberate transitions */
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
--ease-standard: cubic-bezier(0.25, 1, 0.5, 1);
--ease-in: cubic-bezier(0.25, 0.1, 0.25, 1);
--ease-out: cubic-bezier(0.25, 1, 0.5, 1);
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
import { Crown, Monitor, Moon, Sun } from 'lucide-react';

<Crown className="w-4 h-4 text-[var(--color-primary)]" />;
```

**Components using lucide-react:**

- `HostBadge` (Crown icon)
- `ColorModeControl` (Sun/Moon/Monitor icons)

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

- Extend `StampAnimation` (different semantic meaning)
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

Fonts are loaded through `@fontsource` imports in `app/globals.css`; `lib/design/tokens.ts` maps the semantic font tokens to those families:

```css
@import '@fontsource/libre-baskerville/latin-400.css';
@import '@fontsource/libre-baskerville/latin-700.css';
@import '@fontsource/ibm-plex-sans/latin-400.css';
@import '@fontsource/ibm-plex-sans/latin-500.css';
@import '@fontsource/jetbrains-mono/latin-400.css';
```

**Why local font imports:**

- The app loads the exact Libre Baskerville, IBM Plex Sans, and JetBrains Mono families it uses
- CSS loading keeps typography available without a runtime font API
- The semantic `font-display`, `font-sans`, and `font-mono` tokens keep usage consistent

### Color Mode API

`ColorModeProvider` applies the effective token set, while `ColorModeControl` exposes the only appearance preference:

```tsx
const { modePreference, mode, setModePreference } = useColorMode();
setModePreference('light'); // 'light' | 'dark' | 'system'
```

`mode` is always the effective `light` or `dark` set. `system` follows `prefers-color-scheme`, and `applyColorMode(mode)` updates the root CSS variables and effective mode class. The preference is persisted under `COLOR_MODE_STORAGE_KEY` (`linejam-theme-mode`).

---

## 9. Future Considerations

### What NOT to Add

❌ **Additional visual identities or skin registries**

- Ink & Anticipation is the only identity
- Light, Dark, and System are the only appearance preferences; mode-specific tokens are sufficient

❌ **Animation library** (Framer Motion, etc.)

- Current animations are CSS-based, performant
- Library adds 50KB+ for minimal benefit

❌ **Design token JSON export**

- Tokens live in TypeScript at `lib/design/tokens.ts`; CSS variables are the runtime bridge
- A second JSON representation creates sync burden

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

1. **Update `lib/design/tokens.ts` first** (source of truth)
2. **Keep `app/globals.css` as the CSS variable bridge**
3. **Update this document** (rationale for changes)
4. **Search for hardcoded values** (grep for hex codes)
5. **Verify Light, Dark, and System** (both effective token sets and system resolution)

### When Adding Components

1. **Check existing patterns** before creating new variants
2. **Document intentional breaks** if violating system
3. **Use semantic tokens** (`--color-primary` for actions, `--color-focus-ring` for focus)
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

- **Identity:** Ink & Anticipation, one fixed visual language
- **Modes:** Light, Dark, and System only
- **Action vs focus:** `--color-primary` drives actions; `--color-focus-ring` marks focus
- **Ink & Paper:** Warm, organic, editorial
- **Persimmon stamp:** One accent, used sparingly
- **Hard Shadows:** Graphic, intentional, brutalist
- **Mechanical Motion:** Timing serves metaphor, not physics

When in doubt, ask: "Would this feel at home in a Japanese literary journal?" If not, reconsider.
