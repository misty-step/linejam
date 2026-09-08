# Linejam

## Product

A phone-first poetry party game for friends together in one room. The current
form is the baseline to refine, not replace: easy guest entry, enjoyable writing,
a clear whole-poem reveal, and artifacts worth keeping.

## What stays true

- One human-authored game: nine rounds of `1, 2, 3, 4, 5, 4, 3, 2, 1` words.
  Each writer sees only the preceding line; all nine lines open at reveal.
- Guests can play without accounts, including when Clerk is unavailable.
  Refresh, reconnect, late joins and host departure must preserve game integrity.
- Private saving and explicit, reversible publication are different actions.
  No hidden poem text leaks to spectators or unauthorized viewers.
- The violet/lavender identity, DynaPuff wordmark and Nunito Sans interface stay.
  Improve the cast, composition and use of accents rather than start another
  identity exploration. `DESIGN.md` owns the details; tokens live in source.
- Phones, large text, keyboards, screen readers, both color modes and reduced
  motion are part of the experience, not optional finishing work.
- No generated player contributions, extra game modes, competitive rankings,
  ornamental prompts, ads or social-network expansion.

## Current direction

The operator's production walkthrough sets the priority: **polish the player
experience by removing noise, improving hierarchy and adding restrained charm.**
Host/entry, invitations and waiting need attention; the join and writing flow
already feel good. Room creation felt slower than expected, but optimization is
not a priority without evidence that it impairs play.

`DESIGN.md` records the implemented interaction contract and acceptance bar.
The second lane is adopting Parlor for shared party-game infrastructure: room
codes, joining, membership, presence and match lifecycle. Linejam and Parlor are
both owned here; missing framework capabilities are design discussions, not a
reason to build another permanent set of Linejam workarounds.

Evaluate the boundary before migration. Put migration first only if it removes
more complexity from the polish work than it introduces. The initial source
assessment and migration conditions live in `docs/ARCHITECTURE.md`; no Parlor
source pin, dependency installation or production cutover is selected by this
brief.

## Vocabulary

- **Room:** the gathering and its invitation code; it can host repeated games.
- **Game/cycle:** one complete nine-round poem-writing session in that room.
- **Poem:** nine contributions joined by the assignment matrix.
- **Pen name and avatar:** room-facing identity, not authentication.
- **Reading circle:** complete poems, assigned readers and a safe fallback for
  an absent reader. It does not require a separate presentation mode.

## Ownership

Current requests authorize work. Linear owns priorities and work status; this
brief stores accepted direction, not a second backlog or a new-ticket ritual.
Old issues and exploration records are context, not outstanding obligations.

Keep operating procedures, privacy/retention rules and recovery contracts near
their source. Production deploys, provider/data changes and remote QA require
their own scope under `CONTRIBUTING.md` and `docs/ops/observability-ci.md`.
