# Poem

Stories: US-002
Source: app/room/[code]/**, convex/game.ts, convex/schema.ts, convex/lib/assignmentMatrix.ts, convex/lib/assignPoemReaders.ts, convex/lib/gameRules.ts, convex/lib/sessionLifecycle.ts, components/WritingScreen.tsx, components/WaitingScreen.tsx, components/RevealPhase.tsx, components/PoemDisplay.tsx, lib/writingDraft.ts

## Sub-features

The match assigns distinct writers through nine rounds with word counts 1–2–3–4–5–4–3–2–1. Writers see the preceding line, not the unfinished poem. Completed rounds reveal the nine accepted human lines together; reloads recover the same assignment without extra contributions.

## How to get to it (user POV)

From a two-player room, the host starts a game. Both players write and submit their allotted lines, refresh mid-game and continue, then open the completed poem after the ninth round.

## Driving it

Convex owns assignment, accepted submission, and completion; the room UI owns writing and reveal. `qa/walk --stories "US-002"` walks a fresh isolated web/backend game, checking observed round content and final reveal. Existing browser and Convex tests remain independent owner checks.

## Gotchas

Do not infer completed gameplay from the lobby or from the Playwright test collection alone. A retry must not add a tenth or duplicate line. A local game cannot establish real hosted deployment alignment or physical-device quality.
