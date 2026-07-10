# Theme synthesis plan (round 3 — selector locked, roster set)

Operator direction: don't crown one winner; synthesize the surviving systems
into themes Linejam supports, and make theme choice a distinct first-class
page.

## Locked decisions (round 3)

- **Theme selector page: ANTHRO-6 "Specimen"** — a type-specimen book where
  every theme previews as a real poem line in its own paper/ink/accent.
- **Top-10 theme roster** (operator delegated the pick; 5 light / 5 dark):
  Light: Kenya, The Fold, Overprint, Broadside, Poem Catalog.
  Dark: Aloud, Seats, Console, Board, Hyper.
  Cut: Mono (Broadside owns the print-black voice better), Vintage Paper
  (Fold + Catalog cover its paper territory), Pass the Map, First Edition.
  Migration: Mono and Vintage Paper are currently shipped — map existing
  selections (Mono -> Broadside, Vintage Paper -> The Fold) or grandfather.
- **Copy rule:** button labels are plain verbs ("Done"), never prescriptive
  ("Done, pass to Sam"). Context info may appear near the button, not in it.

## What the current theme system can and cannot do

`lib/themes/` today: four presets (kenya, mono, vintage-paper, hyper) applied
as CSS custom properties via ThemeProvider. That carries color, type, radius,
shadow. It does NOT carry structure: a split-flap board, a fold metaphor, or
route diagrams are components, not variables.

## The split that makes this shippable

1. **One canonical UX spine, locked.** The interaction patterns the verdicts
   converged on become the single spine for all themes:
   - lobby: giant shareable room code + presence list (Seats' lobby was the
     benchmark)
   - write: previous line as the only context + word-slot expression of the
     constraint (slots grow with the word, never clip)
   - wait: "line delivered / who's still writing"
   - reveal: the reading circle (read / now / next queue; "read yours" CTA)
   - read: the WHOLE assigned poem at once, bylines aligned (line starts never
     shift), pass-the-mic done affordance
2. **Tier-1 themes: token skins.** Survivors whose identity is carried by
   color + type + shape + texture map directly onto a widened token contract
   (add font-role, texture/border-style, and motion-band tokens to the
   preset schema): Aloud, Seats, Broadside, Overprint, Poem Catalog,
   Pass the Map, First Edition.
3. **Tier-2 themes: skins + bounded ornament slots.** Console (terminal
   chrome, TX framing) and Board (split-flap tiles) want one or two bespoke
   components. Add named optional slots to the spine (e.g. `WordSlots`,
   `RoomCodeDisplay`) that a theme may override; everything else stays token
   driven. Slots are the budgeted exception, not the norm.

## Proposed shipping order

1. Lock the spine + widened token schema (one PR).
2. Port 2-3 Tier-1 themes first (operator picks; Aloud and Seats are the
   evident favorites) to prove the schema.
3. Theme-selector page (winner of the SELECTOR section) ships with the first
   new themes.
4. Remaining Tier-1 themes; then Tier-2 slot mechanism; then Console/Board.

## Open questions for the operator

- Are themes free or premium ("4 premium themes" is the current copy)?
- Does theme choice stay per-device, or become per-room (host sets the vibe
  for everyone)? Per-room is the party-native answer but touches Convex state.
- Cap on shipped themes for v1 (suggest 6-8: 4 existing + 2-4 new).
