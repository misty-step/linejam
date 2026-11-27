# Linejam — Design

## How to read this document

- This is the Active Design Folio: the present-tense statement of how Linejam
  looks, reads and moves. Every requirement carries a stable ID (`[D1-n]` for an
  area, `[D1-n.m]` for a testable rule inside it). Visual changes start here.
- [`PRODUCT.md`](PRODUCT.md) owns behaviour and rules; this document owns visual
  identity, typography, palette, color modes, cast emblems, motion and component
  craft (`PRODUCT.md` `[L1-7.1]`).
- The canonical files under `folio/assets/` are part of this document. Their
  exact bytes are pinned by
  [`folio/assets/checksums.json`](folio/assets/checksums.json). Where prose here
  and a canonical file disagree, the file wins.
- This identity supersedes the legacy lavender / plum / DynaPuff / Nunito Sans
  identity and the Pen Pals character cast, including the identity freeze in
  legacy `project.md`.

---

## [D1-1] Aesthetic stance and anti-kitsch invariants

- **[D1-1.1]** The direction is **Contemporary Warm Salon / Tactile Stationery**:
  quiet stone and alabaster stationery surfaces in Light mode (`#f4f1ea`
  canvas, `#fcfbf8` elevated sheets), deep warm charcoal with no slate or blue
  cast in Dark mode (`#151412` canvas, `#1d1b18` sheets), and a single
  restrained botanical forest-green accent (`#224e42` Light, `#7ab5a2` Dark).
- **[D1-1.2]** Personality comes from type, paper-like surfaces, hairline rules,
  the eight cast emblems and the poems themselves — never from decoration.
- **[D1-1.3]** Banned, with zero exceptions:
  - costume themes: riso splatter, cabaret neon, newspaper strike-sheet
    pastiche, and the legacy lavender / violet / plum / DynaPuff / Nunito Sans
    identity;
  - the `Inter` and `Inter Tight` typefaces;
  - emoji used as ornament or icon;
  - purple or violet glows, and glows of any color;
  - yellow-cream plus terracotta "vintage" cosplay;
  - drop-shadow soup: at most one soft shadow, on floating layers (menus,
    dialogs) only;
  - nested card-in-card boxes: one stationery sheet per region, grouped
    internally by spacing and hairline rules;
  - `999px` stadium pills as the default shape for buttons, inputs or tags.

## [D1-2] Canonical assets and checksum lock

- **[D1-2.1]** Copy verbatim. Every brand mark, favicon, iOS / PWA icon and
  player cast emblem uses the exact SVG geometry checked into `folio/assets/`.
  Never redraw, retrace, re-path, simplify or "optimize" these files from prose
  or screenshots. Inline SVG in the app reproduces the file's element geometry
  and attributes exactly; color comes only from `currentColor`.
- **[D1-2.2]** The locked files and their SHA-256 hashes:

| File                               | Role                                            | SHA-256                                                            |
| ---------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| `folio/assets/mark.svg`            | Brand mark: diamond frame with centered ink dot | `9f52ab4eb3564126efed7d988f3e6e162d6fec700d105fbdb1910b90db5266b2` |
| `folio/assets/emblem-loom.svg`     | Cast emblem: Loom                               | `42e0cb8f5d00096e3f052e5e8bc931a62026f3a74f2f96c0e1442241f107884b` |
| `folio/assets/emblem-vesper.svg`   | Cast emblem: Vesper                             | `8f35f756c60ebdfe3e4089c775ab1f155fbc0cd9ca1564ebc68ab0ae74f2166d` |
| `folio/assets/emblem-prism.svg`    | Cast emblem: Prism                              | `94963e98654c48bcc9f41c09b61b257831eea4e6c2d998b504aa199c72015e16` |
| `folio/assets/emblem-clover.svg`   | Cast emblem: Clover                             | `5fbefe904cb35bab8a7d4f6b534908c8547ab7a32007ca4a20cf79ed6d99aefe` |
| `folio/assets/emblem-orrery.svg`   | Cast emblem: Orrery                             | `0ae0ba0f15d2e0785ef4ebdd5da8fd721da3c7ed55dfc74b5743f6369cc7780b` |
| `folio/assets/emblem-arch.svg`     | Cast emblem: Arch                               | `b0e24220d049bd3a724f4741f9722ffabc428f119279748579bc3652dd1f52e7` |
| `folio/assets/emblem-pinwheel.svg` | Cast emblem: Pinwheel                           | `93d733347d10756e10a7e072b587987c36cfcdac2e73e9db9b092011014c8321` |
| `folio/assets/emblem-lattice.svg`  | Cast emblem: Lattice                            | `c5f3ad8236302cace0d19b1ef50bddae09e8f88b53cfa393b0eec7297145ed83` |
| `folio/assets/tokens.json`         | Design tokens (type, radii, motion, colors)     | `303f930f243ebcdd211dc22702f0495a62e3d2d121d2e394c8ee889027e9d7ef` |
| `folio/assets/checksums.json`      | SHA-256 manifest of every file above            | (the manifest itself)                                              |

