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

- [ ] **Component Integration**
  - [ ] Verify `ThemeSelector` properly lists all themes from registry
  - [ ] Verify `ThemePreview` renders correct tokens for new themes

- [ ] **Verification**
  - [ ] Run `pnpm typecheck`
  - [ ] Run `pnpm test`
  - [ ] Manual check of theme switching in browser (via `ThemeToggle`)
