# Poem

Stories: US-002
Source: app/room/[code]/**, convex/game.ts, convex/schema.ts, convex/lib/assignmentMatrix.ts, convex/lib/assignPoemReaders.ts, convex/lib/gameRules.ts, convex/lib/sessionLifecycle.ts, components/WritingScreen.tsx, components/WaitingScreen.tsx, components/RevealPhase.tsx, components/PoemDisplay.tsx, lib/writingDraft.ts

Acceptance: [SPEC.md — US-002](../SPEC.md#us-002-live-write-nine-lines-and-reveal-the-whole-poems).

## Driving it

Convex owns assignment, accepted submission, and completion; the room UI owns writing and reveal. `qa/walk --stories "US-002"` walks a fresh isolated web/backend game, checking observed round content and final reveal. Existing browser and Convex tests remain independent owner checks.

A local game cannot establish hosted deployment alignment or physical-device quality.