- **[D1-2.3]** Brand mark. `mark.svg` (`viewBox="0 0 20 20"`, `1.5` stroke) sits
  beside the `Linejam` wordmark in the top bar and is the only source for every
  raster icon:
  - `/favicon.ico` (16 and 32 px frames);
  - `/apple-touch-icon.png`: `180×180`, fully opaque, `#224e42` mark centered on
    an opaque `#f4f1ea` background, no transparency;
  - `/icon-192.png` and `/icon-512.png`: `#224e42` mark on `#f4f1ea`;
  - `/icon-maskable-512.png`: the same, with the mark inside the central `80%`
    safe zone and `#f4f1ea` filling to every edge.
- **[D1-2.4]** Cast emblems. The eight emblems are `24×24` geometric line marks
  (`viewBox="0 0 24 24"`, `stroke="currentColor"`, `stroke-width="1.5"`, round
  caps and joins). They are the player avatars from `PRODUCT.md` `[L1-2.1]`. An
  emblem renders in `--ink` at rest and `--accent` when selected or marking the
  current player; it never gets a per-player color, fill tint or badge
  background. Each emblem's name is its accessible label (`Loom`, `Vesper`,
  `Prism`, `Clover`, `Orrery`, `Arch`, `Pinwheel`, `Lattice`).
- **[D1-2.5]** Tokens. `tokens.json` is the single source of type stacks, radii,
  motion and both color modes. Application tokens are generated from or
  checked against it; no color, radius, easing or duration outside it appears
  in the UI.
- **[D1-2.6]** Any change to a canonical file changes `checksums.json` and this
  table in the same Folio change. The implementation's verification recomputes
  SHA-256 for every file and fails on any mismatch.

## [D1-3] Color system and color modes

- **[D1-3.1]** The palette is exactly the `light` and `dark` sets in
  `folio/assets/tokens.json`, exposed as CSS custom properties:

| CSS property         | Token             | Light                     | Dark                        |
| -------------------- | ----------------- | ------------------------- | --------------------------- |
| `--bg`               | `bg`              | `#f4f1ea`                 | `#151412`                   |
| `--bg-desk`          | `bgDesk`          | `#eeeae1`                 | `#12110f`                   |
| `--surface`          | `surface`         | `#fcfbf8`                 | `#1d1b18`                   |
| `--surface-subtle`   | `surfaceSubtle`   | `#ede9df`                 | `#25221e`                   |
| `--surface-elevated` | `surfaceElevated` | `#ffffff`                 | `#27241f`                   |
| `--ink`              | `ink`             | `#1b1916`                 | `#f1ede5`                   |
| `--ink-secondary`    | `inkSecondary`    | `#534f47`                 | `#c1bab0`                   |
| `--ink-muted`        | `inkMuted`        | `#656057`                 | `#989084`                   |
| `--hairline`         | `hairline`        | `#dfd8cc`                 | `#2f2b25`                   |
| `--hairline-strong`  | `hairlineStrong`  | `#c9c1b3`                 | `#443f37`                   |
| `--accent`           | `accent`          | `#224e42`                 | `#7ab5a2`                   |
| `--accent-hover`     | `accentHover`     | `#1a3e34`                 | `#8cc4b2`                   |
| `--accent-ink`       | `accentInk`       | `#fcfbf8`                 | `#121c19`                   |
| `--accent-soft`      | `accentSoft`      | `rgba(34, 78, 66, 0.08)`  | `rgba(122, 181, 162, 0.12)` |
| `--accent-border`    | `accentBorder`    | `rgba(34, 78, 66, 0.28)`  | `rgba(122, 181, 162, 0.34)` |
| `--danger`           | `danger`          | `#9f3b2e`                 | `#e28374`                   |
| `--danger-soft`      | `dangerSoft`      | `rgba(159, 59, 46, 0.09)` | `rgba(226, 131, 116, 0.14)` |
| `--danger-border`    | `dangerBorder`    | `rgba(159, 59, 46, 0.34)` | `rgba(226, 131, 116, 0.38)` |
| `--heart`            | `heartActive`     | `#a84237`                 | `#e08276`                   |
| `--heart-soft`       | `heartSoft`       | `rgba(168, 66, 55, 0.09)` | `rgba(224, 130, 118, 0.14)` |

