# linejam-943 — Poem Artifact Card: Design Lab Decision

Lab: `explorations/poem-artifact-card-lab/index.html` (8 structurally distinct
options, theme-switchable across kenya/mono/vintage-paper/hyper-dark).
Screenshots taken live via local static server during review (2026-07-07).

## Winner: 01 — Stamp Ledger

The existing `app/poem/[id]/opengraph-image.tsx` and
`app/recap/[code]/opengraph-image.tsx` already render this exact pattern
(left-aligned line stack, thin primary-color rule, sans-serif metadata row,
circular stamp mark) — it is the poem card's established visual identity,
seen today on every link preview. The card note is explicit: wire that
renderer into save-as-image/print, don't build a second one.

Implementation delta from what ships today: the metadata row currently reads
`By N poets` with no names. The winning treatment upgrades that single line
to list every unique author and append `(AI)` for bot authors — e.g.
`Emily, Marcus, Priya, Wendell (AI) · linejam.app` — which satisfies
acceptance criterion 3 (attribution + AI marking on every exported artifact)
without any structural change to the card. Layout, rule, and stamp are
untouched. This is the lowest-regression-risk path: it is a data change
(pass attributed lines instead of a poet count) to an existing, shipped
renderer, not a new component.

## Runner-up considered seriously: 02 — Marginalia

Per-line author dots mirror the on-screen reveal experience
(`components/PoemDisplay.tsx` already renders a dot-gutter with the same
`getUniqueColor` palette) and would make per-line authorship the headline
feature rather than an aggregate credit line. Rejected for v1 because it
requires per-line color assignment logic to be duplicated server-side in the
edge renderer (Satori has no access to the client's `getUniqueColor` module
without porting it), doubling the surface the card note asked to avoid
growing. Worth revisiting if the operator wants per-line attribution on the
artifact itself, not just an aggregate line — flag as a fast-follow, not a
blocker for this ship.

## Rejected

- **03 Broadside Poster / 06 Index Card / 07 Byline Interleave** — all three
  reshape the poem's typography or add ruled/interleaved chrome that reads as
  a new product surface, not the existing card grown up. Distinctive, but
  not what "wire the existing renderer" asked for.
- **04 Postcard / 08 Full Bleed Portrait** — real aspect-ratio departures
  (both would need dedicated size math and, for the portrait crop, a second
  layout the OG renderer doesn't have today). Good future direction for a
  dedicated "story" export once the base artifact ships and has usage data
  (ties into criterion 6's analytics — build the fancier crop only if the
  data says people want it).
- **05 Colophon** — closest runner-up after Marginalia; centered poem +
  book-imprint block reads well but centers text the existing renderer left-
  aligns, which is a bigger visual change for the same attribution outcome
  Stamp Ledger achieves with a one-line data change.

## What actually shipped

`lib/poemCard/` extracts the font-loading + JSX-building pattern already
living in `app/poem/[id]/opengraph-image.tsx` into shared, theme-aware
functions. The existing OG routes are refactored to call the shared builder
(output unchanged — same hex values, same layout, verified by direct
component test). The new `/poem/[id]/card` download route and the recap
print stylesheet both consume the same builder with the Stamp Ledger
treatment, full attribution line, and the room's active theme (light or
dark) instead of the previous poet-count-only, kenya-only version.
