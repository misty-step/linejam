# ADR-0008: Pen Names via Write-Time Capture

## Status

Accepted

## Context

When displaying poem lines, we show the author's display name. But users can change their display name at any time. Question: should we show:

- **Current name**: What the user is called now (live lookup)
- **Historical name**: What they were called when they wrote the line

For a poetry game with "pen name" culture, historical names are more appropriate. A line signed "The Wandering Poet" should stay signed that way even if the user later changes to "Bob."

## Decision

Capture `authorDisplayName` at write time in the `lines` table:

```typescript
// Schema
lines: defineTable({
  poemId: v.id('poems'),
  indexInPoem: v.number(),
  text: v.string(),
  wordCount: v.number(),
  authorUserId: v.id('users'),
  authorDisplayName: v.optional(v.string()), // Captured at write-time
  createdAt: v.number(),
});

// Mutation
await ctx.db.insert('lines', {
  poemId,
  indexInPoem: lineIndex,
  text: text.trim(),
  wordCount,
  authorUserId: user._id,
  authorDisplayName: user.displayName, // Snapshot
  createdAt: Date.now(),
});
```

### Display Logic

```typescript
// Prefer captured pen name, fall back to current name for legacy data
authorName: l.authorDisplayName || author?.displayName || 'Unknown';
```

The fallback handles lines written before this feature was added.

## Consequences

**Positive:**

- Poems preserve their original authorship attribution
- No join/lookup needed at display time (denormalized for reads)
- Graceful migration: legacy lines fall back to live lookup

**Negative:**

- Slight data duplication (name stored twice: users table + lines table)
- If user wants to retroactively update old pen names, requires migration
- `optional` field adds null-check overhead

**Alternatives Considered:**

- **Always live lookup**: Simpler schema but loses historical context
- **Separate pen_names table**: Over-engineered for current needs
- **Version history on users**: Complex, not worth it for display names
