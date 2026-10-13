# 0002: Assignment matrix with derangement constraint

- **Status:** accepted
- **Date:** 2026-10-13 (migration; original record undated)
- **Primitives:** poem-game
- **Powder:** none recorded

## Context
The nine-round game rotates each player through poems while exposing only the preceding line. Independent random assignment could put a writer on consecutive lines; lazy assignment introduces concurrent-submission races.

## Decision
Generate and store the full 9 × N assignment matrix in `games.assignmentMatrix` at game start, with `matrix[round][poemIndex] = assignedUserId`, then use it as an immutable O(1) lookup. Use a cryptographically secure Fisher–Yates shuffle for round 0; shuffle rounds 1–8 and resolve consecutive-writer conflicts with valid swaps. Do not assign writers lazily per round or substitute predictable round-robin patterns.

## Consequences
The game uses word counts `1, 2, 3, 4, 5, 4, 3, 2, 1` and exposes only the preceding line. Assignments consume storage proportional to players times nine rounds; each player writes once per round. Avoiding consecutive lines by the same writer is a separate best-effort constraint: allow unresolved conflicts after 1000 attempts. The original explicitly accepted that a clean assignment is not guaranteed for N=2. This is not a strict derangement guarantee. Per-round revalidation adds N queries; Convex has no multi-field unique constraint to replace this algorithm. Revisit if strict consecutive-writer exclusion becomes required or the game rules change enough that an upfront matrix no longer represents assignments.
