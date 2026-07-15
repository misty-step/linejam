# Data retention (`linejam-retention-v1`)

Linejam keeps intentional artifacts and expires private session data plus
operational bookkeeping. The versioned constants in
`convex/lib/retentionPolicy.ts` are the executable source of truth; this page is
the operator contract.

## Retention matrix

| Data class                                       |                             Lifetime | Deletion trigger                                                                                                      | Protection / cascade                                                                                                                                                               |
| ------------------------------------------------ | -----------------------------------: | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private completed rooms, games, poems, and lines |                              90 days | `retentionState=pending` and `retentionEligibleAt <= now`                                                             | Child-first cascade: poems/lines drain before games/rooms. A public or favorited poem protects its provenance and authorization context; a public recap protects the full session. |
| Abandoned games and closed empty lobbies         |                               7 days | Same indexed eligibility check                                                                                        | A later explicit publication/favorite still protects the artifact. Abandonment is recorded as `games.completionKind=abandoned`.                                                    |
| Public poem                                      |      While `publicShareEnabled=true` | Unpublishing starts a 30-day grace                                                                                    | Any favorite or public session recap keeps it protected.                                                                                                                           |
| Public session recap                             |      While `publicRecapEnabled=true` | Disabling starts a 30-day grace                                                                                       | The room, game, and all recap poems stay together so the room-code URL remains valid.                                                                                              |
| Favorited poem                                   |   While at least one favorite exists | Removing the last favorite starts a 30-day grace                                                                      | Public poem/recap state independently keeps it protected.                                                                                                                          |
| Guest identity                                   |                     180 days minimum | Age threshold and no room membership, hosted room, authored line, favorite, reader assignment, or migration reference | A live reference defers the next check by 30 days. Clerk identities are not age-deleted.                                                                                           |
| AI identity                                      |                       7 days minimum | Age threshold and the same reference check                                                                            | Kept lines retain the AI identity and bot attribution; orphan AI identities expire.                                                                                                |
| AI turns and round locks                         |                               7 days | `updatedAt` cutoff                                                                                                    | No artifact cascade.                                                                                                                                                               |
| AI usage and fallback aggregates                 |                              90 days | `updatedAt` / hourly bucket cutoff                                                                                    | Numeric operations evidence only.                                                                                                                                                  |
| Guest-to-Clerk migration rows                    |                             180 days | `migratedAt` cutoff                                                                                                   | The durable Clerk identity and transferred artifacts remain.                                                                                                                       |
| Share analytics                                  |                              90 days | `createdAt` cutoff                                                                                                    | Public-share state lives on the poem/game and is unaffected.                                                                                                                       |
| Rate-limit buckets                               | Until reset (at most the next sweep) | `resetTime <= now`                                                                                                    | Existing 30-minute cleanup remains as a faster overlapping, idempotent path.                                                                                                       |
| Retention run metrics                            |                              90 days | `completedAt` cutoff                                                                                                  | Latest receipts remain queryable as a numeric trend.                                                                                                                               |

## Bounded execution

`retention.runRetentionSweep` uses only age/state indexes and fixed `.take()`
batches. It has no open-ended loop or recursive continuation. One invocation is
bounded to:

- 436 candidate rows;
- 728 document reads, including worst-case preservation, dependency, and overflow
  guards;
- 593 document writes, including cascaded room-player/line deletion and the
  metrics receipt.

A room with more than 12 membership rows or a poem with more than nine lines is
reported as an error and skipped, never partially deleted. Parents are deleted
only after their children are gone, so a kept or anomalous poem cannot be
orphaned. A blocked parent is deferred beyond the next six-hour cron window so
kept artifacts cannot starve newer eligible rows at the head of the index.
Independent deletes use `Promise.all`. Repeated sweeps are idempotent and drain
backlog in bounded chunks.

Every invocation inserts one `retentionRuns` receipt with policy version,
dry-run flag, aggregate eligible/deleted/error counts, and per-table counts.
The structured log carries the same numeric fields. Neither surface accepts
poem text, room codes, guest identifiers, or row IDs. Read the trend with:

```bash
pnpm exec convex run retention:getRetentionTrend '{"limit":30}'
```

## Fail-closed rollout and backfill

The six-hour cron calls `retention.runScheduledRetentionSweep`. Unless the
target Convex environment contains exactly `RETENTION_GC_ENABLED=1`, the cron
runs in metrics-only dry-run mode and deletes zero rows.

Roll out in this order on each deployment:

1. Deploy the optional schema fields, indexes, functions, and dry-run cron.
2. Preview one bounded legacy batch:

   ```bash
   pnpm exec convex run retention:backfillRetentionPolicy '{"dryRun":true}'
   ```

3. Apply bounded classifier batches, repeating until `hasMore=false`:

   ```bash
   pnpm exec convex run retention:backfillRetentionPolicy '{"dryRun":false}'
   ```

4. Inspect a deletion preview and the retained metrics row:

   ```bash
   pnpm exec convex run retention:runRetentionSweep '{"dryRun":true}'
   pnpm exec convex run retention:getRetentionTrend '{"limit":5}'
   ```

5. Only after preservation checks pass, enable scheduled deletion:

   ```bash
   pnpm exec convex env set RETENTION_GC_ENABLED 1
   ```

Use `--prod` only with explicit production authority. Removing the variable is
the immediate kill switch; it returns future cron runs to dry-run mode. Deleted
private data is intentionally not recoverable, so the dry-run receipt and
public/favorite preservation checks are mandatory before enabling production.
