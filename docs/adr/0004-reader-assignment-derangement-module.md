# ADR-0004: Reader Assignment as Deep Module

## Status

Accepted

## Context

At game end, each completed poem is assigned a "reader" who reveals it to the group. Requirements:

- No player reads their own poem (derangement constraint)
- AI players cannot read (they can't speak aloud)
- Distribution should be fair (no player reads 5 while another reads 0)
- If N poems but N-1 human players, one player reads 2

Early implementation had two divergent codepaths:

1. `submitLine` completion: modulo-based assignment
2. `ai.ts` completion: separate logic with host fallback

Issue #89 documented inconsistent behavior between these paths.

## Decision

Create a **deep module** (`convex/lib/assignPoemReaders.ts`) following Ousterhout's principles:

**Shallow interface:**

```typescript
function assignPoemReaders(
  poems: Poem[],
  allPlayers: Player[],
  shuffler?: <T>(arr: T[]) => T[]
): Map<Id<'poems'>, Id<'users'>>;
```

**Deep implementation hides:**

- Filtering AI players (callers don't know about AI)
- Fisher-Yates shuffle for randomness
- Round-robin with derangement constraint
- Edge case: single player reads all (can't avoid self-read)

**Test injection:**

- Optional `shuffler` parameter allows deterministic tests
- Default uses crypto-secure shuffle

## Consequences

**Positive:**

- Single source of truth for reader assignment
- Callers import and call; no knowledge of AI handling
- Testable: inject identity shuffler for deterministic results
- Consistent behavior across both completion paths

**Negative:**

- Requires fetching full user records to check `kind` field
- Extra abstraction layer (justified by complexity hidden)

**Why Deep Module:**

- Interface is one function, clear semantics
- Implementation is ~80 lines of complex logic
- Callers are completely shielded from AI handling, shuffle mechanics, fairness balancing
