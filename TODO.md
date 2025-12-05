# TODO: Premium Themes System

## Context

- **Architecture**: DESIGN.md — next/font + CSS Variable Bridge with ThemeProvider Context
- **Key Files**: lib/themes/, components/ThemeSelector.tsx, components/ThemePreview.tsx
- **Patterns**: Follow lib/auth.ts for hook pattern, components/ui/Button.tsx for component style

## Phase 1: Foundation

### 1.1 Theme Type System

- [x] Create lib/themes/types.ts with all TypeScript interfaces
  ```
  Files: lib/themes/types.ts (new)
  Pattern: Export interfaces like convex/lib/types patterns
  Pseudocode: See DESIGN.md Module: lib/themes/types.ts
  Success: ThemeId, ThemeMode, ThemePreset, ThemeStyleProps exported; tsc passes
  Test: Import types in another file → no TS errors
  Dependencies: None
  Time: 15min
  ```

### 1.2 Theme Presets

- [x] Create Kenya theme preset (extract from globals.css)

  ```
  Files: lib/themes/presets/kenya.ts (new)
  Pattern: Export const with ThemePreset shape
  Pseudocode: See DESIGN.md Module: lib/themes/presets/kenya.ts
  Success: kenyaTheme matches current globals.css values; persimmon accent (#e85d2b)
  Test: kenyaTheme.styles.light.colors.primary === '#e85d2b'
  Dependencies: types.ts
  Time: 20min
  ```

- [x] Create Mono theme preset (stark black/white)

  ```
  Files: lib/themes/presets/mono.ts (new)
  Pattern: Same shape as kenya.ts
  Pseudocode: See DESIGN.md Module: lib/themes/presets/mono.ts
  Success: Pure black/white colors; zero radius; fast transitions
  Test: monoTheme.styles.light.colors.primary === '#000000'; radius.sm === '0px'
  Dependencies: types.ts
  Time: 20min
  ```

- [x] Create Vintage Paper theme preset (sepia warmth)

  ```
  Files: lib/themes/presets/vintage-paper.ts (new)
  Pattern: Same shape as kenya.ts
  Pseudocode: See DESIGN.md Module: lib/themes/presets/vintage-paper.ts
  Success: Sepia background (#f5efe6); burgundy accent (#8b3a3a); soft shadows
  Test: vintagePaperTheme.styles.light.colors.background === '#f5efe6'
  Dependencies: types.ts
  Time: 20min
  ```

- [x] Create theme registry with utilities
  ```
  Files: lib/themes/presets/index.ts (new)
  Pattern: Re-export pattern like lib/index.ts
  Pseudocode: See DESIGN.md Module: lib/themes/presets/index.ts
  Success: themes, themeIds, getTheme, isValidThemeId exported
  Test: isValidThemeId('kenya') → true; isValidThemeId('invalid') → false
  Dependencies: All preset files
  Time: 10min
  ```

### 1.3 CSS Variable Injection

- [x] Create applyTheme function for CSS variable injection
  ```
  Files: lib/themes/apply.ts (new)
  Pattern: DOM manipulation like existing ThemeToggle
  Pseudocode: See DESIGN.md Module: lib/themes/apply.ts
  Success: applyTheme() sets 30+ CSS variables on :root; adds data-theme attribute
  Test: applyTheme('mono', 'dark') → document.documentElement.style has --color-primary
  Dependencies: presets/index.ts
  Time: 45min
  ```

### 1.4 Theme Context Provider

- [x] Create ThemeProvider and useTheme hook
  ```
  Files: lib/themes/context.tsx (new)
  Pattern: Follow lib/auth.ts useUser hook pattern
  Pseudocode: See DESIGN.md Module: lib/themes/context.tsx
  Success: ThemeProvider manages state; useTheme returns themeId, mode, setTheme, toggleMode
  Test: Wrap component → useTheme() returns expected shape; setTheme triggers applyTheme
  Dependencies: apply.ts, presets/index.ts
  Time: 45min
  ```

### 1.5 Font Loading

