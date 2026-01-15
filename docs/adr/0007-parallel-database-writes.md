# ADR-0007: Parallel Database Writes for Performance

## Status

Accepted

## Context

Convex mutations were using sequential `for...of` loops with `await`:

```typescript
// Before: O(N * latency) - serial writes
for (const player of shuffledPlayers) {
  await ctx.db.patch(player._id, { seatIndex: i });
}
```

With 8 players and ~15ms per database operation, this added 120ms latency per batch.

## Decision

Replace serial loops with `Promise.all` for independent writes:

```typescript
// After: O(latency) - parallel writes
await Promise.all(
  shuffledPlayers.map((player, i) => ctx.db.patch(player._id, { seatIndex: i }))
);
```

Applied to:

1. **Seat assignment** in `startGame`: patching roomPlayers with seatIndex
2. **Poem creation** in `startGame`: inserting N poems
3. **Poem completion** in `submitLine`: patching poems with completedAt and readerId
4. **Line existence checks** in `submitLine`: checking if round is complete

### Timestamp Consistency

For batched writes that share a timestamp (e.g., `createdAt`, `completedAt`), capture `Date.now()` once before the Promise.all:

```typescript
const completionTime = Date.now();
await Promise.all(
  poems.map((poem) => ctx.db.patch(poem._id, { completedAt: completionTime }))
);
```

This ensures all records in a batch have identical timestamps.

## Consequences

**Positive:**

- 4x speedup for batch operations (measured: 120ms -> 30ms for 8 players)
- No semantic change (operations were already independent)
- Convex handles concurrent writes within same mutation

**Negative:**

- Slightly less readable code (map + Promise.all vs for loop)
- Must be careful that operations are truly independent

**When NOT to Parallelize:**

- Operations with dependencies (e.g., create room, then create game referencing room)
- Operations that need sequential ordering guarantees
- Read-modify-write patterns where reads depend on previous writes
