### [Maintainability] Extract checkParticipation helper

**Files**: convex/poems.ts:21-27, convex/poems.ts:67-73
**Perspectives**: maintainability-maven
**Impact**: Duplicated roomPlayers lookup in getPoemsForRoom and getPoemDetail. Any auth changes need to update both places.
**Fix**: Extract to `convex/lib/auth.ts`:

```typescript
export async function checkParticipation(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<'rooms'>,
  userId: Id<'users'>
): Promise<boolean> {
  const player = await ctx.db
    .query('roomPlayers')
    .withIndex('by_room_user', (q) =>
      q.eq('roomId', roomId).eq('userId', userId)
    )
    .first();
  return !!player;
}
```

**Effort**: 15m | **Impact**: DRY, single source of truth for participation checks
**Acceptance**: No duplicated roomPlayers queries in poems.ts

---
