# linejam-021 after scan

Captured after implementation on branch `perf/linejam-021-index-resilience`.

## Static source scan

Command:

```bash
rg -n "\.filter\(\(q\)|getArchiveData|getRecentPublicPoems|getMyPoems|by_status_created|by_author_created|aiRoundLocks" convex/archive.ts convex/poems.ts convex/schema.ts convex/ai.ts
```

Output:

```text
convex/ai.ts:526:    const owner = crypto.randomUUID();
convex/ai.ts:528:      .query('aiRoundLocks')
convex/ai.ts:544:        owner,
convex/ai.ts:549:      return { claimed: true as const, lockId: existing._id, owner };
convex/ai.ts:552:    const lockId = await ctx.db.insert('aiRoundLocks', {
convex/ai.ts:556:      owner,
convex/ai.ts:562:    return { claimed: true as const, lockId, owner };
convex/ai.ts:568:    lockId: v.id('aiRoundLocks'),
convex/ai.ts:569:    owner: v.string(),
convex/ai.ts:571:  handler: async (ctx, { lockId, owner }) => {
convex/ai.ts:574:    if (existing.owner !== owner) return;
convex/ai.ts:660:    let generationLock: { lockId: Id<'aiRoundLocks'>; owner: string } | null =
convex/ai.ts:669:      generationLock = { lockId: claim.lockId, owner: claim.owner };
convex/schema.ts:42:    .index('by_status_created', ['status', 'createdAt']),
convex/schema.ts:116:    .index('by_author_created', ['authorUserId', 'createdAt']),
convex/schema.ts:146:  aiRoundLocks: defineTable({
convex/schema.ts:150:    owner: v.string(),
convex/poems.ts:130:export const getMyPoems = query({
convex/poems.ts:149:      .withIndex('by_author_created', (q) => q.eq('authorUserId', user._id))
convex/archive.ts:79:export const getArchiveData = query({
convex/archive.ts:100:      .withIndex('by_author_created', (q) => q.eq('authorUserId', user._id))
convex/archive.ts:261:export const getRecentPublicPoems = query({
convex/archive.ts:279:      .withIndex('by_status_created', (q) => q.eq('status', 'COMPLETED'))
```

After verdict: the pre-implementation `getRecentPublicPoems` `.filter((q)` scans
over `rooms`, `poems`, and `lines` are gone. Launch reads now use bounded
windows over declared indexes, and AI generation has a persisted `(game, round)`
lock table.
