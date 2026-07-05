# Linejam DESIGN.md

This file is the product's public-site brand contract. Keep it short and exact:
agents and humans should be able to update `site/` from this file without
inventing a second design system.

## Brand Voice

- Playful, warm, human — this is a party game, not operator infrastructure.
- Lead with the fun (chaos, laughter, the reveal) then the proof (real
  screenshots, real round structure).
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

The scaffold pins `data-ae-theme="ember"` as the closest built-in match to
Linejam's real in-app palette, then overrides the accent to the exact hex
Linejam already ships (Kenya theme, the app's default): warm white
background, near-black ink, and a persimmon/vermillion accent — distinct from
Powder's blue and Landmark's palette.

```css
:root {
  --ae-accent: #e85d2b;
  --ae-accent-dark: #f06b3b;
}
```

Source: `lib/themes/presets/kenya.ts` (`color-primary: #e85d2b` light /
`#e85d2b` dark-accent-hover `#f06b3b`), the default theme the live app boots
with. Linejam ships 3 additional in-app themes (`hyper`, `mono`,
`vintage-paper`) but the marketing site pins one register rather than
exposing a theme switcher.

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