- [x] Add all theme fonts to layout.tsx via next/font
  ```
  Files: app/layout.tsx (modify lines 2-23, 60-62)
  Pattern: Extend existing Libre_Baskerville + IBM_Plex_Sans pattern
  Pseudocode: See DESIGN.md Module: app/layout.tsx (Modifications)
  Success: 7 font families loaded; all font variables in body className
  Test: Inspect body → has --font-noto-serif, --font-inter, --font-cormorant, etc.
  Dependencies: None (parallel with 1.1-1.4)
  Time: 30min
  ```

### 1.6 Blocking Script Update

- [x] Update themeInitScript for multi-theme support
  ```
  Files: app/layout.tsx (modify lines 46-56)
  Pattern: Extend existing blocking script
  Pseudocode: See DESIGN.md Module: app/layout.tsx line 792-828
  Success: Script reads linejam-theme-id + linejam-theme-mode from localStorage; applies data-theme attr
  Test: Set localStorage manually → page load shows correct theme without flash
  Dependencies: None (parallel with 1.5)
  Time: 20min
  ```

### 1.7 Provider Integration

- [x] Wrap app with ThemeProvider in providers.tsx
  ```
  Files: app/providers.tsx (modify line 9)
  Pattern: Add inner wrapper
  Pseudocode: See DESIGN.md Module: app/providers.tsx (Modifications)
  Success: ThemeProvider wraps children inside ConvexProvider
  Test: useTheme() works in any component
  Dependencies: context.tsx
  Time: 5min
  ```

### 1.8 Migrate globals.css

- [x] Add theme transition CSS class for crossfade
  ```
  Files: app/globals.css (modify lines 14-102)
  Pattern: Keep animations/utilities; remove @theme color definitions
  Pseudocode: Remove color vars (now injected by applyTheme), keep keyframes + utility classes
  Success: Themes apply via JS injection; no duplicate CSS variable definitions
  Test: Switch theme → colors change; animations still work
  Dependencies: apply.ts working
  Time: 30min
  ```

### 1.9 Update ThemeToggle

- [x] Refactor ThemeToggle to use useTheme hook
  ```
  Files: components/ThemeToggle.tsx (modify)
  Pattern: Replace local state with useTheme hook
  Pseudocode: See DESIGN.md Module: components/ThemeToggle.tsx (Modifications)
  Success: Toggle uses context; no local state; simpler code
  Test: Click toggle → mode changes across app
  Dependencies: context.tsx
  Time: 15min
  ```

## Phase 2: UI Components

### 2.1 Theme Preview Card

- [x] Create ThemePreview component with inline theme isolation
  ```
  Files: components/ThemePreview.tsx (new)
  Pattern: Follow components/ui/Card.tsx for structure
  Pseudocode: See DESIGN.md Module: components/ThemePreview.tsx
  Success: Shows theme colors via inline CSS vars; isSelected shows checkmark
  Test: Render with isSelected=true → checkmark visible; click triggers onSelect
  Dependencies: presets/index.ts
  Time: 45min
  ```

### 2.2 Theme Selector Grid

- [x] Create ThemeSelector component with radiogroup pattern
  ```
  Files: components/ThemeSelector.tsx (new)
  Pattern: Grid of ThemePreview cards
  Pseudocode: See DESIGN.md Module: components/ThemeSelector.tsx
  Success: Shows 3 themes; current highlighted; click selects; mode toggle button
  Test: Click theme → setTheme called; aria-checked on selected card
  Dependencies: ThemePreview.tsx, context.tsx
  Time: 45min
  ```

### 2.3 Header Integration

- [x] Add palette button with dropdown to Header
  ```
  Files: components/Header.tsx (modify)
  Pattern: Add button + conditional dropdown like SignedIn/SignedOut pattern
  Pseudocode: See DESIGN.md Module: components/Header.tsx (Modifications)
  Success: Palette icon in header; click opens ThemeSelector dropdown
  Test: Click palette → dropdown visible; click outside → closes
  Dependencies: ThemeSelector.tsx
  Time: 30min
  ```

### 2.4 Keyboard Navigation

