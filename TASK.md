# Test Coverage Automation & Comprehensive Testing Infrastructure

## Executive Summary

**Problem:** Linejam has decent coverage (78.7%) but lacks automated reporting, strict enforcement, and comprehensive testing across all layers.

**Solution:** Implement enterprise-grade test coverage automation with strict 80% thresholds, automated PR reports, coverage badges, and comprehensive test suite (unit + integration + E2E).

**User Value:** Supremely confident deployments with automatic quality gates preventing regressions. Friday 5pm merges with phone off.

**Success Criteria:**

- 80%+ coverage across lines, branches, functions, statements (strictly enforced in CI)
- Automated coverage reports in every PR with file-level diffs
- Coverage badges in README (4 badges: lines, branches, functions, statements)
- 5-10 E2E tests covering critical game flows
- Comprehensive backend testing with official `convex-test` library

---

## User Context

**Who:** Development team deploying real-time collaborative poetry game
**Problem:** Current testing gaps allow bugs in critical paths (room management, poem access, authorization) to reach production
**Benefits:**

- **Confidence:** Deploy knowing every critical path is tested
- **Speed:** Catch bugs in CI before manual testing
- **Documentation:** Tests serve as living specification
- **Regression Prevention:** Breaking changes caught immediately

**Measurable Benefits:**

- Production bugs ↓ 80% (from tested code paths)
- Code review time ↓ 40% (automated coverage checks)
- Deploy confidence ↑ 95% (comprehensive test suite)

---

## Requirements

### Functional Requirements

**FR-1: Automated Coverage Reporting**

- PR comments with coverage diff visualization (file-level detail)
- GitHub Actions step summary with full coverage report
- Links to uncovered lines in PR comments
- Coverage comparison: base branch → PR branch

**FR-2: Coverage Badges**

- 4 separate badges in README: Lines, Branches, Functions, Statements
- Auto-updated on every master merge
- Color-coded: green (≥80%), yellow (70-79%), red (<70%)

**FR-3: Strict Coverage Enforcement**

- 80% minimum for: lines, branches, functions, statements
- CI fails if any threshold not met
- Lefthook pre-push: informational coverage check (non-blocking)
- GitHub Actions: blocking coverage check

**FR-4: Backend Testing (Convex)**

- Test all untested Convex functions: rooms.ts, poems.ts, favorites.ts
- Use official `convex-test` library for mocking
- Test authorization enforcement in all queries/mutations
- Test rate limiting, error handling, edge cases

**FR-5: Frontend Testing**

- Test critical React components: Lobby, WritingScreen, RevealPhase
- Test custom hooks: useUser (Clerk + guest session)
- Test error boundaries and loading states
- Focus on stateful logic, not pure presentation

**FR-6: E2E Testing (Playwright)**

- 5-10 critical user flows:
  - Game flow: create → join → play → reveal
  - Auth flow: guest session creation, Clerk login
  - Error scenarios: invalid room code, capacity limits
  - Favorites: toggle favorite, view favorites
- Run in CI on PR + master merge
- Visual regression testing (optional)

**FR-7: Test Infrastructure**

- `convex-test` for backend testing (100x faster than local Convex)
- Shared test helpers: mock database, mock context, env helpers
- Vitest watch mode for local development
- Playwright UI mode for E2E debugging

### Non-Functional Requirements

**NFR-1: Performance**

- Unit tests run in <5 seconds (current: 848ms ✅)
- E2E tests run in <2 minutes per suite
- CI total time <5 minutes (parallel jobs)

**NFR-2: Maintainability**

- Tests follow AAA pattern (Arrange-Act-Assert)
- Descriptive test names (complete sentences)
- Minimal mocking (test behavior, not implementation)
- DRY: shared helpers for common patterns

**NFR-3: Developer Experience**

- Clear failure messages with file:line references
- Coverage reports accessible in PR (no external login)
- Local coverage HTML report: `open coverage/index.html`
- Watch mode for iterative test development

**NFR-4: Reliability**

- No flaky tests (deterministic, no race conditions)
- Isolated tests (no shared state between tests)
- Fast feedback (fail fast on first error)

