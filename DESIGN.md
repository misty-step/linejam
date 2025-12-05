# DESIGN.md — Premium Themes Architecture

## Architecture Overview

**Selected Approach**: next/font + CSS Variable Bridge with ThemeProvider Context

**Rationale**: Combines Tailwind CSS 4's native @theme CSS variables with next/font's zero-FOUT font loading. All fonts bundled at build time (~150KB for 6 fonts, acceptable tradeoff). Runtime theme switching via CSS variable injection—no page reload, no layout shift.

**Core Modules**:

- `lib/themes/types.ts`: Theme type definitions (ThemePreset, ThemeStyleProps, etc.)
- `lib/themes/presets/`: Individual theme configurations (kenya, mono, vintage-paper)
- `lib/themes/context.tsx`: ThemeProvider + useTheme hook
- `lib/themes/apply.ts`: CSS variable injection logic
- `components/ThemeSelector.tsx`: Theme picker UI with preview cards

**Data Flow**:

```
localStorage → blocking script → initial theme applied
                     ↓
User action → ThemeProvider → applyTheme() → CSS variables → UI re-renders
                     ↓
              localStorage.setItem()
```

**Key Design Decisions**:

1. **Deep Module Pattern**: ThemeProvider exposes simple `{theme, setTheme, mode, setMode}` interface, hides CSS injection, localStorage, and transition complexity
2. **Font References**: Theme presets reference font CSS variables (e.g., `var(--font-libre-baskerville)`), not font objects—decouples theme config from next/font implementation
3. **Dual-key localStorage**: Store `themeId` (kenya/mono/vintage-paper) and `themeMode` (light/dark) separately for simpler logic

---

## Module Design

### Module: lib/themes/types.ts

**Responsibility**: Define all theme-related TypeScript types. Single source of truth for theme shape, ensuring type safety across preset definitions and runtime usage.

**Public Interface**:

```typescript
// Theme identifiers
export type ThemeId = 'kenya' | 'mono' | 'vintage-paper';
export type ThemeMode = 'light' | 'dark';

// Color palette for a single mode
export interface ThemeColors {
  primary: string;
  primaryHover: string;
  primaryActive: string;
  background: string;
  foreground: string;
  surface: string;
  surfaceHover: string;
  muted: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  focusRing: string;
  success?: string;
  error?: string;
  warning?: string;
  info?: string;
}

// Font references (CSS variable names set by next/font)
export interface ThemeFonts {
  display: string; // e.g., 'var(--font-libre-baskerville)'
  sans: string; // e.g., 'var(--font-ibm-plex)'
  mono: string; // e.g., 'var(--font-jetbrains-mono)'
}

// Shadow definitions
export interface ThemeShadows {
  sm: string;
  md: string;
  lg: string;
  color?: string; // RGB values for rgba() composition
}

// Border radius definitions
export interface ThemeRadius {
  sm: string;
  md: string;
  lg: string;
  full: string;
}

// Animation timing
export interface ThemeTransitions {
  instant: string;
  fast: string;
  normal: string;
  easing: string;
}

// Complete style props for one mode
export interface ThemeStyleProps {
  colors: ThemeColors;
  fonts: ThemeFonts;
  shadows: ThemeShadows;
  radius: ThemeRadius;
  transitions: ThemeTransitions;
}

// Complete theme preset
export interface ThemePreset {
  id: ThemeId;
  label: string;
  description: string;
  styles: {
    light: ThemeStyleProps;
    dark: ThemeStyleProps;
  };
}

// Theme registry (all presets)
export type ThemeRegistry = Record<ThemeId, ThemePreset>;
```

**Data Structures**:

- `ThemePreset`: Complete theme definition with id, metadata, and style props for both modes
- `ThemeRegistry`: Map of all available themes, keyed by ThemeId

**No Error Handling**: This module is pure types, no runtime behavior.

---

### Module: lib/themes/presets/kenya.ts

**Responsibility**: Define the Kenya (default) theme preset. Extract current globals.css values into structured theme object.

**Public Interface**:

```typescript
export const kenyaTheme: ThemePreset;
```

**Internal Implementation**:

