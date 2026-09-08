# ADR-0008: Room Pen Names via Write-Time Capture

## Status

Accepted

## Context

When displaying poem lines, we show the author's pen name for that room. A persistent guest or signed-in identity can participate in multiple rooms with different names, and can rejoin a room with a new name. The account's `users.displayName` is not the authority for any particular room. Question: should we show:

- **Current name**: What the user or room membership is called now (live lookup)
- **Historical room name**: What the writer called themselves in that room when they wrote the line

For a poetry game with "pen name" culture, historical names are more appropriate. A line signed "The Wandering Poet" should stay signed that way even if the user later changes to "Bob."

## Decision

Capture `roomPlayers.displayName` as `lines.authorDisplayName` when a new line is inserted. Room creation and joining normalize pen names server-side with `normalizeDisplayName`. Resolve the authenticated writer's membership using the `by_room_user` index, never a global profile name or a membership in another room.

Keep the game-state and immutable-assignment checks before the already-submitted return. An accepted retry returns the stored text without changing its captured name, even if the writer's room name or membership has since changed. Only a new insertion requires the current room membership.

```typescript
// Schema
lines: defineTable({
  poemId: v.id('poems'),
  indexInPoem: v.number(),
  text: v.string(),
  wordCount: v.number(),
  authorUserId: v.id('users'),
  authorDisplayName: v.optional(v.string()), // Room pen name at write time
  createdAt: v.number(),
});

// Mutation: after game/assignment validation and the already-submitted return
const roomPlayer = await ctx.db
  .query('roomPlayers')
  .withIndex('by_room_user', (q) =>
    q.eq('roomId', room._id).eq('userId', user._id)
  )
  .first();
if (!roomPlayer) throw new ConvexError('Not a room participant');

await ctx.db.insert('lines', {
  poemId,
  indexInPoem: lineIndex,
  text: normalizedText,
  wordCount,
  authorUserId: user._id,
  authorDisplayName: roomPlayer.displayName, // Historical room pen name
  createdAt: Date.now(),
});
```

### Display Logic

```typescript
// Prefer captured pen name, fall back to current name for legacy data
authorName: l.authorDisplayName || author?.displayName || 'Unknown';
```

The fallback handles lines written before this feature was added. Reader views,
poem details, public recaps (including the starter name), and archive/export
attributions prefer the captured name. Archive collaborator lists are named from
the bylines on that poem, so a later pen name elsewhere never relabels a saved
poem. Room rosters, reading order, and round progress read the room membership
name; a poem's assigned reader is a room role, not an authorship snapshot.

Do not backfill or rewrite existing snapshots from a current user profile or room membership: neither proves the name used when an older line was written. Incorrect names already captured by the former profile-based writer remain unchanged. Repair would require explicit room/line provenance and separately authorized data work.

## Consequences

**Positive:**

- Poems preserve their original authorship attribution
- Attribution does not depend on mutable profile or room-name lookups
- Different rooms can preserve different pen names for the same identity
- Legacy lines without snapshots still fall back to live lookup

**Negative:**

- Name duplication across room memberships and line snapshots
- Retroactive correction requires provenance and explicit data authorization
- `optional` field adds null-check overhead

**Alternatives Considered:**

- **Always live lookup**: Simpler schema but loses historical context
- **Separate pen_names table**: Over-engineered for current needs
- **Version history on users**: Complex, not worth it for display names
