# 0002: Assignment matrix with derangement constraint

- **Status:** accepted
- **Date:** 2026-10-13 (migration; original record undated)
- **Primitives:** poem-game
- **Powder:** none recorded

## Context
The nine-round game rotates each player through poems while exposing only the preceding line. Independent random assignment could put a writer on consecutive lines; lazy assignment introduces concurrent-submission races.

## Decision
Generate and store the full randomized assignment matrix at game start, then use it as an immutable lookup. Do not assign writers lazily per round or substitute predictable round-robin patterns.

## Consequences
Assignments consume storage proportional to players times nine rounds, but each submission uses a stable lookup and each player writes once per round. Revisit if the game rules change enough that an upfront matrix no longer represents assignments.
