# ADR-0006: Theme System via CSS Custom Properties

## Status

Accepted

## Context

Linejam wanted multiple visual themes (Kenya minimalism, brutalist mono, vintage paper, cyberpunk). Requirements:

- Instant theme switching (no page reload)
- Light/dark mode support per theme
- SSR-compatible (no flash of unstyled content)
- Type-safe theme tokens
- Easy to add new themes

## Decision

### Architecture

```
lib/themes/
  types.ts        - ThemeId, ThemeTokens, ThemePreset types
  schema.ts       - defineTheme() helper with validation
  registry.ts     - Central theme registration point
  apply.ts        - CSS variable injection
  context.tsx     - React context and useTheme hook
  presets/
    kenya.ts      - Default theme (Japanese editorial minimalism)
    mono.ts       - Brutalist monochrome
    vintage-paper.ts - Aged paper texture
    hyper.ts      - Cyberpunk neon
```

### Token System

Each theme defines ~60 tokens for both light and dark modes:

- Colors: primary, background, foreground, surface, borders, text variants
- Typography: font families, sizes (modular scale), line heights, letter spacing
- Shadows: with theme-tinted colors
- Spacing: consistent scale
- Transitions: timing and easing

Tokens are applied as CSS custom properties:

```css
:root {
  --color-primary: #e85d2b;
  --font-display: var(--font-libre-baskerville);
  --text-lg: 1.333rem;
}
```

### SSR Handling

- Theme ID stored in localStorage
- Blocking script in `<head>` reads localStorage and applies theme class before first paint
- Prevents flash of wrong theme

### Type Safety

```typescript
type ThemeTokens = {
  'color-primary': string;
  'color-background': string;
  // ... all tokens required
};

function defineTheme(preset: ThemePreset): ThemePreset;
```

`defineTheme()` validates that all required tokens are present at runtime.

## Consequences

**Positive:**

- Zero JS for theme changes after initial load (pure CSS)
- Type-safe token definitions catch missing tokens at dev time
- Adding new theme: create preset file, add to registry array
- Dark mode is per-theme (some themes may have different dark palettes)

**Negative:**

- ~60 CSS variables per theme (acceptable overhead)
- All themes bundled (no lazy loading, but themes are small)
- Tailwind integration requires @theme directive (Tailwind 4 specific)

**Design Philosophy:**
Each theme has a coherent philosophy documented in its preset file (e.g., Kenya theme references Ma concept, persimmon seal accent, Perfect Fourth typographic scale).
