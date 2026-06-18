# Migrate remaining convex tests off the mock DB to convex-test

Priority: P2 · Status: ready · Estimate: M

## Goal

The hand-rolled mock DB (`tests/helpers/mockConvexDb.ts`) returns `this` for
query chains and cannot model read-your-writes, transactions, or the scheduler —
so mock-DB tests assert against stubs, not behavior. Backlog 016 unblocked
convex-test (`tests/helpers/convexTest.ts`, real query engine + scheduler).
Migrate the remaining `tests/convex/*` suites onto it and delete the mock DB,
removing internal-collaborator mocking that the repo's own rules forbid.

## Oracle

- [ ] `tests/convex/*` suites that exercise DB/scheduler behavior run on
      `setupConvexTest()` instead of `createMockDb`/`createMockCtx`.
- [ ] `tests/helpers/mockConvexDb.ts` is deleted (or reduced to nothing that
      mocks an internal collaborator), and no `tests/convex` file mocks
      `convex/_generated/server`.
- [ ] `pnpm test` green; coverage thresholds still met.

## Notes

Reference example: `tests/convex/abandonment.test.ts` and
`tests/convex/game-convex-test-example.test.ts`. The convex-test deferral notes
were stale — the `import.meta.glob` "blocker" was self-inflicted (calling
`convexTest(schema)` with no modules runs the glob inside node_modules, which
Vite never transforms). Migrate incrementally, file by file, keeping each green.
This is the SHAPE-0 "convex-test migration" groundwork referenced in the CI
redesign.
