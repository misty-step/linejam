# Premium Themes System

## Executive Summary

Build a robust theming system for Linejam with 3 carefully crafted themes that showcase distinct visual personalities. Font switching per theme, no FOUT, localStorage persistence. Quality over quantity—each theme polished to perfection.

**Inspiration**: [tweakcn](https://github.com/jnsahaj/tweakcn) architecture, simplified for 3 themes.

---

## User Context

**Who**: All Linejam players (guests and authenticated)
**Problem**: Every session looks identical; players want personality
**Benefit**: Express aesthetic preference, refresh experience

---

## Requirements

### Functional

1. **3 Themes**: Kenya (default), Mono, Vintage Paper
2. **Font Switching**: Each theme specifies display, sans, mono fonts
3. **Light/Dark per Theme**: Each has light and dark variants
4. **Persistence**: localStorage only (simple, instant, no sync complexity)
5. **No FOUC/FOUT**: Fonts bundled via next/font, theme applied before paint
6. **Preview Cards**: Mini visual preview before applying
7. **Ceremonial Transition**: 300ms crossfade on theme switch

### Non-Functional

1. **Performance**: Theme switch < 100ms, no layout shift
2. **Accessibility**: WCAG AA contrast, keyboard navigation, focus visible
3. **Maintainability**: Adding theme = ~4h (realistic estimate)

---

## Architecture

### Selected Approach: next/font + CSS Variable Bridge

```
┌─────────────────────────────────────────────────────────────────┐
│                    Theme Preset (TypeScript)                    │
│  Colors, fonts (references), shadows, radius, transitions       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ThemeProvider                              │
│  - Reads localStorage on mount                                  │
│  - Applies CSS variables to :root                               │
│  - Sets data-theme attribute                                    │
│  - Manages light/dark mode                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     app/layout.tsx                              │
│  All theme fonts loaded via next/font (bundled, no FOUT)        │
│  Blocking script applies theme before paint                     │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Approach

- **next/font**: All fonts bundled at build time, self-hosted, no FOUT
- **CSS variables**: Runtime switching without page reload
- **localStorage**: Instant load, works for guests, simple
- **No Convex**: Cuts complexity, cross-device sync not needed for themes

---

## Theme Data Model

```typescript
// lib/themes/types.ts

export interface ThemeColors {
  // Primary
  primary: string;
  primaryHover: string;
  primaryActive: string;

  // Base
  background: string;
  foreground: string;
  surface: string;
  surfaceHover: string;
  muted: string;

  // Borders
  border: string;
  borderSubtle: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Focus (accessibility)
  focusRing: string;

  // State (optional overrides)
  success?: string;
  error?: string;
  warning?: string;
  info?: string;
}

export interface ThemeFonts {
  // Reference to CSS variable name (set by next/font)
  display: string; // e.g., 'var(--font-libre-baskerville)'
  sans: string; // e.g., 'var(--font-ibm-plex)'
  mono: string; // e.g., 'var(--font-jetbrains-mono)'
}

export interface ThemeShadows {
  sm: string; // Full box-shadow value
  md: string;
  lg: string;
  drop?: string; // For SVG drop-shadow filter
}

export interface ThemeRadius {
  sm: string;
  md: string;
  lg: string;
  full: string;
}

export interface ThemeTransitions {
  instant: string; // 50-100ms
  fast: string; // 100-200ms
  normal: string; // 200-400ms
  easing: string; // Theme-specific easing curve
}

export interface ThemeStyleProps {
  colors: ThemeColors;
  fonts: ThemeFonts;
  shadows: ThemeShadows;
  radius: ThemeRadius;
  transitions: ThemeTransitions;
}

export interface ThemePreset {
  id: string;
  label: string; // User-friendly: "Ink & Paper"
  description: string; // "Stark calligraphic simplicity"
  styles: {
    light: ThemeStyleProps;
    dark: ThemeStyleProps;
  };
}

export type ThemeId = 'kenya' | 'mono' | 'vintage-paper';
export type ThemeMode = 'light' | 'dark';
```

---

## Initial Theme Set (3 Themes)

| Theme               | Aesthetic                     | Fonts                             | Key Visual                   |
| ------------------- | ----------------------------- | --------------------------------- | ---------------------------- |
| **Kenya** (default) | Japanese Editorial Minimalism | Libre Baskerville + IBM Plex      | Persimmon stamps, warm paper |
| **Mono**            | Stark Calligraphic            | Noto Serif + Inter                | Pure black/white, no color   |
| **Vintage Paper**   | Aged Literary                 | Cormorant Garamond + Source Serif | Sepia tones, soft shadows    |

### Kenya (Default)

- Current design system extracted to preset
- Warm neutrals with brown undertones
- Persimmon accent (#e85d2b)
- Hard offset shadows with persimmon tint
- Subtle rounded corners

### Mono

- Pure black (#000) and white (#fff) only
- No accent color—grayscale hierarchy
- Sharp shadows (black on white, white on black)
- Zero radius (sharp corners)
- Fast, snappy transitions

### Vintage Paper

- Sepia-tinted neutrals
- Aged paper background
- Muted burgundy accent
- Soft blur shadows
- Rounded, friendly corners
- Slow, gentle transitions

---

## Implementation Phases

### Phase 1: Foundation (6-8 hours)

1. **Theme Types** (`lib/themes/types.ts`)
   - All interfaces defined above
   - Type-safe theme registry

2. **Font Setup** (`app/layout.tsx`)
   - Import all theme fonts via next/font
   - Each font gets its own CSS variable
   - All fonts in className (bundled)

   ```typescript
   import {
     Libre_Baskerville,
     IBM_Plex_Sans, // Kenya
     Noto_Serif,
     Inter, // Mono
     Cormorant_Garamond,
     Source_Serif_4, // Vintage
   } from 'next/font/google';
   ```

3. **Theme Presets** (`lib/themes/presets/`)
   - `kenya.ts` - Extract from current globals.css
   - `mono.ts` - Stark black/white
   - `vintage-paper.ts` - Warm sepia

4. **Theme Context** (`lib/themes/context.tsx`)
   - `ThemeProvider` component
   - `useTheme()` hook: `{ theme, setTheme, mode, setMode }`
   - CSS variable injection with 300ms transition
   - localStorage read/write

5. **Apply Theme Logic** (`lib/themes/apply.ts`)
   - Map ThemeStyleProps to CSS variables
   - Set `data-theme` attribute
   - Ceremonial crossfade transition

6. **Blocking Script** (`app/layout.tsx`)
   - Read theme + mode from localStorage before paint
   - Apply immediately to prevent FOUC

### Phase 2: UI + Polish (4-6 hours)

1. **Theme Selector** (`components/ThemeSelector.tsx`)
   - Grid of 3 preview cards
   - Current theme indicator (stamp/checkmark)
   - Click to apply (no save button)
   - Light/dark toggle per card

2. **Theme Preview Card** (`components/ThemePreview.tsx`)
   - Mini preview with theme colors/fonts applied inline
   - Shows: heading, body text, button sample
   - Active state glow

3. **Header Integration**
   - Add palette icon button next to theme toggle
   - Opens theme selector modal/dropdown
   - Accessible: keyboard nav, focus trap, escape to close

4. **Settings Page** (`app/me/profile/page.tsx`)
   - Secondary access point (theme selector embedded)

5. **Confirmation Feedback**
   - Toast: "[Theme name] applied ✓"
   - Or: Stamp animation on selected card

### Phase 3: Accessibility + Testing (2-3 hours)

1. **Contrast Validation**
   - Automated tests for all color combinations
   - WCAG AA (4.5:1 text, 3:1 UI)
   - Run in CI

2. **Keyboard Navigation**
   - Theme selector: Tab cycles cards, Enter selects
   - Escape closes modal
   - Focus trap in modal
   - Arrow keys between themes (roving tabindex)

3. **Screen Reader**
   - `role="radiogroup"` for theme selector
   - `aria-checked` on selected theme
   - `aria-live` announces theme change

4. **Visual Regression**
   - Playwright screenshots for each theme
   - Light and dark mode

---

## File Structure

```
lib/
  themes/
    types.ts              # TypeScript interfaces
    context.tsx           # ThemeProvider + useTheme
    apply.ts              # CSS variable injection
    presets/
      index.ts            # Theme registry
      kenya.ts
      mono.ts
      vintage-paper.ts

components/
  ThemeSelector.tsx       # Theme picker modal
  ThemePreview.tsx        # Mini preview card

app/
  layout.tsx              # Font imports + blocking script
  me/profile/page.tsx     # Settings integration
```

---

## CSS Variable Mapping

Theme presets map to these CSS variables:

```css
/* Colors */
--color-primary
--color-primary-hover
--color-primary-active
--color-background
--color-foreground
--color-surface
--color-surface-hover
--color-muted
--color-border
--color-border-subtle
--color-text-primary
--color-text-secondary
--color-text-muted
--color-text-inverse
--color-focus-ring

/* Typography */
--font-display
--font-sans
--font-mono

/* Shadows */
--shadow-sm
--shadow-md
--shadow-lg

/* Radius */
--radius-sm
--radius-md
--radius-lg
--radius-full

/* Transitions */
--duration-instant
--duration-fast
--duration-normal
--ease-theme
```

---

## Key Decisions

### 1. 3 Themes, Not 5-6

**Rationale**: Quality over quantity. Each theme polished to perfection. Can add more later based on user demand.

### 2. next/font (Static) Over Dynamic Loading

**Rationale**: No FOUT is non-negotiable for premium feel. ~150KB bundle cost for 6 fonts is acceptable.

### 3. localStorage Only (No Convex)

**Rationale**: Simplicity. Cross-device sync adds complexity without proportional user value. Guests and auth users get same experience.

### 4. Preview Cards Required

**Rationale**: Users need to see before committing. Reduces trial-and-error theme switching.

### 5. Ceremonial 300ms Transition

**Rationale**: Theme change should feel intentional, not jarring. Crossfade creates moment of transformation.

---

## Adding a New Theme Checklist

Realistic effort: ~4-5 hours

```markdown
1. [ ] Create theme preset file (1h)
   - Define all colors (light + dark = 30 values)
   - Reference font CSS variables
   - Define shadows, radius, transitions

2. [ ] Import fonts if new (30m)
   - Add next/font imports to layout.tsx
   - Add variables to className string

3. [ ] Register theme (5m)
   - Add to ThemeId union type
   - Export from presets/index.ts

4. [ ] Accessibility audit (2h)
   - Run contrast checker on all combinations
   - Verify focus ring visibility
   - Test keyboard navigation

5. [ ] Add preview card styling (30m)
   - Ensure ThemePreview renders correctly

6. [ ] Visual regression (30m)
   - Add Playwright screenshots
   - Verify no layout breaks
```

---

## Error Handling

### Font Loading

All fonts bundled via next/font—no runtime loading errors possible.

### localStorage Failures

```typescript
try {
  localStorage.setItem('theme', themeId);
} catch (e) {
  // Quota exceeded or private browsing
  // Theme still applied in memory, just won't persist
  console.warn('Could not save theme preference');
}
```

### Invalid Theme in localStorage

```typescript
const stored = localStorage.getItem('theme');
const themeId = isValidThemeId(stored) ? stored : 'kenya';
```

---

## Risks & Mitigation

| Risk                         | Likelihood | Impact | Mitigation                         |
| ---------------------------- | ---------- | ------ | ---------------------------------- |
| Bundle size increase         | Medium     | Low    | ~150KB for 6 fonts, acceptable     |
| Theme contrast fails WCAG    | Medium     | High   | Automated contrast tests in CI     |
| Layout shift on theme switch | Low        | Medium | CSS variables only, no DOM changes |
| Users don't discover themes  | Medium     | Medium | Header button, not just settings   |

---

## Success Criteria

1. **Functional**: All 3 themes work with font switching
2. **Performance**: No FOUT, <100ms switch, no layout shift
3. **Accessibility**: All themes pass WCAG AA, keyboard navigable
4. **Quality**: Each theme feels intentional and cohesive
5. **Discoverability**: Users find themes within 10s of looking

---

## Test Scenarios

### Unit

- [ ] Theme context provides correct initial theme
- [ ] `setTheme()` updates CSS variables
- [ ] localStorage read/write works
- [ ] Invalid theme falls back to Kenya

### Integration

- [ ] Theme survives page refresh
- [ ] Dark mode toggle works within each theme
- [ ] Theme selector shows all 3 themes
- [ ] Preview cards render correctly

### Accessibility

- [ ] All themes pass axe automated checks
- [ ] Contrast ≥4.5:1 for text, ≥3:1 for UI
- [ ] Focus ring visible in all themes
- [ ] Keyboard: Tab, Enter, Escape work
- [ ] Screen reader announces theme changes

### Visual

- [ ] Playwright screenshots for each theme (light + dark)
- [ ] No FOUC on initial load
- [ ] 300ms crossfade on theme switch

---

## Next Steps

1. Run `/architect` to generate implementation pseudocode
2. Run `/execute` to implement Phase 1
