# Linejam DESIGN.md

This file is the product's public-site brand contract. Keep it short and exact:
agents and humans should be able to update `site/` from this file without
inventing a second design system.

## Brand Voice

- Playful, warm, human — this is a party game, not operator infrastructure.
- Lead with the fun (chaos, laughter, the reveal), then the real round
  structure and a real completed poem.
- Avoid corporate SaaS language ("leverage", "solution", "streamline"). Talk
  like you're describing game night to a friend.
- Make no usage, audience-validation or testimonial claim without current evidence.

## Pitch One-Liner

`Linejam turns a room of friends into accidental poets — pass a line, see only
what came before, and read the chaos aloud together.`

## Mark

- Use the DynaPuff Linejam wordmark; app icons use the original paired speech shapes
  in `public/linejam-mark.svg`. No stock scroll icon or exploration name.

## Palette Hooks

The static site uses the same identity as the app. `lib/design/tokens.ts` is the
token owner. `site/tokens.css` and `site/fonts/` are generated from the app by
`pnpm site:tokens`. `site/linejam.css` is the static shell: type scale, soft
elevation, and Light/Dark/System.
Do not add `--ae-*` tokens or a second identity.

Use the shared action and focus tokens:

```css
:root {
  --color-background: #eee8ff;
  --color-surface: #ffffff;
  --color-foreground: #39234e;
  --color-primary: #672cb5;
  --color-focus-ring: #672cb5;
}
:root.dark {
  --color-background: #23172f;
  --color-surface: #33223f;
  --color-foreground: #f7f1ff;
  --color-primary: #d5b5ff;
  --color-focus-ring: #d5b5ff;
}
```

Do not add a second identity, selector, or token override to a static page.

## Typography

- Wordmark and arrival headings: DynaPuff, weights 500 and 600.
- Interface text, functional headings and poems: Nunito Sans, weights 400, 600
  and 700.
- `site/linejam.css` loads the same local font files the app ships. Do not add
  page-local font stacks or remote font sources.

## Content inventory

The site explains the human game, the round structure and privacy boundary,
with direct host/join links. Historical proof compositions are not current
screenshots or evidence for the redesigned application.

`docs/labs/linejam-921-proof-assets/` is the retained record of the earlier
proof-asset decision. It describes the previous identity and is history, not the
current site contract.

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
