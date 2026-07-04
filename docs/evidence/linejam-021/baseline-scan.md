# linejam-021 baseline scan

Captured before implementation on branch `perf/linejam-021-index-resilience`.

## Static source scan

Command:

```bash
rg -n "\.filter\(\(q\)|getArchiveData|getRecentPublicPoems|getMyPoems" convex/archive.ts convex/poems.ts
```

Findings:

- `convex/archive.ts:71` - `getArchiveData` collects every line by author without an explicit page window.
- `convex/archive.ts:220-221` - `getRecentPublicPoems` scans `rooms` with `filter(status === COMPLETED)`.
- `convex/archive.ts:232-235` - `getRecentPublicPoems` scans `poems` with an `or(roomId...)` filter.
- `convex/archive.ts:256-259` - `getRecentPublicPoems` scans `lines` with an `or(poemId...)` filter.
- `convex/poems.ts:115-128` - `getMyPoems` collects every author line before deduping poems.

Baseline verdict: launch/history read paths are not yet fully index-backed or page-windowed.
