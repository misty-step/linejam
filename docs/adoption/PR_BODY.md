# Make @misty-step/aesthetic the substrate

linejam's Kenya theme was already our philosophy — Zen-garden
minimalism, ink on paper. This PR makes that real at the foundation:
**aesthetic becomes the default theme and the token substrate**, so
linejam is recognizably misty-step at the level that matters most —
the tokens, the type, and the law — without tearing out the theme
system that gives the other presets their character.

## The approach — substrate, not scorched earth

Rather than rip out linejam's runtime theme infrastructure, this adds
an **`aesthetic` preset** (`lib/themes/presets/aesthetic.ts`) whose
every token points straight at the `--ae-*` custom properties, and
makes it the **default theme**. The preset adds nothing of its own —
it _is_ the design system. Mono / Vintage / Hyper stay registered as
legacy presets for now (see "open question").

- **`package.json`** — depends on `github:misty-step/aesthetic#v2.5.1`.
- **`app/globals.css`** — the Tailwind bridge maps the canonical
  ADOPTING.md §5 token names onto `--ae-*`; the persimmon is steered
  once here:

  ```css
  :root {
    --ae-accent: #c2410c;
    --ae-accent-dark: #ff8a5c;
  }
  ```

- **`app/layout.tsx`** — Geist + Geist Mono via `next/font` feed
  `--ae-font` / `--ae-font-mono`; the default theme flips to
  `aesthetic`.
- **`lib/themes/presets/kenya.ts`** — collapsed from ~180 lines to a
  thin pointer at the substrate (Kenya _was_ the proto-aesthetic).
- **`lib/themes/registry.ts`** / **`index.ts`** — register the new
  default.

## Verification

- `pnpm exec tsc --noEmit` — clean (fixed a dangling `ibmPlex` font
  reference the font swap left in `layout.tsx`).
- `pnpm run lint` — clean.
- `pnpm exec next build` — **compiles successfully** and type-checks;
  the build only stops at prerender on invalid dummy Clerk/Convex
  credentials (a pre-existing `validateEnv` requirement, unrelated to
  this change). A branch preview with real keys renders end to end.

## Two open questions for review

1. **Components.** This PR re-grounds the _substrate_; the tactile
   `Button` (hanko / washi press) and the form controls are **not yet
   re-costumed** onto `.ae-button` / `.ae-input`. That's the natural
   follow-up — staged separately so the substrate can land and be
   reviewed on its own.
2. **The four themes.** Mono / Vintage / Hyper remain registered.
   The doctrine's path is that they collapse to steering (one accent
   per personality) or retire; this PR defaults _away_ from them
   without deleting them. Your call on whether they stay as presets or
   go.

## Baseline

The landing today (the wordmark, the persimmon CTA) — the surface this
substrate now feeds; the visible component re-costume is the follow-up
above:

![before](docs/adoption/before-home-light.png)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
