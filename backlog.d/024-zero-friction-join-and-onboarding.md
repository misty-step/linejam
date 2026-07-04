# Zero-friction join (QR + tap-copy) and teach-by-doing onboarding

Priority: P1 · Status: done · Estimate: L

Milestone: spans launch-readiness (join friction) and aesthetic polish
(onboarding feel).

## Goal

A first-time group of friends on phones gets from landing → playing → reveal with
one person never opening "How to Play" and a second person joining by
scanning/tapping the code, not retyping it.

## Oracle

- [x] The lobby shows a scannable QR that drops a phone straight into
      `/join?code=…`; tapping the room code copies the bare 4-char code (distinct
      from the invite URL) — closes the long-standing issue #170 properly.
- [x] A first-run inline coachmark on the writing screen teaches the
      partial-visibility + word-count mechanic, shown once per device, without
      opening the help modal.
- [x] A late/mid-game arrival sees an explanatory "game in progress — you're in
      for the next round" state instead of an empty waiting screen.
- [x] The landing/join page has a one-sentence "what happens" beat before a
      cold-linked friend commits a name.
- [x] The submit-failure path routes through `errorToFeedback` (not the hardcoded
      English string), matching the rest of the app.

## Verification System

- Claim: friends can start and join without friction or explanation on phones.
- Falsifier: joining requires retyping a 4-char code; a first writer has no idea
  the rest of the poem is hidden; a late arrival hits a dead end.
- Driver: a mobile-viewport walkthrough — host creates → second device scans QR →
  both play → reveal.
- Grader: the walkthrough completes with no help-modal open and a scan-based join.
- Evidence packet: a mobile screen recording of scan-to-join + the coachmark.
- Cadence: milestone-1/2; verified by a mobile walkthrough.

## Notes

From the UX and product/exemplar lanes. Today the room code is a non-interactive
`<span>` (`RoomChrome.tsx:116`) and `Lobby.tsx:203` tells users to "share the code
from the top bar" — text they can't copy; no QR exists anywhere. Rules are two
taps deep (behind the overflow menu). Mid-game join lands on an empty
`WaitingScreen` with no explanation (`WritingScreen.tsx:287`). Submit failure uses
a hardcoded string (`WritingScreen.tsx:154`). Jackbox's QR join is the category
table-stakes; reuse the existing `useShareLink` flow in `RoomChrome.tsx`.
