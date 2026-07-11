# Linejam Design Contract

The repo-owned visual contract. Agents doing visual work read this first.
Provenance: design lab-001 (`explorations/lab-001/`, three operator verdict
rounds, 2026-07) and its `SYNTHESIS.md`. Tokens live in `lib/themes/`;
this file owns the spine — the layout system every theme wears.

## Product truth

A party game played by 4-6 friends on phones in the same room, 99% mobile.
Rounds of 1-2-3-4-5-4-3-2-1 word lines; you see only the previous line; the
finale is a reading circle where each player reads one whole poem aloud.

## Laws (operator-locked, non-negotiable)

1. Mobile-first at 390x844. Primary action lives in the thumb zone: anchored
   to the bottom of the viewport on phones, >=44px tall.
2. Word slots always grow with their word. Clipping a word can never happen.
3. On reveal/read surfaces the poem line text starts at one consistent
   horizontal position and vertical rhythm; line numbers and author bylines
   never shift it.
4. Button labels are plain verbs ("Done", "Submit", "Start"). Context copy
   sits near the button, never inside it.
5. The read view shows the WHOLE poem at once. There is no line-by-line
   reveal and no phone handoff.
6. Every visual value comes from theme tokens (`var(--color-*)`, fonts,
   radius, shadow, durations). Structure is theme-agnostic; ten themes wear
   one spine. No hardcoded colors or font families in screen components.
7. WCAG AA floor (enforced by tests/lib/themeContrast.test.ts); honor
   prefers-reduced-motion; motion only on game moments, never ambient.
8. `lib/e2eTestIds.ts` is a load-bearing contract: every existing testid and
   aria pattern survives any reshape (hosted E2E depends on them).

## Spine anatomy (per screen)

- **Home**: brand moment + two stacked CTAs (Start a game primary, Join a
  room secondary) in the thumb zone.
- **Host/Join**: one field (+ code field on join), one CTA, zero ceremony.
- **Lobby**: the party warm-up. Room code is the hero, legible across a
  table. Players listed with presence, host, and bot marks. Host's start CTA
  bottom-anchored; non-hosts see who they're waiting for.
- **Write**: the received line is the only context, displayed large. The
  word-count constraint renders as growing word chips (the typed words
  themselves, each chip sized to its word) plus remaining empty slots.
  Submit bottom-anchored.
- **Wait**: "line delivered" state; who is still writing, with presence;
  round progress. Keeps the party's energy, never feels like an error.
- **Reveal**: the reading circle. One ordered list with per-reader status
  (read / reading now / up next / to come); your assignment is the hero
  when it is your turn ("Reveal & Read").
- **Read**: the whole poem, aligned per law 3, bylines with lines, then a
  plain "Done".

## Voice

Short, warm, party-toned. No meta-copy, no em-dashes in UI strings, no
prescriptive button labels.