---

## Architecture Decision

### Selected Approach: **Hybrid Testing Stack with Native GitHub Integration**

**Components:**

1. **Vitest + @vitest/coverage-v8** - Unit/integration testing (existing)
2. **vitest-coverage-report-action** - PR coverage reports (new)
3. **convex-test** - Convex backend mocking (new)
4. **Playwright** - E2E testing (new)
5. **dynamic-badges-action** - Auto-updating badges (new)

**Rationale:**

- **Simplicity:** All-JavaScript stack, no new language/tooling
- **User Value:** Free tier sufficient, no vendor lock-in
- **Explicitness:** Clear separation: unit (Vitest) vs E2E (Playwright)
- **Low Risk:** Proven tools with active maintenance

### Alternatives Considered

| Approach                | Value | Simplicity | Risk   | Why Not Chosen                                                          |
| ----------------------- | ----- | ---------- | ------ | ----------------------------------------------------------------------- |
| **Codecov**             | 9/10  | 6/10       | Low    | Free tier limits (250 uploads/month), requires external service         |
| **Coveralls**           | 7/10  | 8/10       | Low    | Less feature-rich, slower innovation                                    |
| **Cypress**             | 8/10  | 7/10       | Medium | Slower than Playwright, limited Safari support, paid parallel execution |
| **Jest**                | 6/10  | 5/10       | Low    | Slower than Vitest, requires dual config for Next.js                    |
| **Manual testing only** | 2/10  | 10/10      | High   | No automation, human error, slow feedback                               |

### Module Boundaries

**Testing Infrastructure Modules:**

1. **Coverage Reporter** (`vitest-coverage-report-action`)
   - **Interface:** GitHub Actions workflow input (JSON paths)
   - **Responsibility:** Parse coverage JSON, post PR comment, update GitHub summary
   - **Hidden Complexity:** Diff calculation, file path resolution, comment formatting

2. **Backend Test Framework** (`convex-test`)
   - **Interface:** `convexTest(schema)` → test context with `mutation()`, `query()`
   - **Responsibility:** Mock Convex runtime, simulate database operations, control time
   - **Hidden Complexity:** Function wrapping, database simulation, environment isolation

3. **E2E Test Framework** (`Playwright`)
   - **Interface:** `test()`, `page.goto()`, `expect(locator).toBeVisible()`
   - **Responsibility:** Browser automation, assertions, screenshot/video capture
   - **Hidden Complexity:** Browser lifecycle, network interception, auto-waiting

4. **Test Helpers** (`tests/helpers/`)
   - **Interface:** `createMockDb()`, `createMockCtx()`, `withEnv()`
   - **Responsibility:** Reduce test boilerplate, ensure consistent mocking patterns
   - **Hidden Complexity:** Type inference, mock lifecycle management

### Abstraction Layers

```
E2E Tests (Playwright)
  ↓ [User flows, browser interactions]
Integration Tests (Vitest + convex-test)
  ↓ [Convex functions, API routes]
Unit Tests (Vitest)
  ↓ [Pure functions, utilities]
Source Code
```

Each layer changes vocabulary:

- **E2E:** User actions ("clicks submit", "sees poem")
- **Integration:** System behavior ("creates room", "enforces rate limit")
- **Unit:** Function contracts ("returns true if...", "throws when...")

---

## Dependencies & Assumptions

### External Dependencies

**New Packages:**

```json
{
  "devDependencies": {
    "convex-test": "^0.0.30",
    "@edge-runtime/vm": "^4.0.5",
    "@playwright/test": "^1.49.0"
  }
}
```

**GitHub Actions:**

- `davelosert/vitest-coverage-report-action@v2`
- `schneegans/dynamic-badges-action@v1.7.0`

### Environment Requirements

- Node.js 22+ (existing ✅)
- pnpm 10+ (existing ✅)
- GitHub repository with Actions enabled (existing ✅)
- Gist for badge storage (user must create)

### Assumptions

