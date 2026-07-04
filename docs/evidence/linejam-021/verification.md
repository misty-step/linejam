# linejam-021 verification

## Red tests

Before implementation, focused tests failed for the expected reasons:

- `tests/convex/archive.test.ts` and `tests/convex/poems.test.ts`: `limit` was
  not accepted by archive/history queries.
- `tests/convex/readPathGuards.test.ts`: `getRecentPublicPoems` still contained
  `.filter((q)` scans and history queries had no explicit `.take(...)` window.
- `tests/convex/aiLifecycle.test.ts`: no `claimAiRoundGeneration` /
  `finishAiRoundGeneration` lock API existed.
- `tests/app/room-page.test.tsx`: a thrown writing panel rendered an empty body
  instead of a panel fallback.

## Focused proof

```bash
pnpm vitest run tests/convex/readPathGuards.test.ts tests/convex/archive.test.ts tests/convex/poems.test.ts
```

Result: 3 files passed, 79 tests passed.

```bash
pnpm vitest run tests/convex/aiLifecycle.test.ts tests/app/room-page.test.tsx
```

Result: 2 files passed, 37 tests passed.

## Repo gate

```bash
pnpm ci:prepush
```

Final result after critic fixes:

```text
Test Files  104 passed (104)
Tests  1153 passed | 1 skipped (1154)
Duration  74.37s
```

The command also completed `pnpm typecheck` and `pnpm lint` before Vitest.

Known non-failing warning: existing Canary responder tests emit Vitest warnings
about nested `vi.unmock(...)` hoisting. This lane did not modify those tests.

## Fresh critic

Fresh-context critic initially returned `BLOCKING: yes`:

- stale AI lock reclaims were unfenced;
- room panel error boundaries did not reset across panel/status changes.

Fixes applied:

- `aiRoundLocks` now carries an owner token, and `finishAiRoundGeneration` only
  releases the current owner.
- The regression test now covers stale reclaim plus old-owner finish.
- `RoomPanelErrorBoundary` resets on `roomCode`/`panel` changes, and room status
  panels are keyed by `roomCode:panel`.
- The room page test now covers recovery from a failed writing panel after the
  room moves to reveal.
