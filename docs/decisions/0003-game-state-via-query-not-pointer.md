# 0003: Game state via query, not mutable pointer

- **Status:** accepted
- **Date:** 2026-10-13 (migration; original record undated)
- **Primitives:** poem-game
- **Powder:** none recorded

## Context
Using room.currentGameId as active-game authority let completion clear the pointer while another final submission was in flight, causing “Game not found” failures.

## Decision
Query game state through the room/status index and use immutable poem.gameId and assignment references for submissions. Do not make a mutable room pointer the authority. Accepted duplicate submissions are idempotent, and final-round retries survive completion.

## Consequences
Indexed queries replace pointer dependence; legacy room fields may remain redundant. Revisit if the lifecycle or indexing contract changes so that queried state cannot reliably resolve the applicable game.
