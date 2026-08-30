# Linejam DESIGN.md

This file is the product's public-site brand contract. Keep it short and exact:
agents and humans should be able to update `site/` from this file without
inventing a second design system.

## Brand Voice

- Playful, warm, human — this is a party game, not operator infrastructure.
- Lead with the fun (chaos, laughter, the reveal) then the proof (real
  screenshots, real round structure, and a real completed poem).
- Avoid corporate SaaS language ("leverage", "solution", "streamline"). Talk
  like you're describing game night to a friend.
- Still honest: no invented user counts, testimonials, or metrics — the game
  is wedding-validated, and that's the only usage claim we make.

## Pitch One-Liner

`Linejam turns a room of friends into accidental poets — pass a line, see only
what came before, and read the chaos aloud together.`

## Lucide Mark

- Icon: `scroll-text`
- Reason: linejam's own `app/icon.png` is a stylized parchment scroll with a
  vermillion ribbon and dot detailing — `scroll-text` is the closest Lucide
  primitive to that existing mark (a scroll icon with text-line strokes),
  reused rather than inventing a new symbol.
- Rule: the mark is an inline Lucide SVG inside `.ae-app-mark`. No bespoke
  marks, logo images, emoji marks, or colored wordmarks.

## Palette Hooks

The static site uses one Ink & Anticipation identity in every color mode.
`aesthetic.css` is the single owner of the shared `--ae-*` tokens; the
`ae-mode` control changes only the light/dark presentation while System
continues to follow the operating system.

Keep action/link and keyboard-focus colors distinct:

```css
:root {
  --ae-surface: #faf9f7;
  --ae-wash: #ffffff;
  --ae-ink: #1c1917;
  --ae-accent: #b43a12;
  --ae-focus: #e85d2b;
  --ae-surface-dark: #1c1917;
  --ae-wash-dark: #292524;
  --ae-ink-dark: #faf9f7;
  --ae-accent-dark: #f06b3b;
  --ae-focus-dark: #e85d2b;
}
```

Do not add a second identity, selector, or token override to a static page.

## Typography

- Display and poem text: Libre Baskerville, weights 400 and 700.
- Interface and body text: IBM Plex Sans, weights 400, 500, and 700.
- Code and compact labels: JetBrains Mono, weight 400.
- `aesthetic.css` loads pinned Fontsource assets and owns the three font tokens.
  Do not add page-local font stacks.

## Screenshot Inventory

| File                                      | Surface                | State                                   | Caption                                                       |
| ----------------------------------------- | ---------------------- | --------------------------------------- | ------------------------------------------------------------- |
| `site/assets/screenshots/01-overview.png` | Landing page           | `https://www.linejam.app` home          | Real live marketing/landing screen.                           |
| `site/assets/screenshots/02-workflow.png` | Live room, Round 1     | Anonymous host + 1 AI player, mid-round | Real gameplay: "Round 1 · 1 word", write-your-line prompt.    |
| `site/assets/screenshots/03-release.png`  | GitHub public releases | `misty-step/linejam` releases page      | Real, public, proves the repo's visibility + release cadence. |

All three were captured live during this pass as an anonymous guest: opened
`linejam.app`, clicked through Host Session -> Create Room -> Add a bot ->
Start Linejam to reach the actual round-1 writing screen (no account or
seed data needed). Supplementary evidence (mobile-width captures of the same
flow) is saved alongside as `gameplay-mobile-390.png` and
`linejam-app-mobile-390.png` but not used in the gallery.

## Proof Asset Inventory

| Surface                                                | Source                                      | Purpose                                                                          |
| ------------------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------- |
| Finished poem in `site/index.html#proof`               | `https://www.linejam.app/recap/BFIO` Poem 1 | Shows the game artifact as readable HTML text, not as a screenshot.              |
| CSS reveal loop in `site/index.html#proof`             | Same Room BFIO poem                         | Gives the marketing site reveal-in-motion with no external CDN media dependency. |
| Public recap link `https://www.linejam.app/recap/BFIO` | Live signed-out recap route                 | Lets a stranger inspect a completed room with two poems by two poets.            |

Design lab: `docs/labs/linejam-921-proof-assets/index.html`. Locked option:
artifact plus reveal reel, recorded in
`docs/labs/linejam-921-proof-assets/DECISION.md`.

## Footer Links

- Misty Step: `https://mistystep.io`
- GitHub: `https://github.com/misty-step/linejam` (repo is public)
- Weave: omitted — Linejam is not a Weave-family product (no repo references
  found).

## Release Notes Rule

`site/changelog.html` is user-facing. Write entries as product outcomes, not
commit logs. Each entry needs a date, a version or release label, and one or two
plain-language bullets. Sourced from `CHANGELOG.md` (semantic-release
generated) — entries below are the most recent user-facing ones, reworded
in plain language.