1. **Coverage is valuable:** 80% threshold realistic for this codebase size (~5K LOC)
2. **CI capacity:** GitHub Actions free tier sufficient (2,000 min/month)
3. **Team agreement:** All PRs must meet 80% coverage (no exceptions)
4. **Convex stability:** `convex-test` API stable (currently beta but officially supported)
5. **E2E scope:** 5-10 tests sufficient for critical paths (not full app coverage)

### Integration Requirements

**GitHub Secrets:**

- `GIST_SECRET` - Personal access token for badge updates (scopes: `gist`)
- Existing: `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

**Vitest Configuration:**

- Update thresholds: 60% → 80%
- Add `json-summary` reporter
- Exclude convex/\_generated, .next, config files

**Lefthook Configuration:**

- Add informational coverage check to pre-push (non-blocking)
- Keep existing: lint, format, typecheck, build

---

## Implementation Phases

### Phase 1: Infrastructure Setup (Week 1, 8-12 hours)

**Goal:** Establish automated coverage reporting, badges, and test frameworks

**Tasks:**

1. **Add Coverage Reporting to CI** (2 hours)
   - Install `vitest-coverage-report-action` in `.github/workflows/ci.yml`
   - Configure JSON paths: `coverage/coverage-summary.json`, `coverage/coverage-final.json`
   - Test PR comment generation on draft PR

2. **Add Coverage Badges** (1 hour)
   - Create GitHub Gist for badge storage
   - Add `dynamic-badges-action` to CI workflow (master branch only)
   - Update README with 4 badge embeds (lines, branches, functions, statements)

3. **Update Coverage Thresholds** (30 min)
   - Change vitest.config.ts: 60% → 80% for all metrics
   - Add `json-summary` to reporters array
   - Run `pnpm test:ci` to verify current failures

4. **Install Playwright** (2 hours)
   - Run `pnpm create playwright`
   - Configure `playwright.config.ts` for Next.js integration
   - Add `test:e2e` script to package.json
   - Create `tests/e2e/` directory structure
   - Add Playwright to CI workflow (separate job)

5. **Install convex-test** (1 hour)
   - `pnpm add -D convex-test @edge-runtime/vm`
   - Create example test for existing Convex function (game.ts)
   - Verify faster execution vs current mock pattern

6. **Create Test Helpers** (2 hours)
   - `tests/helpers/mockConvexDb.ts` - Database mock factory
   - `tests/helpers/mockConvexCtx.ts` - Context mock factory
   - `tests/helpers/envHelper.ts` - Environment variable manager
   - Refactor 1-2 existing tests to use helpers (validate DRY improvement)

7. **Update Lefthook** (30 min)
   - Add coverage check to pre-push (informational only, non-blocking)
   - Update failure messages with helpful context

**Deliverables:**

- ✅ CI generates coverage reports in PR comments
- ✅ README displays 4 coverage badges (will be red until Phase 2)
- ✅ Playwright installed and configured
- ✅ convex-test available for backend tests
- ✅ Test helpers reduce boilerplate

**Test Scenarios:**

- Create draft PR → verify coverage comment appears
- Merge to master → verify badges update in README
- Run `pnpm test:e2e` → Playwright executes (even if no tests yet)
- Use test helpers in new test → confirm reduced boilerplate

---

### Phase 2: Backend Testing - Convex Functions (Week 2-3, 16-24 hours)

**Goal:** Achieve 80%+ coverage for all Convex backend functions

**Tasks:**

1. **Test Convex rooms.ts** (4-6 hours)
   - Create `tests/convex/rooms.test.ts`
   - Test `createRoom`: code generation, host assignment, rate limiting
   - Test `joinRoom`: capacity limits, LOBBY state check, rate limiting
   - Test `getRoom`, `getRoomState`: authorization, not found errors
   - Test `generateRoomCode()`: uniqueness, length, character set
   - **Coverage target:** 90%+ (critical path)

2. **Test Convex poems.ts** (4-6 hours)
   - Create `tests/convex/poems.test.ts`
   - Test `getPoemsForRoom`: authorization, filtering by participation
   - Test `getPoemDetail`: line ordering, author resolution (N+1 documented)
   - Test `getMyPoems`: user filtering, pagination (if exists)
   - Mock deeply nested queries (poems → lines → users)
   - **Coverage target:** 85%+ (complex queries)

3. **Test Convex favorites.ts** (2-3 hours)
   - Create `tests/convex/favorites.test.ts`
   - Test `toggleFavorite`: add, remove, idempotency
   - Test `getMyFavorites`: user filtering, N+1 query pattern
   - Test `isFavorited`: boolean return, authorization
   - **Coverage target:** 90%+ (simple CRUD)

4. **Test Convex lib/auth.ts** (2-3 hours)
   - Create `tests/convex/lib/auth.test.ts`
   - Test `getUser()`: Clerk user, guest user, null cases
   - Test `requireUser()`: throws when null, returns user otherwise
   - Test token verification edge cases (expired, invalid signature)
   - **Coverage target:** 95%+ (critical security layer)

5. **Test lib/auth.ts (Frontend Hook)** (3-4 hours)
   - Create `tests/lib/auth.test.ts`
   - Mock `@clerk/nextjs` useUser hook
   - Test `useUser()`: Clerk user, guest fallback, loading states
   - Test cookie persistence, guest UUID generation
   - Test async useEffect behavior with `waitFor`
   - **Coverage target:** 80%+ (integration complexity)

6. **Test lib/error.ts** (1 hour)
   - Create `tests/lib/error.test.ts`
   - Mock `@sentry/nextjs` captureException
   - Test `captureError()`: context passing, error types
   - Test environment: DSN present vs missing
   - **Coverage target:** 100% (simple wrapper)

7. **Test lib/utils.ts** (1 hour)
   - Create `tests/lib/utils.test.ts`
   - Test `cn()`: class merging, conditional classes, overrides
   - Test Tailwind conflict resolution
   - **Coverage target:** 100% (trivial utility)

**Deliverables:**

- ✅ 7 new test files covering all untested backend code
- ✅ Backend coverage: 90%+ (up from 78.7%)
- ✅ Authorization tests prevent security regressions
- ✅ Rate limiting tests verify DOS protection

**Test Scenarios:**

- `pnpm test:ci` passes 80% threshold for backend files
- Authorization tests fail when `getUser()` check removed (regression test)
- Rate limit tests fail when limits bypassed

---

### Phase 3: Frontend Testing - Components & Hooks (Week 4, 12-16 hours)

**Goal:** Achieve 80%+ coverage for critical React components and hooks

**Tasks:**

1. **Test Game Components** (8-10 hours)
   - Create `tests/components/Lobby.test.tsx`
     - Test room code display, player list rendering
     - Test "Start Game" button: enabled when ≥2 players
     - Test QR code generation trigger

   - Create `tests/components/WritingScreen.test.tsx`
     - Test word count validation (1,2,3,4,5,4,3,2,1)
     - Test previous line display, submit button state
     - Test error feedback for over/under word count

   - Create `tests/components/RevealPhase.test.tsx`
     - Test poem display, line ordering
     - Test favorite toggle interaction
     - Test navigation between poems

   **Focus:** Stateful logic, user interactions, conditional rendering
   **Skip:** Pure CSS/styling, simple presentational components
   **Coverage target:** 70%+ (components are lower ROI than logic)

2. **Test UI Primitives (Selective)** (2-3 hours)
   - Test components with complex logic only:
     - `EnsoCounter.tsx` (if has animation state)
     - `StampAnimation.tsx` (if has SVG manipulation)
   - Skip pure wrappers: Button, Card, Input, Alert
   - **Coverage target:** 50%+ (not all UI needs tests)

3. **Test API Routes** (2-3 hours)
   - Improve `tests/app/api/health.test.ts`: cover lines 34-41, 54
   - Improve `tests/app/api/guest-session.test.ts`: cover lines 46-51
   - Add error scenario tests (malformed requests, missing headers)
   - **Coverage target:** 90%+ (API routes are critical)

**Deliverables:**

- ✅ 3-5 new component test files
- ✅ Frontend coverage: 80%+ (up from ~50%)
- ✅ User interaction tests prevent UX regressions

**Test Scenarios:**

- Word count validation prevents invalid submissions
- Start Game button disabled with <2 players
- Favorite toggle updates UI optimistically

---

### Phase 4: E2E Testing - Critical User Flows (Week 5, 8-12 hours)

**Goal:** Add 5-10 E2E tests for critical game flows

**Tasks:**

1. **Core Game Flow** (4-5 hours)
   - `tests/e2e/game-flow.spec.ts`
     - Create room → verify room code displayed
     - Join room (2nd browser context) → verify player appears in lobby
     - Start game → verify round 1 begins
     - Submit line (both players) → verify round progression
     - Complete 9 rounds → verify reveal phase
     - Read poems → verify correct line order

   **Complexity:** Multi-context (2 players), 9-round loop, real-time sync

2. **Auth Flows** (2-3 hours)
   - `tests/e2e/auth.spec.ts`
     - Guest session creation → verify cookie set
     - Guest UUID persistence across navigation
     - Clerk login (optional: requires test account)
     - Display name from Clerk vs guest

3. **Error Scenarios** (2-3 hours)
   - `tests/e2e/errors.spec.ts`
     - Invalid room code → verify error message
     - Room at capacity (9 players) → verify join blocked
     - Submit line with wrong word count → verify validation error
     - Network error → verify retry/fallback behavior

4. **Favorites Flow** (1-2 hours)
   - `tests/e2e/favorites.spec.ts`
     - Toggle favorite on poem → verify heart icon updates
     - Navigate to /me/poems → verify favorited poem appears
     - Unfavorite → verify removal from list

**Deliverables:**

- ✅ 4 E2E test files, 5-10 total tests
- ✅ E2E coverage: 100% of critical user flows
- ✅ CI runs E2E tests on every PR (parallel with unit tests)

**Test Scenarios:**

- Full game flow completes without errors
- Auth transitions work seamlessly
- Error states display helpful messages

---

### Phase 5: Hardening & Documentation (Week 6, 4-6 hours)

**Goal:** Stabilize tests, optimize CI, document patterns

**Tasks:**

1. **Test Stability** (2-3 hours)
   - Review all tests for flakiness (race conditions, timeouts)
   - Add retries for E2E tests (Playwright `retries: 2`)
   - Fix any intermittent failures in CI

2. **CI Optimization** (1-2 hours)
   - Parallelize CI jobs: lint, typecheck, test, e2e, build
   - Cache node_modules, Playwright browsers
   - Reduce total CI time to <5 minutes

3. **Documentation** (1 hour)
   - Update README with testing section:
     - How to run tests locally
     - How to add new tests
     - Coverage badge meanings
   - Create `docs/testing.md`:
     - Test patterns reference
     - When to unit vs E2E test
     - Troubleshooting common issues

**Deliverables:**

- ✅ <2% flaky test rate (GitHub Actions failure rate)
- ✅ CI runs in <5 minutes
- ✅ Documentation enables new contributors to add tests

---

## Risks & Mitigation

| Risk                                           | Likelihood | Impact | Mitigation                                                                                                 |
| ---------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| **80% threshold too high, blocks development** | Medium     | High   | Start with 75% for 2 weeks, increase gradually. Allow 1-2 file exceptions (documented in vitest.config.ts) |
| **convex-test beta API breaks**                | Low        | Medium | Pin to specific version, monitor changelog, have rollback plan to current mock pattern                     |
| **E2E tests flaky, fail CI intermittently**    | Medium     | High   | Playwright auto-retry (2x), strict timeouts, isolate network calls, screenshot on failure                  |
| **Badge updates fail (Gist auth)**             | Low        | Low    | Make badge job non-blocking (`continue-on-error: true`), manual fallback                                   |
| **CI time exceeds 5 minutes, slows team**      | Medium     | Medium | Parallelize jobs, cache aggressively, run E2E only on master (not all PRs)                                 |
| **Team resists writing tests, coverage drops** | Medium     | High   | Pair on first few tests, celebrate coverage wins, make tests easy with helpers                             |

---

## Key Decisions

### Decision 1: Strict 80% vs Gradual Increase

**What:** Enforce 80% coverage immediately
**Alternatives:**

- Gradual: 60% → 65% → 70% → 80% over 6 months
- Patch only: 80% on new code, 60% global

**Rationale (User Value + Simplicity):**

- User requested "strict enforcement" explicitly
- Codebase small (~5K LOC) → achievable in 5-6 weeks
- Prevents "we'll add tests later" debt accumulation
- Simplifies policy: one rule for all code

**Tradeoffs:**

- ✅ High quality bar from day 1
- ❌ May slow feature velocity for 5-6 weeks (acceptable tradeoff)

---

### Decision 2: vitest-coverage-report-action vs Codecov

**What:** Use vitest-coverage-report-action for PR comments
**Alternatives:**

- Codecov: More features, vendor lock-in, free tier limits
- Coveralls: Simpler, less popular

**Rationale (Simplicity + Explicitness):**

- GitHub-native, no external service login
- Free forever, no upload limits
- Explicit configuration (JSON paths in workflow)
- Active maintenance (2024-2025 updates)

**Tradeoffs:**

- ✅ Zero cost, zero vendor risk
- ❌ No historical trending (can add Codecov later if needed)

---

### Decision 3: Playwright vs Cypress

**What:** Use Playwright for E2E tests
**Alternatives:**

- Cypress: Better DX, slower execution, paid parallel tests
- Selenium: Legacy, complex setup

**Rationale (User Value + Risk):**

- Official Next.js 16 + React 19 support
- Faster execution (multi-context)
- Native parallel execution (free)
- Lower risk: Vercel partnership, active development

**Tradeoffs:**

- ✅ Future-proof, performant
- ❌ Steeper learning curve (acceptable, team can learn)

---

### Decision 4: Test All Code vs Critical Paths Only

**What:** Test all code (80% global coverage)
**Alternatives:**

- Critical paths only: 60% global, 90% on game logic
- Backend only: Skip frontend components

**Rationale (User Value):**

- User requested "total testing scope"
- Prevents bugs in "less critical" code reaching users
- Frontend bugs are user-facing (high impact)
- Comprehensive coverage enables confident refactoring

**Tradeoffs:**

- ✅ Maximum confidence in deployments
- ❌ Higher upfront investment (5-6 weeks of focused effort)

---

### Decision 5: convex-test vs Current Mock Pattern

**What:** Adopt official convex-test library
**Alternatives:**

- Keep current pattern: manual mocks of `mutation()`, `query()`, `ctx`
- Convex local backend: spin up real instance for tests

**Rationale (Simplicity + User Value):**

- Official support from Convex team
- 100x faster than local backend
- Deterministic time control for testing
- Simpler API than manual mocking

**Tradeoffs:**

- ✅ Faster, more reliable tests
- ⚠️ Beta API (mitigate: pin version, monitor changelog)

---

## Test Scenarios (Comprehensive)

### Unit Tests

**Backend (Convex):**

- ✅ Create room with valid host → generates 4-letter code
- ✅ Create room exceeds rate limit → throws error
- ✅ Join room when LOBBY → adds player
- ✅ Join room when IN_PROGRESS → throws error
- ✅ Join room at capacity (8 players) → throws error
- ✅ Get poems for room as participant → returns poems
- ✅ Get poems for room as non-participant → returns empty
- ✅ Toggle favorite first time → creates favorite
- ✅ Toggle favorite second time → removes favorite
- ✅ getUser with Clerk token → returns Clerk user
- ✅ getUser with guest token → returns guest user
- ✅ requireUser when null → throws "Unauthorized"

**Frontend (React):**

- ✅ Word count validation: "hello world" → 2 words
- ✅ Submit button disabled when count wrong
- ✅ Submit button enabled when count correct
- ✅ Lobby shows all players from room state
- ✅ Start Game disabled with <2 players
- ✅ Favorite heart icon toggles on click

**Utilities:**

- ✅ cn("px-4", "px-8") → "px-8" (later class wins)
- ✅ captureError() calls Sentry with context
- ✅ Room code generator: 4 chars, uppercase A-Z

### Integration Tests

**Convex Backend:**

- ✅ Complete game flow: createRoom → joinRoom → startGame → submitLine (9x) → getPoems
- ✅ Authorization chain: getUser → requireUser → query permission check
- ✅ Rate limiting: 3 creates in 10min → 4th fails

**API Routes:**

- ✅ GET /api/guest/session (no cookie) → creates UUID, sets cookie
- ✅ GET /api/guest/session (valid cookie) → returns existing UUID
- ✅ GET /api/health → returns { status: "ok", timestamp }

### E2E Tests

**Critical Flows:**

- ✅ Full game: Host creates → Guest joins → Start → Write 9 rounds → Reveal → Read poems
- ✅ Guest auth: Visit site → auto-create session → persist across pages
- ✅ Favorites: Reveal poem → Click heart → Navigate to /me/poems → See favorited
- ✅ Errors: Enter invalid code → See error message
- ✅ Capacity: Join full room (8 players) → Blocked with message

---

## Success Metrics

**Coverage (Automated):**

- Lines: 80%+ ✅
- Branches: 80%+ ✅
- Functions: 80%+ ✅
- Statements: 80%+ ✅

**CI/CD:**

- PR coverage reports: 100% of PRs ✅
- Badge updates: 100% of master merges ✅
- E2E test pass rate: >98% ✅
- CI duration: <5 minutes ✅

**Quality:**

- Production bugs from tested code: <1 per quarter ✅
- Flaky test rate: <2% ✅
- Test documentation completeness: 100% ✅

**Team Adoption:**

- Developers write tests before code: >80% of PRs ✅
- Test coverage maintained over time: no drops >2% ✅

---

## Test List (Generated for All Phases)

### Phase 1: Infrastructure

- [ ] vitest-coverage-report-action posts PR comment
- [ ] Coverage badges appear in README
- [ ] Playwright runs on `pnpm test:e2e`
- [ ] convex-test import works
- [ ] Test helpers reduce boilerplate by 50%+

### Phase 2: Backend

- [ ] rooms.test.ts: createRoom generates unique code
- [ ] rooms.test.ts: joinRoom enforces capacity limit
- [ ] rooms.test.ts: rate limiting blocks 4th create in 10min
- [ ] poems.test.ts: getPoemsForRoom filters by participation
- [ ] poems.test.ts: getPoemDetail orders lines correctly
- [ ] favorites.test.ts: toggleFavorite is idempotent
- [ ] auth.test.ts (convex): getUser handles Clerk + guest
- [ ] auth.test.ts (lib): useUser hook falls back to guest
- [ ] error.test.ts: captureError calls Sentry with context
- [ ] utils.test.ts: cn() merges Tailwind classes

### Phase 3: Frontend

- [ ] Lobby.test.tsx: Start Game disabled with <2 players
- [ ] WritingScreen.test.tsx: word count validation works
- [ ] RevealPhase.test.tsx: favorite toggle updates UI
- [ ] API health.test.ts: covers lines 34-41, 54
- [ ] API guest-session.test.ts: covers lines 46-51

### Phase 4: E2E

- [ ] game-flow.spec.ts: complete 9-round game
- [ ] auth.spec.ts: guest session persists across pages
- [ ] errors.spec.ts: invalid room code shows error
- [ ] favorites.spec.ts: favorited poem appears in /me/poems

### Phase 5: Hardening

- [ ] E2E flaky rate <2%
- [ ] CI runs in <5 minutes
- [ ] docs/testing.md complete

---

## Next Steps

1. **Review this PRD** with team for alignment on 80% threshold and 5-6 week timeline
2. **Create Gist** for badge storage (requires personal GitHub token)
3. **Run `/plan`** to break Phase 1 into implementation tasks
4. **Start with Phase 1** infrastructure setup (can parallelize with Phase 2 test writing)

**Timeline:** 5-6 weeks for all phases, can compress to 3-4 weeks with full-time focus.

---

**Note:** This is an ambitious but achievable plan. The 80% threshold is realistic given the codebase size and quality of existing tests. The team's existing test patterns (AAA, minimal mocking) are excellent and will accelerate implementation.
