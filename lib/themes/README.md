# lib/themes/

Premium theme system with CSS variable injection and system preference detection.

## Usage

```tsx
import { ThemeProvider, useTheme } from '@/lib/themes';

// In layout
<ThemeProvider>{children}</ThemeProvider>;

// In components
const { themeId, mode, setTheme, setModePreference } = useTheme();
```

## Architecture

| File          | Purpose                  |
| ------------- | ------------------------ |
| `index.ts`    | Barrel export (use this) |
| `types.ts`    | TypeScript types         |
| `schema.ts`   | Theme validation         |
| `registry.ts` | Theme registration       |
| `apply.ts`    | CSS variable injection   |
| `context.tsx` | React context + hooks    |
| `presets/`    | Theme definitions        |

## Adding a Theme

1. Create `presets/mytheme.ts` using `defineTheme()`
2. Import in `registry.ts` and add to `themeArray`

Themes auto-register via derived exports.
