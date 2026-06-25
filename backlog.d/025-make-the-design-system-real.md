# Wire the themed design tokens so the system is real, not aspirational

Priority: P2 · Status: ready · Estimate: M

Milestone: aesthetic polish (foundational — do before the reveal-ceremony motion
in 023).

## Goal

The defined typographic scale, spacing, leading, and tracking actually render
across all four themes — closing the gap between a design system that exists in
data and one that ships, the foundation of Stripe-level coherence.

## Oracle

- [ ] `text-*`, `space-*`, `leading-*`, `tracking-*` tokens are registered in
      `@theme` (`app/globals.css`) so components stop falling back to Tailwind
      defaults; a 4-theme visual diff shows the tuned scales applying.
- [ ] `app/error.tsx` and `app/global-error.tsx` are on-system (Button component,
      theme colors, display font) matching `not-found.tsx`; the undefined
      `text-muted-foreground` token is gone.
- [ ] The font story is reconciled: either `kenya` restores the documented
      Cormorant + Inter pairing, or the docs document the real per-theme pairings
      (no doc/preset drift).
- [ ] Hardcoded color/shadow escapes (e.g. `Lobby.tsx:274` raw rgba shadow) are
      replaced with theme tokens; the Quality Bar "themes render without hardcoded
      overrides" holds.

## Notes

From the design/aesthetic lane. `lib/themes/apply.ts:33` writes every token as a
CSS var, but `app/globals.css` `@theme` registers ONLY colors/shadows/radius/
durations — not type/space/leading/tracking — so the Perfect-Fourth / modular
scales are defined-but-unapplied (components reference `var(--text-*)` twice,
`var(--space-*)` zero times). Error boundaries use the shadcn
`text-muted-foreground` token, undefined in this repo. Only `vintage-paper` uses
the documented Cormorant; `kenya` (the default, the face of the product) uses
Libre Baskerville + IBM Plex. This is near-zero-per-component leverage: wiring the
tokens once makes all four themes instantly more intentional.
