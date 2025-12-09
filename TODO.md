# TODO.md

## Premium Themes - Implementation Plan

- [ ] **Infrastructure Finalization**
  - [ ] Commit `lib/themes/registry.ts` and `lib/themes/schema.ts` (currently untracked)
  - [ ] Commit updated presets (`kenya.ts`, `mono.ts`, `vintage-paper.ts`) and `types.ts`
  - [ ] Commit `globals.css` base changes with new theme transition logic

- [ ] **Visual Polish (Theme Signatures)**
  - [ ] **Kenya Theme**
    - [ ] Add vertical text utility `.theme-vertical-text` in `globals.css`
    - [ ] Add brush stroke divider styling `.theme-divider`
  - [ ] **Mono Theme**
    - [ ] Add "Instant" stamp animation override (no rotation)
    - [ ] Add geometric divider styling
    - [ ] Force bold borders instead of shadows (CSS override)
  - [ ] **Vintage Paper Theme**
    - [ ] Add drop cap styling `.theme-drop-cap`
    - [ ] Add swash/ornamental divider
    - [ ] Add vignette overlay effect `.theme-vignette`

- [ ] **Component Integration**
  - [ ] Verify `ThemeSelector` properly lists all themes from registry
  - [ ] Verify `ThemePreview` renders correct tokens for new themes

- [ ] **Verification**
  - [ ] Run `pnpm typecheck`
  - [ ] Run `pnpm test`
  - [ ] Manual check of theme switching in browser (via `ThemeToggle`)