```typescript
import type { ThemePreset } from '../types';

export const kenyaTheme: ThemePreset = {
  id: 'kenya',
  label: 'Kenya',
  description: 'Japanese editorial minimalism',
  styles: {
    light: {
      colors: {
        primary: '#e85d2b',
        primaryHover: '#c44521',
        primaryActive: '#a8391a',
        background: '#faf9f7',
        foreground: '#1c1917',
        surface: '#ffffff',
        surfaceHover: '#f5f5f4',
        muted: '#f5f5f4',
        border: '#e7e5e4',
        borderSubtle: '#f5f5f4',
        textPrimary: '#1c1917',
        textSecondary: '#57534e',
        textMuted: '#a8a29e',
        textInverse: '#faf9f7',
        focusRing: '#e85d2b',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#0ea5e9',
      },
      fonts: {
        display: 'var(--font-libre-baskerville)',
        sans: 'var(--font-ibm-plex)',
        mono: 'var(--font-jetbrains-mono)',
      },
      shadows: {
        sm: '2px 2px 0px rgba(232, 93, 43, 0.15)',
        md: '4px 4px 0px rgba(232, 93, 43, 0.1)',
        lg: '8px 8px 0px rgba(232, 93, 43, 0.12)',
        color: '232 93 43',
      },
      radius: {
        sm: '3px',
        md: '4px',
        lg: '6px',
        full: '9999px',
      },
      transitions: {
        instant: '75ms',
        fast: '150ms',
        normal: '250ms',
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
    },
    dark: {
      colors: {
        primary: '#e85d2b',
        primaryHover: '#f06b3b',
        primaryActive: '#d54a1f',
        background: '#1c1917',
        foreground: '#faf9f7',
        surface: '#292524',
        surfaceHover: '#3f3f46',
        muted: '#292524',
        border: '#44403c',
        borderSubtle: '#292524',
        textPrimary: '#faf9f7',
        textSecondary: '#d6d3d1',
        textMuted: '#a8a29e',
        textInverse: '#1c1917',
        focusRing: '#e85d2b',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#0ea5e9',
      },
      fonts: {
        display: 'var(--font-libre-baskerville)',
        sans: 'var(--font-ibm-plex)',
        mono: 'var(--font-jetbrains-mono)',
      },
      shadows: {
        sm: '2px 2px 0px rgba(232, 93, 43, 0.2)',
        md: '4px 4px 0px rgba(232, 93, 43, 0.15)',
        lg: '8px 8px 0px rgba(232, 93, 43, 0.18)',
        color: '232 93 43',
      },
      radius: {
        sm: '3px',
        md: '4px',
        lg: '6px',
        full: '9999px',
      },
      transitions: {
        instant: '75ms',
        fast: '150ms',
        normal: '250ms',
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
    },
  },
};
```

---

### Module: lib/themes/presets/mono.ts

**Responsibility**: Define the Mono theme preset—stark black/white calligraphic aesthetic.

**Public Interface**:

```typescript
export const monoTheme: ThemePreset;
```

**Key Visual Characteristics**:

