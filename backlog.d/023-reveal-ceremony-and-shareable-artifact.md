# Make the reveal a ceremony and a one-tap shareable group artifact

Priority: P1 · Status: pending · Estimate: L

Milestone: aesthetic polish + growth loop (sequence after the launch-readiness
items 020–022).

## Goal

The payoff moment — the reveal — lands as a paced, delightful ceremony AND
produces one screenshot-worthy shareable artifact of the whole session, turning
the funniest minute of game night into the acquisition channel.

## Oracle

- [ ] Reveal pacing follows the poem's own 1,2,3,4,5,4,3,2,1 word-shape with a
      crescendo into the final line (not a flat 1000ms/line metronome),
      respecting `prefers-reduced-motion`.
- [ ] The room-favorite "crown" is a distinct ceremonial moment (heart-burst →
      crown settle), not a static badge.
- [ ] Optional sound + haptic punctuation on reveal/crown (mobile-first,
      default-on with a mute) — zero exists today.
- [ ] At session end the group gets ONE "Share the whole set" action backed by a
      typeset session OG image at `/recap/[code]/opengraph-image`; the two
      near-identical recap share buttons collapse to one.
- [ ] Per-poem share text is seeded with the poem's actual opening line (not the
      generic "Read this poem from our Linejam session").

## Verification System

- Claim: the reveal is worth screenshotting and sharing, and the share drives new
  players.
- Falsifier: the reveal is a uniform metronome with no climax; the only shareable
  unit is a generic-text single poem.
- Driver: a 4-theme reveal walkthrough + a rendered `/recap/[code]/opengraph-image`.
- Grader: visual review of pacing/crown/motion across themes; the OG card renders
  the session.
- Evidence packet: a screen recording of the reveal + the recap OG image.
- Cadence: milestone-2 polish; verified by a screenshot/recording walk.

## Notes

Convergent across the design and product/exemplar lanes. Today
`components/PoemDisplay.tsx:27` hardcodes `BASE_REVEAL_DELAY=1000ms`; grep for
vibrate/Audio/confetti returns empty; the crown is a static `Heart`
(`SessionRecapHub.tsx:129`); the reveal is private per-poem (`RevealPhase.tsx`)
with no single-frame group artifact. The single-poem OG pipeline already exists
(`app/poem/[id]/opengraph-image.tsx`) — reuse it for the session recap. Gartic
Phone / Jackbox prove the reveal is the category's growth engine. Depends on the
design-token wiring in [025] for the motion to feel coherent. Stays within
anti-goals (no gamification).