- [x] Add keyboard navigation to ThemeSelector
  ```
  Files: components/ThemeSelector.tsx (modify)
  Pattern: Arrow keys for roving tabindex
  Success: Tab focuses selector; Arrow keys move between themes; Enter selects
  Test: Tab into selector → arrow right → focus moves; press Enter → theme changes
  Dependencies: ThemeSelector.tsx exists
  Time: 30min
  ```

### 2.5 Focus Trap (optional)

- [x] Add focus trap when ThemeSelector is open (Escape closes via keyboard handler)
  ```
  Files: components/Header.tsx (modify)
  Pattern: Escape closes; Tab cycles within dropdown
  Success: Escape closes dropdown; Tab wraps within dropdown
  Test: Open dropdown → Tab → stays in dropdown; Escape → closes
  Dependencies: Header integration done
  Time: 20min
  ```

## Phase 3: Testing

### 3.1 Preset Unit Tests

- [ ] Write tests for theme presets validation
  ```
  Files: tests/lib/themes/presets.test.ts (new)
  Pattern: Follow tests/lib/roomCode.test.ts pattern
  Success: All presets have required fields; colors are valid hex; fonts are CSS vars
  Test: Run `pnpm test:watch tests/lib/themes/presets.test.ts`
  Dependencies: All presets created
  Time: 30min
  ```

### 3.2 Apply Function Tests

- [ ] Write tests for applyTheme and getAppliedTheme
  ```
  Files: tests/lib/themes/apply.test.ts (new)
  Pattern: DOM manipulation tests with happy-dom
  Success: applyTheme sets variables; getAppliedTheme reads them
  Test: Run tests → all pass; coverage > 80%
  Dependencies: apply.ts created
  Time: 30min
  ```

### 3.3 Context Hook Tests

- [ ] Write tests for ThemeProvider and useTheme
  ```
  Files: tests/lib/themes/context.test.tsx (new)
  Pattern: Follow tests/lib/auth.test.ts pattern
  Success: Provider works; localStorage persists; errors handled gracefully
  Test: Run tests → all pass
  Dependencies: context.tsx created
  Time: 45min
  ```

### 3.4 Component Tests

- [ ] Write tests for ThemePreview and ThemeSelector
  ```
  Files: tests/components/ThemeSelector.test.tsx, tests/components/ThemePreview.test.tsx (new)
  Pattern: Follow tests/components/Lobby.test.tsx pattern
  Success: Components render; interactions work; ARIA attributes correct
  Test: Run tests → all pass
  Dependencies: UI components created
  Time: 45min
  ```

### 3.5 Contrast Validation Tests

- [ ] Write WCAG contrast validation tests
  ```
  Files: tests/lib/themes/contrast.test.ts (new)
  Pattern: Calculate contrast ratios for all color pairs
  Success: All themes pass WCAG AA (4.5:1 text, 3:1 UI)
  Test: Run tests → all pass; failures indicate specific color pairs to fix
  Dependencies: All presets finalized
  Time: 30min
  ```

### 3.6 Visual Regression Tests

- [ ] Add Playwright screenshots for all theme/mode combinations
  ```
  Files: tests/e2e/themes.spec.ts (new)
  Pattern: Follow tests/e2e/game-flow.spec.ts pattern
  Success: 6 screenshots (3 themes × 2 modes) captured and pass comparison
  Test: Run `pnpm test:e2e tests/e2e/themes.spec.ts`
  Dependencies: All themes working end-to-end
  Time: 30min
  ```

## Parallel Execution Guide

**Independent streams that can run in parallel:**

Stream A (Data Layer):
1.1 → 1.2 (all 3 presets) → 1.2 registry → 1.3 → 1.4

Stream B (Infrastructure):
1.5 → 1.6 (fonts + blocking script, parallel)

**Merge Point**: 1.7 (needs 1.4 + 1.6)

Stream C (UI, after merge):
2.1 → 2.2 → 2.3 → 2.4

Stream D (Testing, after respective modules):
3.1-3.6 can start as modules complete

## Backlog (Not This PR)

- Settings page theme selector (app/me/profile/page.tsx)
- Toast/announcement on theme change
- System preference listener (matchMedia change event)
- Additional themes (4+ themes)
- Theme customization UI
