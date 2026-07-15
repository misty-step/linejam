# Testing and QA

Use the smallest test that can fail for the changed behavior, then prove the
real acceptance surface. Command definitions live in `package.json`; coverage
thresholds live in `vitest.config.ts`.

## Commands

```bash
pnpm vitest run tests/path/to/file.test.ts # focused Vitest
pnpm test                                  # all Vitest tests
pnpm test:ci                               # Vitest coverage + nonzero-total guard
pnpm lint
pnpm typecheck
pnpm ci:prepush                            # required fast local gate

pnpm test:e2e                              # deterministic Playwright suite
pnpm test:e2e:early-smoke                  # host-to-reveal selector contract
pnpm test:e2e:smoke                        # explicit remote target
pnpm test:e2e:evidence                     # tagged evidence spec
pnpm evidence:guest-flow                   # packaged visual/runtime evidence

pnpm ci:dagger:all-no-e2e                  # full contract without browser E2E
pnpm ci:dagger:all                         # local hosted-gate mirror
```

`pnpm ci:prepush` runs provider-retirement, TypeScript, ESLint, and Vitest. The
hosted merge gate remains authoritative for merge. Convex preparation and live
authority are defined in `docs/ops/observability-ci.md`.

`pnpm test:ci` must emit nonzero totals for lines, statements, functions, and
branches before it can pass. Coverage paths are checkout-location independent:
an isolated worktree nested under `.codex`, `.worktrees`, or another harness
directory measures the same repository source surface as a normal checkout.
The machine-readable receipt is `coverage/coverage-summary.json`; the explicit
post-test guard rejects Vitest's otherwise threshold-safe `0/0 Unknown%` state.

## Match evidence to the change

| Change                          | Minimum acceptance                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| Pure documentation/config       | formatting, link/path/command verification, relevant script test, `pnpm ci:prepush` |
| Domain utility                  | focused Vitest plus `pnpm ci:prepush`                                               |
| Convex query/mutation/scheduler | `convex-test` integration on the real scheduler/DB plus fast gate                   |
| Component interaction           | Testing Library behavior test plus the relevant browser route                       |
| Game flow/auth/realtime         | Playwright with separate contexts and the targeted Convex deployment                |
| Visual/theme                    | deterministic browser flow and retained screenshots/video/manifest                  |
| Deployment/observability        | local gates plus authorized provider, smoke, health, and log postconditions         |

Unit tests are not acceptance for browser rendering, real scheduling,
deployment identity, or production health.

## Test seams

- Mock network calls, browser APIs, third-party adapters, clocks, randomness,
  and other system boundaries.
- Do not mock the behavior under test. Prefer dependency injection at the
  external boundary over replacing internal modules.
- Test Convex functions with `setupConvexTest()` from
  `tests/helpers/convexTest.ts`; seed with `tests/helpers/convexSeed.ts` where
  applicable. This exercises indexes, transactions, scheduled functions, and
  generated handlers instead of a hand-built database mock.
- Component tests may mock `convex/react`, Clerk, clipboard, or fetch. Keep
  domain utilities and component-owned decision logic real.
- Every regression starts red on the defect, turns green on the fix, then gets
  refactored without changing the oracle.

## Browser and live-target rules

Playwright uses the checked-in `playwright.config.ts` and
`playwright.smoke.config.ts`. Multi-player scenarios use separate browser
contexts. Never call a remote suite without confirming its base URL and
mutation authority.

The full Dagger E2E lane needs deployment-aligned Convex, Clerk, guest-token,
and Canary configuration. It can sync the active shared dev deployment through
the guarded path. It refuses local production Convex sync without
`LINEJAM_ALLOW_PROD_CONVEX_SYNC=1`; that flag is not operator authority.

Remote smoke requires an explicit `PLAYWRIGHT_BASE_URL`. Production auth smoke
fails closed on test Clerk keys and requires the pre-created smoke account.
Keep `PLAYWRIGHT_REQUIRE_AUTH_E2E` and `PLAYWRIGHT_REQUIRE_AUTH_SMOKE` enabled
unless the lane explicitly requests guest-only evidence and records the gap.

## Evidence and agentic QA

`pnpm evidence:guest-flow` packages screenshots, video, GIF, server log,
summary, and manifest. Runtime or artifact errors fail unless a typed,
expiring allowlist names the exact known issue and reason. A waiver is visible
evidence of a gap, not proof the behavior passed.

For static rendering that does not need a room flow, use
`pnpm evidence:static-server`; it owns the narrow unsynced-Convex and Canary
isolation needed by that capture. Do not generalize its escape hatch to game
tests.

Agentic QA is advisory and never replaces deterministic checks:

```bash
pnpm qa:agentic:local --mission guest-host-signed-in-join
pnpm qa:agentic:preview --mission guest-host-signed-in-join --base-url https://<preview-url>
```

Retain the `.qa/runs/<run-id>/` manifest and critic artifacts when that lane is
part of acceptance.

## Debugging and evidence quality

- Isolate a hanging/failing file first, then narrow to one test. Check leaked
  timers/processes, unresolved mocks, network calls, and unbounded loops.
- Use semantic waits (`waitForURL`, visible/ready state), not sleeps.
- Never silently skip environment-dependent acceptance. Supply the environment
  or name the unverified surface and residual risk.
- Record the exact command, exit result, target surface/deployment, and artifact
  path. Do not infer a pass from an adjacent test or fabricate a receipt.