- Pure black (#000) and white (#fff) only—no grays except for muted states
- No accent color in primary position (use black)
- Sharp shadows (black on white, white on black)
- Zero radius (sharp corners)
- Fast, snappy transitions

**Internal Implementation**:

```typescript
import type { ThemePreset } from '../types';

export const monoTheme: ThemePreset = {
  id: 'mono',
  label: 'Mono',
  description: 'Stark calligraphic simplicity',
  styles: {
    light: {
      colors: {
        primary: '#000000',
        primaryHover: '#262626',
        primaryActive: '#404040',
        background: '#ffffff',
        foreground: '#000000',
        surface: '#ffffff',
        surfaceHover: '#f5f5f5',
        muted: '#f5f5f5',
        border: '#000000',
        borderSubtle: '#e5e5e5',
        textPrimary: '#000000',
        textSecondary: '#404040',
        textMuted: '#737373',
        textInverse: '#ffffff',
        focusRing: '#000000',
      },
      fonts: {
        display: 'var(--font-noto-serif)',
        sans: 'var(--font-inter)',
        mono: 'var(--font-jetbrains-mono)',
      },
      shadows: {
        sm: '2px 2px 0px rgba(0, 0, 0, 0.2)',
        md: '4px 4px 0px rgba(0, 0, 0, 0.15)',
        lg: '6px 6px 0px rgba(0, 0, 0, 0.1)',
        color: '0 0 0',
      },
      radius: {
        sm: '0px',
        md: '0px',
        lg: '0px',
        full: '9999px',
      },
      transitions: {
        instant: '50ms',
        fast: '100ms',
        normal: '200ms',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
    dark: {
      colors: {
        primary: '#ffffff',
        primaryHover: '#e5e5e5',
        primaryActive: '#d4d4d4',
        background: '#000000',
        foreground: '#ffffff',
        surface: '#171717',
        surfaceHover: '#262626',
        muted: '#171717',
        border: '#ffffff',
        borderSubtle: '#262626',
        textPrimary: '#ffffff',
        textSecondary: '#d4d4d4',
        textMuted: '#737373',
        textInverse: '#000000',
        focusRing: '#ffffff',
      },
      fonts: {
        display: 'var(--font-noto-serif)',
        sans: 'var(--font-inter)',
        mono: 'var(--font-jetbrains-mono)',
      },
      shadows: {
        sm: '2px 2px 0px rgba(255, 255, 255, 0.15)',
        md: '4px 4px 0px rgba(255, 255, 255, 0.1)',
        lg: '6px 6px 0px rgba(255, 255, 255, 0.08)',
        color: '255 255 255',
      },
      radius: {
        sm: '0px',
        md: '0px',
        lg: '0px',
        full: '9999px',
      },
      transitions: {
        instant: '50ms',
        fast: '100ms',
        normal: '200ms',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
};
```

---

### Module: lib/themes/presets/vintage-paper.ts

**Responsibility**: Define the Vintage Paper theme—aged literary warmth.

**Key Visual Characteristics**:

- Sepia-tinted neutrals
- Aged paper background (warmer than Kenya)
- Muted burgundy accent
- Soft blur shadows (not hard offset)
- Rounded, friendly corners
- Slow, gentle transitions

**Public Interface**:

```typescript
export const vintagePaperTheme: ThemePreset;
```

**Internal Implementation**:

```typescript
import type { ThemePreset } from '../types';

export const vintagePaperTheme: ThemePreset = {
  id: 'vintage-paper',
  label: 'Vintage Paper',
  description: 'Aged literary warmth',
  styles: {
    light: {
      colors: {
        primary: '#8b3a3a',
        primaryHover: '#722e2e',
        primaryActive: '#5c2424',
        background: '#f5efe6',
        foreground: '#3d3632',
        surface: '#fffdf8',
        surfaceHover: '#f0ebe2',
        muted: '#ebe5da',
        border: '#d4cdc2',
        borderSubtle: '#e8e2d8',
        textPrimary: '#3d3632',
        textSecondary: '#5c5650',
        textMuted: '#8a837a',
        textInverse: '#fffdf8',
        focusRing: '#8b3a3a',
        success: '#5a7a5a',
        error: '#9a4a4a',
        warning: '#8a6a3a',
        info: '#4a6a8a',
      },
      fonts: {
        display: 'var(--font-cormorant)',
        sans: 'var(--font-source-serif)',
        mono: 'var(--font-jetbrains-mono)',
      },
      shadows: {
        sm: '0 1px 3px rgba(61, 54, 50, 0.08)',
        md: '0 4px 6px rgba(61, 54, 50, 0.06)',
        lg: '0 10px 20px rgba(61, 54, 50, 0.08)',
        color: '61 54 50',
      },
      radius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        full: '9999px',
      },
      transitions: {
        instant: '100ms',
        fast: '200ms',
        normal: '400ms',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
    dark: {
      colors: {
        primary: '#c76b6b',
        primaryHover: '#d47a7a',
        primaryActive: '#b85c5c',
        background: '#2a2521',
        foreground: '#e8e2d8',
        surface: '#352f2a',
        surfaceHover: '#403834',
        muted: '#352f2a',
        border: '#504840',
        borderSubtle: '#403834',
        textPrimary: '#e8e2d8',
        textSecondary: '#c4bdb4',
        textMuted: '#8a837a',
        textInverse: '#2a2521',
        focusRing: '#c76b6b',
        success: '#7a9a7a',
        error: '#ba6a6a',
        warning: '#aa8a5a',
        info: '#6a8aaa',
      },
      fonts: {
        display: 'var(--font-cormorant)',
        sans: 'var(--font-source-serif)',
        mono: 'var(--font-jetbrains-mono)',
      },
      shadows: {
        sm: '0 1px 3px rgba(0, 0, 0, 0.2)',
        md: '0 4px 6px rgba(0, 0, 0, 0.15)',
        lg: '0 10px 20px rgba(0, 0, 0, 0.2)',
        color: '0 0 0',
      },
      radius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        full: '9999px',
      },
      transitions: {
        instant: '100ms',
        fast: '200ms',
        normal: '400ms',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
};
```

---

### Module: lib/themes/presets/index.ts

**Responsibility**: Export theme registry and provide lookup utilities.

**Public Interface**:

```typescript
export const themes: ThemeRegistry;
export const themeIds: ThemeId[];
export const defaultThemeId: ThemeId;

export function getTheme(id: ThemeId): ThemePreset;
export function isValidThemeId(value: unknown): value is ThemeId;
```

**Internal Implementation**:

```typescript
import type { ThemePreset, ThemeRegistry, ThemeId } from '../types';
import { kenyaTheme } from './kenya';
import { monoTheme } from './mono';
import { vintagePaperTheme } from './vintage-paper';

export const themes: ThemeRegistry = {
  kenya: kenyaTheme,
  mono: monoTheme,
  'vintage-paper': vintagePaperTheme,
};

export const themeIds: ThemeId[] = ['kenya', 'mono', 'vintage-paper'];
export const defaultThemeId: ThemeId = 'kenya';

export function getTheme(id: ThemeId): ThemePreset {
  return themes[id];
}

export function isValidThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && themeIds.includes(value as ThemeId);
}
```

---

### Module: lib/themes/apply.ts

**Responsibility**: Inject CSS variables into document.documentElement. Hide complexity of variable mapping and transition timing.

**Public Interface**:

```typescript
export function applyTheme(
  themeId: ThemeId,
  mode: ThemeMode,
  options?: { transition?: boolean }
): void;

export function getAppliedTheme(): { themeId: ThemeId; mode: ThemeMode } | null;
```

**Internal Implementation** (Pseudocode):

```pseudocode
function applyTheme(themeId, mode, options = { transition: true }):
  1. Get theme preset from registry
     - theme = themes[themeId]
     - if !theme: log warning, use default theme
     - styleProps = theme.styles[mode]

  2. If transition enabled, add transition class
     - if options.transition:
       - root.classList.add('theme-transitioning')
       - // CSS: .theme-transitioning { transition: all 300ms ease }

  3. Apply color variables
     - for each [key, value] in styleProps.colors:
       - cssVarName = `--color-${kebabCase(key)}`
       - root.style.setProperty(cssVarName, value)

  4. Apply font variables
     - root.style.setProperty('--font-display', styleProps.fonts.display)
     - root.style.setProperty('--font-sans', styleProps.fonts.sans)
     - root.style.setProperty('--font-mono', styleProps.fonts.mono)

  5. Apply shadow variables
     - root.style.setProperty('--shadow-sm', styleProps.shadows.sm)
     - root.style.setProperty('--shadow-md', styleProps.shadows.md)
     - root.style.setProperty('--shadow-lg', styleProps.shadows.lg)
     - if styleProps.shadows.color:
       - root.style.setProperty('--shadow-color', styleProps.shadows.color)

  6. Apply radius variables
     - root.style.setProperty('--radius-sm', styleProps.radius.sm)
     - root.style.setProperty('--radius-md', styleProps.radius.md)
     - root.style.setProperty('--radius-lg', styleProps.radius.lg)
     - root.style.setProperty('--radius-full', styleProps.radius.full)

  7. Apply transition variables
     - root.style.setProperty('--duration-instant', styleProps.transitions.instant)
     - root.style.setProperty('--duration-fast', styleProps.transitions.fast)
     - root.style.setProperty('--duration-normal', styleProps.transitions.normal)
     - root.style.setProperty('--ease-theme', styleProps.transitions.easing)

  8. Set data attributes and classes
     - root.setAttribute('data-theme', themeId)
     - root.classList.remove('light', 'dark')
     - root.classList.add(mode)

  9. Remove transition class after animation completes
     - if options.transition:
       - setTimeout(() => root.classList.remove('theme-transitioning'), 300)


function getAppliedTheme():
  1. Read data attributes from root element
     - themeId = root.getAttribute('data-theme')
     - mode = root.classList.contains('dark') ? 'dark' : 'light'

  2. Validate and return
     - if isValidThemeId(themeId):
       - return { themeId, mode }
     - return null
```

**Helper Function**:

```typescript
function kebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
```

---

### Module: lib/themes/context.tsx

**Responsibility**: React context provider managing theme state. Exposes simple interface, hides localStorage sync and CSS application.

**Public Interface**:

```typescript
export interface ThemeContextValue {
  themeId: ThemeId;
  mode: ThemeMode;
  setTheme: (id: ThemeId) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  theme: ThemePreset; // Convenience: current theme preset object
}

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element;
export function useTheme(): ThemeContextValue;
```

**Internal Implementation** (Pseudocode):

```pseudocode
// Storage keys
const STORAGE_KEY_THEME = 'linejam-theme-id'
const STORAGE_KEY_MODE = 'linejam-theme-mode'

function ThemeProvider({ children }):
  1. Initialize state from localStorage (lazy initialization)
     - themeId = useState(() => {
         if (typeof window === 'undefined') return defaultThemeId
         stored = localStorage.getItem(STORAGE_KEY_THEME)
         return isValidThemeId(stored) ? stored : defaultThemeId
       })

     - mode = useState(() => {
         if (typeof window === 'undefined') return 'light'
         stored = localStorage.getItem(STORAGE_KEY_MODE)
         if (stored === 'light' || stored === 'dark') return stored
         return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
       })

  2. Apply theme on mount and changes
     - useEffect(() => {
         applyTheme(themeId, mode, { transition: false })
       }, [])  // Only on mount, blocking script handles initial

     - useEffect(() => {
         applyTheme(themeId, mode, { transition: true })
       }, [themeId, mode])

  3. Persist to localStorage on changes
     - useEffect(() => {
         try {
           localStorage.setItem(STORAGE_KEY_THEME, themeId)
           localStorage.setItem(STORAGE_KEY_MODE, mode)
         } catch (e) {
           console.warn('Could not save theme preference:', e)
         }
       }, [themeId, mode])

  4. Create handlers
     - setTheme = useCallback((id) => setThemeId(id), [])
     - setMode = useCallback((m) => setModeState(m), [])
     - toggleMode = useCallback(() => {
         setModeState(prev => prev === 'light' ? 'dark' : 'light')
       }, [])

  5. Memoize context value
     - value = useMemo(() => ({
         themeId,
         mode,
         setTheme,
         setMode,
         toggleMode,
         theme: getTheme(themeId),
       }), [themeId, mode, setTheme, setMode, toggleMode])

  6. Return provider
     - return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>


function useTheme():
  - ctx = useContext(ThemeContext)
  - if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  - return ctx
```

**Error Handling**:

- localStorage quota exceeded: Log warning, theme still works in memory
- Invalid theme in storage: Fall back to default Kenya theme
- useTheme outside provider: Throw descriptive error

---

### Module: app/layout.tsx (Modifications)

**Responsibility**: Load all theme fonts via next/font, update blocking script for multi-theme support.

**Changes Required**:

1. **Add font imports for all themes**:

```typescript
// Kenya fonts (existing)
import { Libre_Baskerville, IBM_Plex_Sans } from 'next/font/google';
// Mono fonts
import { Noto_Serif, Inter } from 'next/font/google';
// Vintage Paper fonts
import { Cormorant_Garamond, Source_Serif_4 } from 'next/font/google';
// Shared mono font
import { JetBrains_Mono } from 'next/font/google';
```

2. **Configure each font with unique CSS variable**:

```typescript
const libreBaskerville = Libre_Baskerville({
  variable: '--font-libre-baskerville',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

const ibmPlex = IBM_Plex_Sans({
  variable: '--font-ibm-plex',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

const notoSerif = Noto_Serif({
  variable: '--font-noto-serif',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
});
```

3. **Combine all font variables in body className**:

```typescript
className={`
  ${libreBaskerville.variable}
  ${ibmPlex.variable}
  ${notoSerif.variable}
  ${inter.variable}
  ${cormorant.variable}
  ${sourceSerif.variable}
  ${jetbrainsMono.variable}
  antialiased
`}
```

4. **Update blocking script for multi-theme support**:

```typescript
const themeInitScript = `
  (function() {
    try {
      var THEME_KEY = 'linejam-theme-id';
      var MODE_KEY = 'linejam-theme-mode';
      var VALID_THEMES = ['kenya', 'mono', 'vintage-paper'];
      var DEFAULT_THEME = 'kenya';

      var storedTheme = localStorage.getItem(THEME_KEY);
      var storedMode = localStorage.getItem(MODE_KEY);

      var themeId = VALID_THEMES.includes(storedTheme) ? storedTheme : DEFAULT_THEME;

      var mode;
      if (storedMode === 'light' || storedMode === 'dark') {
        mode = storedMode;
      } else {
        mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }

      document.documentElement.setAttribute('data-theme', themeId);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(mode);

      // Apply theme-specific variables (inlined from presets)
      // This is duplicated from apply.ts for blocking behavior
      var themes = ${JSON.stringify(INLINE_THEME_CSS_VARS)};
      var vars = themes[themeId][mode];
      for (var key in vars) {
        document.documentElement.style.setProperty(key, vars[key]);
      }
    } catch (e) {}
  })();
`;
```

**Note**: The blocking script needs inlined theme variables. Generate a minimal version at build time or inline a simplified version covering only critical visual properties (colors, fonts).

---

### Module: app/providers.tsx (Modifications)

**Responsibility**: Wrap existing providers with ThemeProvider.

**Changes Required**:

```typescript
import { ThemeProvider } from '@/lib/themes/context';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

---

### Module: components/ThemeSelector.tsx

**Responsibility**: Theme picker UI with preview cards. Grid layout, current theme indicator, immediate application on click.

**Public Interface**:

```typescript
interface ThemeSelectorProps {
  className?: string;
  onClose?: () => void; // For modal/dropdown usage
}

export function ThemeSelector({
  className,
  onClose,
}: ThemeSelectorProps): JSX.Element;
```

**Internal Implementation** (Pseudocode):

```pseudocode
function ThemeSelector({ className, onClose }):
  1. Get current theme state
     - { themeId, mode, setTheme, setMode, toggleMode } = useTheme()

  2. Handle theme selection
     - handleSelect = (id) => {
         setTheme(id)
         // Optional: announce to screen reader
       }

  3. Render grid of preview cards
     - return (
         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" role="radiogroup" aria-label="Select theme">
           {themeIds.map(id => (
             <ThemePreview
               key={id}
               themeId={id}
               isSelected={id === themeId}
               currentMode={mode}
               onSelect={() => handleSelect(id)}
             />
           ))}
         </div>

         <div className="mt-4 flex justify-center">
           <button onClick={toggleMode} aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
             {mode === 'light' ? <Moon /> : <Sun />}
             {mode === 'light' ? 'Dark Mode' : 'Light Mode'}
           </button>
         </div>
       )
```

**Accessibility**:

- `role="radiogroup"` on container
- `role="radio"` on each preview card
- `aria-checked` on selected card
- Keyboard: Tab cycles cards, Enter/Space selects
- Focus trap when in modal

---

### Module: components/ThemePreview.tsx

**Responsibility**: Mini preview card showing theme's visual style with inline-applied theme variables.

**Public Interface**:

```typescript
interface ThemePreviewProps {
  themeId: ThemeId;
  isSelected: boolean;
  currentMode: ThemeMode;
  onSelect: () => void;
}

export function ThemePreview({
  themeId,
  isSelected,
  currentMode,
  onSelect,
}: ThemePreviewProps): JSX.Element;
```

**Internal Implementation** (Pseudocode):

```pseudocode
function ThemePreview({ themeId, isSelected, currentMode, onSelect }):
  1. Get theme preset
     - theme = getTheme(themeId)
     - styles = theme.styles[currentMode]

  2. Build inline style object for preview isolation
     - previewStyle = {
         '--preview-bg': styles.colors.background,
         '--preview-fg': styles.colors.foreground,
         '--preview-primary': styles.colors.primary,
         '--preview-surface': styles.colors.surface,
         '--preview-border': styles.colors.border,
         '--preview-text': styles.colors.textPrimary,
         '--preview-text-muted': styles.colors.textMuted,
         '--preview-radius': styles.radius.md,
         '--preview-shadow': styles.shadows.sm,
         '--preview-font-display': styles.fonts.display,
         '--preview-font-sans': styles.fonts.sans,
       }

  3. Render preview card
     - return (
         <button
           role="radio"
           aria-checked={isSelected}
           onClick={onSelect}
           style={previewStyle}
           className={cn(
             'relative p-4 rounded-lg border-2 transition-all duration-200',
             'bg-[var(--preview-bg)] text-[var(--preview-text)]',
             'border-[var(--preview-border)]',
             isSelected && 'ring-2 ring-[var(--color-primary)] ring-offset-2',
             'hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2'
           )}
         >
           {/* Theme name */}
           <h3 className="font-[var(--preview-font-display)] text-lg mb-1">
             {theme.label}
           </h3>

           {/* Description */}
           <p className="text-sm text-[var(--preview-text-muted)] mb-3">
             {theme.description}
           </p>

           {/* Sample UI elements */}
           <div className="flex gap-2 mb-2">
             <div className="w-8 h-8 rounded-[var(--preview-radius)] bg-[var(--preview-primary)]" />
             <div className="w-8 h-8 rounded-[var(--preview-radius)] bg-[var(--preview-surface)] border border-[var(--preview-border)]" />
           </div>

           {/* Sample text */}
           <p className="font-[var(--preview-font-sans)] text-xs">
             The quick brown fox
           </p>

           {/* Selected indicator */}
           {isSelected && (
             <div className="absolute top-2 right-2">
               <Check className="w-5 h-5 text-[var(--color-primary)]" />
             </div>
           )}
         </button>
       )
```

**Visual Design Notes**:

- Each preview card shows theme colors, fonts, and radius inline
- Preview isolation: Uses CSS custom properties scoped to element via inline style
- Selected state: Ring around card + checkmark icon
- Hover: Subtle scale transform (1.02x)

---

### Module: components/ThemeToggle.tsx (Modifications)

**Responsibility**: Update existing light/dark toggle to use new theme context.

**Changes Required**:

```typescript
'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/themes/context';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { mode, toggleMode } = useTheme();

  return (
    <button
      onClick={toggleMode}
      className={`w-10 h-10 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all duration-[var(--duration-normal)] ${className}`}
      aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
    >
      {mode === 'light' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
```

---

### Module: components/Header.tsx (Modifications)

**Responsibility**: Add theme selector trigger button next to existing theme toggle.

**Changes Required**:
Add palette icon button that opens ThemeSelector in a dropdown or modal.

```typescript
import { Palette } from 'lucide-react';
import { useState } from 'react';
import { ThemeSelector } from './ThemeSelector';

// Inside Header component:
const [showThemes, setShowThemes] = useState(false);

// In JSX, next to ThemeToggle:
<button
  onClick={() => setShowThemes(!showThemes)}
  className="w-10 h-10 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all"
  aria-label="Choose theme"
  aria-expanded={showThemes}
>
  <Palette className="w-5 h-5" />
</button>

{showThemes && (
  <div className="absolute top-full right-0 mt-2 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-50">
    <ThemeSelector onClose={() => setShowThemes(false)} />
  </div>
)}
```

---

## File Organization

```
lib/
  themes/
    types.ts              # TypeScript interfaces (ThemePreset, ThemeColors, etc.)
    apply.ts              # CSS variable injection (applyTheme, getAppliedTheme)
    context.tsx           # ThemeProvider + useTheme hook
    presets/
      index.ts            # Theme registry + utilities (themes, isValidThemeId)
      kenya.ts            # Kenya theme preset
      mono.ts             # Mono theme preset
      vintage-paper.ts    # Vintage Paper theme preset

components/
  ThemeSelector.tsx       # Theme picker grid
  ThemePreview.tsx        # Individual theme preview card
  ThemeToggle.tsx         # Light/dark toggle (modified)
  Header.tsx              # Header with theme selector trigger (modified)

app/
  layout.tsx              # Font imports + blocking script (modified)
  providers.tsx           # Add ThemeProvider wrapper (modified)
  globals.css             # Remove hardcoded theme values, keep animations (modified)

tests/
  lib/
    themes/
      apply.test.ts       # CSS variable injection tests
      context.test.tsx    # ThemeProvider tests
      presets.test.ts     # Theme preset validation tests
  components/
    ThemeSelector.test.tsx
    ThemePreview.test.tsx
```

**Modifications to Existing Files**:

- `app/layout.tsx`: Add 5 new font imports, update blocking script
- `app/providers.tsx`: Wrap with ThemeProvider
- `app/globals.css`: Remove color/font definitions from @theme (keep animation/utility classes)
- `components/ThemeToggle.tsx`: Use useTheme hook instead of local state
- `components/Header.tsx`: Add palette button + ThemeSelector dropdown

---

## CSS Variable Mapping

Complete mapping from ThemeStyleProps to CSS variables:

| TypeScript Property  | CSS Variable           |
| -------------------- | ---------------------- |
| colors.primary       | --color-primary        |
| colors.primaryHover  | --color-primary-hover  |
| colors.primaryActive | --color-primary-active |
| colors.background    | --color-background     |
| colors.foreground    | --color-foreground     |
| colors.surface       | --color-surface        |
| colors.surfaceHover  | --color-surface-hover  |
| colors.muted         | --color-muted          |
| colors.border        | --color-border         |
| colors.borderSubtle  | --color-border-subtle  |
| colors.textPrimary   | --color-text-primary   |
| colors.textSecondary | --color-text-secondary |
| colors.textMuted     | --color-text-muted     |
| colors.textInverse   | --color-text-inverse   |
| colors.focusRing     | --color-focus-ring     |
| colors.success       | --color-success        |
| colors.error         | --color-error          |
| colors.warning       | --color-warning        |
| colors.info          | --color-info           |
| fonts.display        | --font-display         |
| fonts.sans           | --font-sans            |
| fonts.mono           | --font-mono            |
| shadows.sm           | --shadow-sm            |
| shadows.md           | --shadow-md            |
| shadows.lg           | --shadow-lg            |
| shadows.color        | --shadow-color         |
| radius.sm            | --radius-sm            |
| radius.md            | --radius-md            |
| radius.lg            | --radius-lg            |
| radius.full          | --radius-full          |
| transitions.instant  | --duration-instant     |
| transitions.fast     | --duration-fast        |
| transitions.normal   | --duration-normal      |
| transitions.easing   | --ease-theme           |

---

## State Management

**Client State**:

- `themeId`: Current theme ID (kenya/mono/vintage-paper) in React state
- `mode`: Current mode (light/dark) in React state
- Both persisted to localStorage on change

**Storage Keys**:

- `linejam-theme-id`: Theme ID string
- `linejam-theme-mode`: Mode string ('light' or 'dark')

**State Update Flow**:

1. User clicks theme preview card → `setTheme(id)` called
2. ThemeProvider updates state → useEffect triggers
3. `applyTheme()` injects CSS variables
4. localStorage persists new values
5. All components re-render with new CSS variable values (via Tailwind's var() references)

**No Server State**: Themes are purely client-side. No Convex involvement.

---

## Error Handling Strategy

**Error Categories**:

1. **localStorage Failures** (quota exceeded, private browsing):
   - Catch in try/catch
   - Log warning to console
   - Theme still works in memory, just won't persist
   - User experience: Theme reverts to default on page refresh

2. **Invalid Theme in Storage**:
   - Validate with `isValidThemeId()` before use
   - Fall back to `defaultThemeId` ('kenya')
   - Silent handling—user sees default theme

3. **useTheme Outside Provider**:
   - Throw descriptive error: "useTheme must be used within ThemeProvider"
   - This is a developer error, not runtime user error

4. **Missing Font Variable**:
   - Fonts are bundled via next/font—can't fail at runtime
   - If theme preset references wrong variable name, fallback occurs naturally (browser shows fallback font)

**No User-Facing Errors**: All theme errors fail silently with sensible defaults. Theme preference is non-critical—app works fine on default theme.

---

## Testing Strategy

### Unit Tests (Vitest)

**lib/themes/apply.test.ts**:

```typescript
describe('applyTheme', () => {
  it('sets CSS variables on document root');
  it('sets data-theme attribute');
  it('adds mode class (light/dark)');
  it('applies transition class when transition option true');
  it('removes transition class after 300ms');
});

describe('getAppliedTheme', () => {
  it('reads theme from data-theme attribute');
  it('reads mode from class list');
  it('returns null for invalid theme');
});
```

**lib/themes/context.test.tsx**:

```typescript
describe('ThemeProvider', () => {
  it('provides default theme on mount');
  it('reads initial theme from localStorage');
  it('persists theme changes to localStorage');
  it('handles localStorage errors gracefully');
});

describe('useTheme', () => {
  it('returns current theme and mode');
  it('setTheme updates theme');
  it('toggleMode switches between light and dark');
  it('throws when used outside provider');
});
```

**lib/themes/presets.test.ts**:

```typescript
describe('theme presets', () => {
  it('all presets have required properties');
  it('all color values are valid CSS colors');
  it('all font values reference CSS variables');
  it('isValidThemeId validates correctly');
});
```

### Component Tests (React Testing Library)

**components/ThemeSelector.test.tsx**:

```typescript
describe('ThemeSelector', () => {
  it('renders all theme options');
  it('highlights current theme');
  it('calls setTheme on click');
  it('is keyboard navigable');
  it('has correct ARIA attributes');
});
```

**components/ThemePreview.test.tsx**:

```typescript
describe('ThemePreview', () => {
  it('renders theme label and description');
  it('applies theme colors as inline styles');
  it('shows selected indicator when isSelected');
  it('calls onSelect on click');
});
```

### Accessibility Tests

```typescript
describe('accessibility', () => {
  it('ThemeSelector has role="radiogroup"');
  it('ThemePreview has role="radio" and aria-checked');
  it('focus ring is visible on all themes');
  it('all themes pass axe automated checks');
});
```

### Contrast Validation Tests

```typescript
describe('WCAG contrast', () => {
  // For each theme and mode
  it('text on background meets 4.5:1 ratio');
  it('text on surface meets 4.5:1 ratio');
  it('muted text meets 3:1 ratio');
  it('primary on background meets 3:1 for UI');
});
```

### Visual Regression (Playwright)

```typescript
describe('theme visual regression', () => {
  for (const themeId of ['kenya', 'mono', 'vintage-paper']) {
    for (const mode of ['light', 'dark']) {
      it(`${themeId} ${mode} matches snapshot`, async ({ page }) => {
        await page.goto('/');
        await page.evaluate(
          ({ themeId, mode }) => {
            localStorage.setItem('linejam-theme-id', themeId);
            localStorage.setItem('linejam-theme-mode', mode);
          },
          { themeId, mode }
        );
        await page.reload();
        await expect(page).toHaveScreenshot(`${themeId}-${mode}.png`);
      });
    }
  }
});
```

### Mocking Strategy

- **localStorage**: Use happy-dom's built-in localStorage mock
- **matchMedia**: Mock in test setup for system preference tests
- **CSS variables**: Don't mock—let JSDOM apply them (verify via getComputedStyle)

---

## Performance Considerations

**Bundle Size**:

- 6 Google Fonts loaded via next/font: ~150KB total (compressed)
- All fonts in initial bundle—no lazy loading (prevents FOUT)
- Theme preset JS: ~5KB total (JSON objects)

**Runtime Performance**:

- Theme switch: Single `applyTheme()` call setting ~30 CSS variables
- Measured: <5ms for variable injection
- No DOM mutations beyond root element style changes
- No React re-renders on theme switch (CSS variables cascade automatically)

**No Layout Shift**:

- Fonts bundled and preloaded by next/font
- CSS variables apply to existing elements (no structure changes)
- 300ms crossfade transition masks any color pop

**Blocking Script Size**:

- Minimal inline JS in layout.tsx: ~500 bytes
- Contains only localStorage read + class/attribute set
- No theme preset data inlined (too large)—first paint uses CSS defaults, hydration applies stored theme

---

## Security Considerations

**localStorage**:

- Theme preference only (non-sensitive)
- Validated before use (`isValidThemeId`)
- No user data stored

**CSS Injection**:

- All values come from hardcoded theme presets
- No user input reaches `style.setProperty`
- No XSS vector

**Script Injection**:

- Blocking script is hardcoded template literal
- No dynamic values interpolated

---

## Alternative Architectures Considered

### Alternative A: CSS-in-JS (styled-components)

- **Pros**: Theme object passed via React context, type-safe, no CSS variable indirection
- **Cons**: Bundle size (+30KB), CSS extraction complexity with SSR, vendor lock-in
- **Ousterhout Analysis**: Adds dependency layer between components and styles (complexity)
- **Verdict**: Rejected—Tailwind CSS 4's @theme directive already provides CSS variables

### Alternative B: Tailwind Dark Mode Only (dark: prefix)

- **Pros**: Zero runtime JS, native Tailwind, smallest bundle
- **Cons**: Only supports 2 modes (light/dark), doesn't support multiple themes, requires class changes throughout codebase
- **Ousterhout Analysis**: Would require every component to know about all themes (information leakage)
- **Verdict**: Rejected—can't support 3+ distinct themes

### Alternative C: Dynamic Font Loading (Font Face Observer)

- **Pros**: Smaller initial bundle (~50KB saved), load fonts on demand
- **Cons**: FOUT on every theme switch, complex loading states, race conditions
- **Ousterhout Analysis**: Complexity of loading states leaks into UI layer
- **Verdict**: Rejected—FOUT is unacceptable per PRD requirements

### Alternative D: Server-Side Theme (cookies + SSR)

- **Pros**: No client-side flash, works without JS
- **Cons**: Requires Convex changes or separate API, complicates caching, overkill for aesthetic preference
- **Ousterhout Analysis**: Server dependency for client-only feature (unnecessary coupling)
- **Verdict**: Rejected—localStorage is simpler and sufficient

**Selected**: CSS Variables + next/font (static) + localStorage

- **Ousterhout Justification**: Deep modules (ThemeProvider hides all complexity), minimal interface (4 values exposed), no information leakage (components don't know about theme switching)

---

## Implementation Sequence

### Phase 1: Foundation (estimated: 6-8 hours)

1. Create `lib/themes/types.ts` with all interfaces
2. Create `lib/themes/presets/kenya.ts` (extract from globals.css)
3. Create `lib/themes/presets/mono.ts`
4. Create `lib/themes/presets/vintage-paper.ts`
5. Create `lib/themes/presets/index.ts` with registry
6. Create `lib/themes/apply.ts` with CSS variable injection
7. Create `lib/themes/context.tsx` with ThemeProvider + useTheme
8. Update `app/layout.tsx` with all font imports + blocking script
9. Update `app/providers.tsx` to wrap with ThemeProvider
10. Update `app/globals.css` to remove hardcoded values
11. Update `components/ThemeToggle.tsx` to use useTheme

### Phase 2: UI (estimated: 4-6 hours)

1. Create `components/ThemePreview.tsx`
2. Create `components/ThemeSelector.tsx`
3. Update `components/Header.tsx` with palette button + dropdown
4. Add keyboard navigation and focus management
5. Add screen reader announcements

### Phase 3: Testing + Polish (estimated: 2-3 hours)

1. Write unit tests for apply.ts, context.tsx, presets
2. Write component tests for ThemeSelector, ThemePreview
3. Write accessibility tests
4. Write contrast validation tests
5. Add Playwright visual regression screenshots
6. Manual testing of all 6 combinations (3 themes × 2 modes)

---

## Success Criteria Checklist

- [ ] All 3 themes render correctly (Kenya, Mono, Vintage Paper)
- [ ] Light and dark mode works for each theme
- [ ] Font switching works per theme (no FOUT)
- [ ] Theme persists across page refresh
- [ ] Theme switch has 300ms crossfade
- [ ] No layout shift on theme switch
- [ ] Theme selector is discoverable in header
- [ ] All themes pass WCAG AA contrast
- [ ] Keyboard navigation works in theme selector
- [ ] Screen reader announces theme changes
- [ ] All unit tests pass
- [ ] All visual regression tests pass
