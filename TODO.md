# TODO.md

## Premium Themes - Implementation Plan

- [x] **Infrastructure Finalization**
  - [x] Commit `lib/themes/registry.ts` and `lib/themes/schema.ts` (currently untracked)
  - [x] Commit updated presets (`kenya.ts`, `mono.ts`, `vintage-paper.ts`) and `types.ts`
  - [x] Commit `globals.css` base changes with new theme transition logic

- [x] **Visual Polish (Theme Signatures)**
  - [x] **Kenya Theme**
    - [x] Add vertical text utility `.theme-vertical-text` in `globals.css`
    - [x] Add brush stroke divider styling `.theme-divider`
  - [x] **Mono Theme**
    - [x] Add "Instant" stamp animation override (no rotation)
    - [x] Add geometric divider styling
    - [x] Force bold borders instead of shadows (CSS override)
  - [x] **Vintage Paper Theme**
    - [x] Add drop cap styling `.theme-drop-cap`
    - [x] Add swash/ornamental divider
    - [x] Add vignette overlay effect `.theme-vignette`

- [x] **Hyper Maximalism Theme**
  - [x] **Foundation**
    - [x] Create `lib/themes/presets/hyper.ts` (Neon palette, hard shadows, tight spacing)
    - [x] Register theme in `lib/themes/registry.ts`
  - [x] **Typography**
    - [x] Import fonts in `app/layout.tsx`: `Righteous` (Display), `Outfit` (Sans), `Space Mono` (Mono)
    - [x] Map to `--font-display`, `--font-sans`, `--font-mono`
  - [x] **Signatures (`globals.css`)**
    - [x] Add `.theme-glitch` text shadow effect
    - [x] Add `.theme-static` background pattern (overrides noise)
    - [x] Add `.theme-zig-zag` divider styling
    - [x] Add "Brutalist" paper styling (thick borders, no shadow blur)

- [x] **Component Integration**
  - [x] Verify `ThemeSelector` properly lists all themes from registry
  - [x] Verify `ThemePreview` renders correct tokens for new themes

- [x] **Verification**
  - [x] Run `pnpm typecheck`
  - [x] Run `pnpm test`
  - [ ] Manual check of theme switching in browser (via `ThemeToggle`)