- **[D1-3.2]** Roles. `--bg` is the page canvas; `--bg-desk` is the band behind
  desktop spreads; `--surface` is the stationery sheet; `--surface-subtle` is
  quiet fills (inactive tags, the cadence track); `--surface-elevated` is menus,
  dialogs and the QR plate. `--accent` is the one primary action per screen,
  focus rings, the selected emblem and the current round; it never fills large
  areas. `--danger` is errors and destructive confirmations only. `--heart` is
  the active heart only.
- **[D1-3.3]** Contrast meets WCAG AA in both modes: `>= 4.5:1` for normal
  text and `>= 3:1` for large text and UI components. Every text token (`ink`,
  `inkSecondary`, `inkMuted`, `accent`, `danger`, `heartActive`) meets
  `>= 4.5:1` on every background token in its mode, and `accentInk` on `accent`
  meets `>= 7:1`. `hairline` and `hairlineStrong` are below `3:1` and are
  therefore decorative separators only; the boundary that identifies an input or
  control uses `--ink-muted`, and focus is a `2px` `--accent` ring with `2px`
  offset.
- **[D1-3.4]** Modes. The first visit follows `System`
  (`prefers-color-scheme`). One persistent Light / Dark / System toggle in the
  top bar stores the explicit choice; `System` keeps following the OS. The
  saved mode applies before first paint, with no flash of the other mode and no
  hydration mismatch.
- **[D1-3.5]** The top bar is an opaque `--bg` band with a `1px` `--hairline`
  bottom rule. There is no translucent, blurred or `backdrop-filter` header on
  any viewport.

## [D1-4] Typography and spatial rhythm

- **[D1-4.1]** Three self-hosted OFL families, served by the Worker as `woff2`
  with `font-display: swap`. Zero external font or asset requests (no CDN, no
  Google Fonts):
  - `Newsreader` — the `Linejam` wordmark, headings, the preceding line and
    completed poem verse;
  - `Plus Jakarta Sans` — UI labels, controls, inputs and roster names;
  - `IBM Plex Mono` — room codes and every count (round `x/9`, word tally,
    player count) with `font-variant-numeric: tabular-nums`.
  - Fallback stacks are exactly the `typography` stacks in `tokens.json`.
- **[D1-4.2]** Radii are exactly: `12px` for a stationery sheet, `8px` for
  controls and inputs, `6px` for quiet tags. Rules are editorial hairlines:
  `1px solid var(--hairline)`.
- **[D1-4.3]** Phone first (`320px`–`390px`). At `390×844` every screen is one
  generous full-width column of stationery with compact outer padding (`16px`),
  `0px` horizontal overflow, touch targets `>= 44×44px` and input text
  `>= 16px`. At `320px` nothing truncates the room code, pen name or a poem
  line; long text wraps.
