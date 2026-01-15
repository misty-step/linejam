# ADR-0002: Assignment Matrix with Derangement Constraint

## Status

Accepted

## Context

Linejam's core mechanic: players add lines to poems they can only partially see. The game has 9 rounds with word counts [1,2,3,4,5,4,3,2,1] creating a "diamond" shape. Each player writes one line per round, rotating through different poems.

Key constraint: **no player should write consecutive lines on the same poem**. This preserves the "exquisite corpse" surprise where you only see the immediately previous line.

Initial approaches considered:

- Simple round-robin assignment (predictable, boring)
- Random assignment each round (could violate consecutive-line constraint)
- Per-round revalidation (expensive, N queries per round)

## Decision

Generate the entire **assignment matrix** upfront at game start:

- 9x N array where `matrix[round][poemIndex] = assignedUserId`
- Round 0: crypto-secure Fisher-Yates shuffle of players
- Rounds 1-8: shuffle + conflict resolution to ensure no player writes consecutive lines for the same poem

The algorithm (`convex/lib/assignmentMatrix.ts`):

```
For each round r > 0:
  1. Shuffle player array
  2. Check for conflicts: currentPerm[j] === matrix[r-1][j]
  3. Resolve by finding valid swap targets
  4. If conflicts persist after 1000 attempts, allow (edge case for small player counts)
```

Stored in `games.assignmentMatrix` as immutable reference.

## Consequences

**Positive:**

- O(1) lookup per submission (no repeated queries)
- Immutable reference eliminates race conditions during concurrent submissions
- Fairness: every player writes exactly one line per round

**Negative:**

- Stored matrix grows with player count (N \* 9 user IDs)
- For N=2 players, mathematically impossible to fully avoid conflicts (accepted limitation)
- Algorithm is randomized; different games have different patterns (feature, not bug)

**Why Not Alternatives:**

- **Lazy assignment per round**: Creates race conditions when multiple players submit simultaneously
- **Deterministic Latin squares**: Predictable patterns reduce game surprise
- **Database constraint**: Convex doesn't support unique constraints across multiple fields