- **[D1-4.4]** Desktop (`1440×900`) uses balanced two-column salon spreads,
  centered on the `--bg-desk` band:
  - **Landing** (`~920px` max width): left — `Linejam` wordmark, `Pen name`
    input and the 8-emblem `Emblem` picker; right — a crisp action sheet with
    `New room`, then `Room code` input and `Join`.
  - **Lobby** (`~960px`): left — room code, the dynamic QR (`~216px`, see
    `[D1-7.2]`) and `Share invite`; right — the live roster and the primary
    `Start game`.
  - **Writing** (`~920px`): left — round `x/9`, the `1-2-3-4-5-4-3-2-1` cadence
    track with the current round marked, and the `Previous` line; right — the
    calm compose sheet, the live mono word tally and `Tuck line`.
  - **Reveal** (`~1040px` folio spread): the reading-circle order rail, the
    left-aligned 9-line poem in `Newsreader` at `24–26px` with write-time
    bylines, the heart toggle, the share control with its disclosure,
    `Next poem` and `Play again`.
- **[D1-4.5]** On phones the same content stacks in the order listed above
  (left column first). Poem verse on phones is `Newsreader` `>= 20px`. Poems are
  always left-aligned, never centered.

## [D1-5] Zero narrator copy

- **[D1-5.1]** Every visible string passes the **Delete Test** (removing it loses
  nothing the player needs) and the **Self-Reference Test** (it never narrates
  the interface or explains an obvious mechanic). No subtitles that paraphrase
  their heading, no "click below to…", no onboarding prose on game screens.
- **[D1-5.2]** Labels are concise 1–3 word nouns or verbs. The canonical labels
  are: `Pen name`, `Emblem`, `New room`, `Room code`, `Join`, `Share invite`,
  `Start game`, `Previous`, `Tuck line`, `Line tucked`, `Next poem`,
  `Play again`.
- **[D1-5.3]** Errors state plainly what to fix (for example `Use 3 words`,
  `Room is full`, `Room code not found`) at the control that failed.
- **[D1-5.4]** The share control always discloses
  `"Anyone with this link can read this poem"` before a link is published.

## [D1-6] Universal subtle motion and reduced motion

- **[D1-6.1]** One token set, from `tokens.json`:
  - `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`;
  - `90ms` tap: pressed controls scale to `scale(0.975)`;
  - `160ms` micro feedback: emblem selection, word tally tick, heart settle;
  - `220ms` screen transitions, and a horizontal error / over-count nudge of
    `<= 4px`.
- **[D1-6.2]** Only `transform`, `opacity` and color animate. Motion never
  blocks or delays input, never hides content that is already available, and
  never loops while the screen is at rest.
- **[D1-6.3]** Under `prefers-reduced-motion: reduce`, all movement is removed:
  states change instantly or with a subtle `<= 120ms` opacity crossfade, and
  every screen shows its full static composition. No information depends on
  motion.

## [D1-7] Interaction details and acceptance bar

- **[D1-7.1]** Top bar, left to right: the brand mark with `Linejam` as one home
  button; the active room code badge (mono) during lobby and game; then the
  theme toggle, the sound mute toggle (when audio cues are enabled) and one
  compact room options menu (How to play, Your poems, and Leave / End / Close,
  each with a confirmation that has a clear safe exit). Every icon-only control
  has an accessible name.
- **[D1-7.2]** The QR is a dynamic ISO/IEC 18004 code that always encodes the
  live room's actual join URL. It has a 4-module quiet zone and renders as
  `#1b1916` modules on an opaque `#ffffff` plate in both modes.
- **[D1-7.3]** Each screen has exactly one invitation area. Code tap-to-copy and
  `Share invite` (native share with copy fallback) report success or failure at
  the action itself.
- **[D1-7.4]** Acceptance requires a headed Chrome run at `1440×900` and
  `390×844`, in Light, Dark and `prefers-reduced-motion: reduce`, that records:
  - `0` console, page and CSP errors;
  - `0` external font or asset requests;
  - `0px` horizontal overflow;
  - every touch target `>= 44×44px` and every input `>= 16px`;
  - a byte-exact SHA-256 match of every served canonical asset against
    `folio/assets/checksums.json`.
