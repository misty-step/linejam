# TODO: Test Coverage Automation & Comprehensive Testing Infrastructure

## Context

- **Architecture**: Hybrid Testing Stack with Native GitHub Integration (TASK.md)
- **Key Decision**: vitest-coverage-report-action for PR comments, Playwright for E2E, convex-test for backend
- **Current State**: 79.44% coverage with 86 tests, Vitest + happy-dom, Lefthook configured
- **Goal**: 80% strict enforcement with automated reporting and comprehensive test suite
- **Branch Strategy**: Single branch for all 5 phases (cannot merge until 80% coverage achieved)
- **Progress**: Phase 1 ✅ complete | Phase 2 🚧 in progress (rooms complete, poems/favorites/auth remaining)

## Patterns to Follow

**Existing test patterns** (tests/convex/game.test.ts):

```typescript
// Mock Convex server
vi.mock('../../convex/_generated/server', () => ({
  mutation: (args: unknown) => args,
  query: (args: unknown) => args,
}));

// Mock database
mockDb = {
  query: vi.fn(() => mockDb),
  withIndex: vi.fn(() => mockDb),
  first: vi.fn(),
  collect: vi.fn(),
  patch: vi.fn(),
  insert: vi.fn(),
  get: vi.fn(),
};

// AAA pattern
it('describes behavior in complete sentence', async () => {
  // Arrange
  mockDb.first.mockResolvedValue({ ... });

  // Act
  // @ts-expect-error - calling handler directly for test
  const result = await mutation.handler(mockCtx, args);

  // Assert
  expect(result).toEqual({ ... });
});
```

**Files needing tests:**

- Convex: rooms.ts (174 LOC), poems.ts (155 LOC), favorites.ts (87 LOC)
- Lib: auth.ts (hook), error.ts, utils.ts
- Components: Lobby.tsx, WritingScreen.tsx, RevealPhase.tsx
- API routes: Complete coverage for health.test.ts, guest-session.test.ts

---

## Phase 1: Infrastructure Setup ✅ COMPLETE

### 1.1 Coverage Reporting Integration

- [x] **Add vitest-coverage-report-action to CI**

  ```
  Files: .github/workflows/ci.yml (modified)
  Status: ✅ Completed - PR comments configured with file-level coverage diffs
  ```

- [x] **Update vitest config for json-summary reporter**
  ```
  Files: vitest.config.ts (modified)
  Status: ✅ Completed - coverage/coverage-summary.json generated on test runs
  ```

### 1.2 Coverage Badges

- [x] **Add dynamic-badges-action to CI for master branch**

  ```
  Files: .github/workflows/ci.yml (badges job added)
  Status: ✅ Completed - 4 badges configured (requires GIST_SECRET setup by user)
  ```

- [x] **Update README with badge embeds**
  ```
  Files: README.md (modified)
  Status: ✅ Completed - 4 badge placeholders added (URLs need Gist ID update)
  ```

### 1.3 Coverage Threshold Enforcement

- [x] **Update coverage thresholds to 80%**

  ```
  Files: vitest.config.ts (modified)
  Status: ✅ Completed - Strict 80% enforcement active (currently failing as expected)
  ```

- [x] **Add informational coverage check to Lefthook pre-push**
  ```
  Files: lefthook.yml (modified)
  Status: ✅ Completed - Non-blocking coverage display added
  ```

### 1.4 Playwright Installation

- [x] **Install Playwright and configure for Next.js**

  ```
  Files: playwright.config.ts (new), package.json, .gitignore (modified)
  Status: ✅ Completed - pnpm test:e2e runs with 0 tests
  ```

- [x] **Add Playwright to CI as separate job**
  ```
  Files: .github/workflows/ci.yml (e2e job added)
  Status: ✅ Completed - Parallel E2E job runs on all PRs
  ```

### 1.5 Convex-Test Setup

- [x] **Install convex-test and dependencies**

  ```
  Files: package.json (modified)
  Status: ✅ Completed - convex-test@0.0.30 and @edge-runtime/vm@5.0.0 installed
  ```

- [x] **Create convex-test example for game.ts**
  ```
  Files: tests/convex/game-convex-test-example.test.ts (new)
  Status: ✅ Completed - Placeholder documentation created (Phase 2 will use convex-test)
  ```

### 1.6 Test Helpers Module

- [x] **Create database mock factory**

  ```
  Files: tests/helpers/mockConvexDb.ts (new)
  Status: ✅ Completed - createMockDb() and createMockCtx() helpers created
  ```

- [x] **Create environment variable helper**

  ```
  Files: tests/helpers/envHelper.ts (new)
  Status: ✅ Completed - withEnv() helper for environment isolation
  ```

- [x] **Refactor existing test to use helpers**
  ```
  Files: tests/convex/rateLimit.test.ts (modified)
  Status: ✅ Completed - 80% reduction in boilerplate, validates helpers work correctly
  ```

---

## Phase 2: Backend Testing - Convex Functions 🚧 IN PROGRESS

### 2.1 Convex Rooms Testing ✅ COMPLETE

- [x] **Test createRoom mutation**

  ```
  Files: tests/convex/rooms.test.ts (created)
  Status: ✅ Completed - 5 test cases covering creation, code generation, host assignment, rate limiting
  Coverage: rooms.ts 86.53% statements, 100% branches
  ```

- [x] **Test joinRoom mutation**

  ```
  Files: tests/convex/rooms.test.ts (included)
  Status: ✅ Completed - 6 test cases covering LOBBY join, IN_PROGRESS rejection, capacity limits,
           rate limiting, invalid codes, idempotency
  ```

- [x] **Test room query functions**

  ```
  Files: tests/convex/rooms.test.ts (included)
  Status: ✅ Completed - 6 test cases covering getRoom, getRoomState, authorization, code normalization
  ```

- [x] **Test generateRoomCode helper**
  ```
  Status: ✅ Tested indirectly - Code format (4 uppercase letters) and uniqueness validated through
           createRoom tests. generateRoomCode is not exported, so direct testing not possible.
  Coverage: 100% of generateRoomCode logic covered via createRoom tests
  ```

### 2.2 Convex Poems Testing

- [ ] **Test getPoemsForRoom query**

  ```
  Files: tests/convex/poems.test.ts (new)
  Architecture: Test poem retrieval with authorization
  Success: Tests pass, covers filtering logic
  Test Cases:
    - Returns poems for room where user participated
    - Returns empty array for non-participant
    - Filters by roomId correctly
    - Authorization check prevents unauthorized access
  Dependencies: Test helpers
  Time: 2 hours
  ```

- [ ] **Test getPoemDetail query**

  ```
  Files: tests/convex/poems.test.ts (append)
  Architecture: Test poem detail with line ordering
  Success: Tests pass, covers N+1 query pattern
  Test Cases:
    - Returns poem with lines in correct order
    - Resolves author names for each line
    - Handles missing/deleted authors gracefully
    - Authorization check enforced
  Dependencies: getPoemsForRoom tests
  Time: 2 hours
  ```

- [ ] **Test getMyPoems query**

  ```
  Files: tests/convex/poems.test.ts (append)
  Architecture: Test user's poem filtering
  Success: Tests pass, validates user filtering
  Test Cases:
    - Returns only poems where user contributed
    - Empty array when user has no poems
    - Includes all rooms user participated in
  Dependencies: getPoemsForRoom tests
  Time: 1.5 hours

  Coverage Target: 85%+ (poems.ts complex queries)
  ```

### 2.3 Convex Favorites Testing

- [ ] **Test toggleFavorite mutation**

  ```
  Files: tests/convex/favorites.test.ts (new)
  Architecture: Test favorite add/remove logic
  Success: Tests pass, validates idempotency
  Test Cases:
    - First toggle → creates favorite
    - Second toggle → removes favorite
    - Third toggle → creates favorite again (idempotent)
    - Authorization check (user owns favorite)
  Dependencies: Test helpers
  Time: 1.5 hours
  ```

- [ ] **Test getMyFavorites query**

  ```
  Files: tests/convex/favorites.test.ts (append)
  Architecture: Test favorites listing
  Success: Tests pass, covers N+1 pattern
  Test Cases:
    - Returns all user's favorites
    - Empty array when no favorites
    - Resolves poem details for each favorite
    - Authorization enforced
  Dependencies: toggleFavorite tests
  Time: 1 hour
  ```

- [ ] **Test isFavorited query**

  ```
  Files: tests/convex/favorites.test.ts (append)
  Architecture: Test favorite status check
  Success: Tests pass, returns boolean
  Test Cases:
    - Returns true when favorited
    - Returns false when not favorited
    - Authorization enforced
  Dependencies: toggleFavorite tests
  Time: 30 min

  Coverage Target: 90%+ (favorites.ts simple CRUD)
  ```

### 2.4 Convex Auth Testing

- [ ] **Test getUser helper (Convex)**

  ```
  Files: tests/convex/lib/auth.test.ts (new)
  Architecture: Test user resolution from Clerk/guest
  Success: Tests pass, covers all auth paths
  Test Cases:
    - Clerk user: getUserIdentity returns user → getUser returns Clerk user
    - Guest user: valid guestToken → getUser returns guest user
    - No auth: both null → getUser returns null
    - Invalid guest token → returns null
    - Expired guest token → returns null
  Dependencies: Test helpers
  Time: 2 hours
  ```

- [ ] **Test requireUser helper**

  ```
  Files: tests/convex/lib/auth.test.ts (append)
  Architecture: Test authorization enforcement
  Success: Tests pass, throws when unauthorized
  Test Cases:
    - Valid user → returns user
    - Null user → throws "Unauthorized" error
  Dependencies: getUser tests
  Time: 30 min

  Coverage Target: 95%+ (auth.ts critical security)
  ```

### 2.5 Frontend Auth Testing

- [ ] **Test useUser hook (lib/auth.ts)**

  ```
  Files: tests/lib/auth.test.ts (new)
  Architecture: Test Clerk + guest session integration
  Success: Tests pass, covers all states
  Test Cases:
    - Clerk user loaded → returns Clerk user, no guest
    - Clerk loading → returns loading state
    - No Clerk user → creates guest session, returns guestId
    - Guest cookie exists → reuses existing guestId
    - Cookie tampered → creates new session
  Dependencies: Test helpers, @testing-library/react
  Time: 3 hours (complex async/useEffect behavior)

  Coverage Target: 80%+ (integration complexity)
  ```

### 2.6 Utility Testing

- [ ] **Test lib/error.ts captureError**

  ```
  Files: tests/lib/error.test.ts (new)
  Architecture: Test Sentry wrapper
  Success: Tests pass, validates Sentry calls
  Test Cases:
    - Calls Sentry.captureException with error
    - Passes context to Sentry
    - Handles different error types (Error, string, unknown)
    - DSN present vs missing (env var)
  Dependencies: Test helpers (envHelper)
  Time: 1 hour

  Coverage Target: 100% (simple wrapper)
  ```

- [ ] **Test lib/utils.ts cn() helper**

  ```
  Files: tests/lib/utils.test.ts (new)
  Architecture: Test Tailwind class merging
  Success: Tests pass, validates clsx + tailwind-merge
  Test Cases:
    - Merges classes: cn("px-4", "py-2") → "px-4 py-2"
    - Later class wins: cn("px-4", "px-8") → "px-8"
    - Conditional classes: cn("px-4", false && "py-2") → "px-4"
    - Tailwind conflicts resolved correctly
  Dependencies: None
  Time: 1 hour

  Coverage Target: 100% (trivial utility)
  ```

---

## Phase 3: Frontend Testing - Components & Hooks (12-16 hours)

### 3.1 Game Component Testing

- [ ] **Test Lobby component**

  ```
  Files: tests/components/Lobby.test.tsx (new)
  Architecture: Test room code display, player list, Start Game button
  Success: Tests pass, covers stateful logic
  Test Cases:
    - Displays room code correctly
    - Renders player list from room state
    - Start Game button disabled with <2 players
    - Start Game button enabled with ≥2 players
    - QR code component rendered when requested
  Dependencies: @testing-library/react
  Time: 3 hours
  ```

- [ ] **Test WritingScreen component**

  ```
  Files: tests/components/WritingScreen.test.tsx (new)
  Architecture: Test word count validation, submit state
  Success: Tests pass, validates user input logic
  Test Cases:
    - Word count validation: "hello world" → 2 words
    - Submit button disabled when word count wrong
    - Submit button enabled when word count correct
    - Previous line displays correctly
    - Error feedback shown for over/under word count
    - Correct round constraint enforced (1,2,3,4,5,4,3,2,1)
  Dependencies: @testing-library/react, user-event
  Time: 3.5 hours
  ```

- [ ] **Test RevealPhase component**

  ```
  Files: tests/components/RevealPhase.test.tsx (new)
  Architecture: Test poem display, favorite toggle
  Success: Tests pass, validates reveal logic
  Test Cases:
    - Displays poem with lines in order
    - Favorite toggle updates UI optimistically
    - Navigation between poems works
    - Author names displayed correctly
  Dependencies: @testing-library/react, user-event
  Time: 2.5 hours

  Coverage Target: 70%+ (components lower ROI than logic)
  ```

### 3.2 UI Primitive Testing (Selective)

- [ ] **Test complex UI primitives only**

  ```
  Files: tests/components/EnsoCounter.test.tsx (new, if needed)
  Architecture: Test components with animation state or complex logic
  Success: Tests pass for components with logic
  Test Cases (if applicable):
    - EnsoCounter: animation state transitions
    - StampAnimation: SVG manipulation logic
  Skip: Button, Card, Input, Alert (pure wrappers)
  Dependencies: @testing-library/react
  Time: 2 hours

  Coverage Target: 50%+ (selective testing)
  ```

### 3.3 API Route Testing Completion

- [ ] **Complete health route coverage**

  ```
  Files: tests/app/api/health.test.ts (modify)
  Architecture: Cover uncovered lines 34-41, 54
  Success: Tests pass, 90%+ coverage
  Test Cases:
    - Convex ping fails → returns 500
    - Malformed request → handles gracefully
    - Missing headers → appropriate error
  Dependencies: None
  Time: 1.5 hours
  ```

- [ ] **Complete guest-session route coverage**

  ```
  Files: tests/app/api/guest-session.test.ts (modify)
  Architecture: Cover uncovered lines 46-51
  Success: Tests pass, 90%+ coverage
  Test Cases:
    - Token signing fails → error handling
    - Cookie setting fails → appropriate response
    - Edge cases for tampered cookies
  Dependencies: None
  Time: 1.5 hours

  Coverage Target: 90%+ (API routes critical)
  ```

---

## Phase 4: E2E Testing - Critical User Flows (8-12 hours)

### 4.1 Core Game Flow E2E

- [ ] **Test complete game flow**
  ```
  Files: tests/e2e/game-flow.spec.ts (new)
  Architecture: Multi-context test simulating 2 players through 9 rounds
  Success: Test passes, covers full game lifecycle
  Test Cases:
    - Host creates room → room code displayed
    - Guest joins room (2nd context) → appears in lobby
    - Host starts game → round 1 begins
    - Both players submit lines → round progression
    - Complete all 9 rounds → reveal phase triggered
    - Read poems → lines in correct order
  Dependencies: Playwright configured
  Time: 4.5 hours (complex multi-context, real-time sync)
  ```

### 4.2 Auth Flow E2E

- [ ] **Test guest session and Clerk auth**
  ```
  Files: tests/e2e/auth.spec.ts (new)
  Architecture: Test authentication flows
  Success: Tests pass, validates auth persistence
  Test Cases:
    - Guest session creation → cookie set
    - Guest UUID persistence across navigation
    - Display name from guest vs Clerk
    - (Optional) Clerk login with test account
  Dependencies: Playwright configured
  Time: 2.5 hours
  ```

### 4.3 Error Scenarios E2E

- [ ] **Test error states and validation**
  ```
  Files: tests/e2e/errors.spec.ts (new)
  Architecture: Test error handling and user feedback
  Success: Tests pass, validates error messages
  Test Cases:
    - Invalid room code → error message displayed
    - Room at capacity (9 players) → join blocked
    - Submit line with wrong word count → validation error
    - Network error → retry/fallback behavior
  Dependencies: Playwright configured
  Time: 2.5 hours
  ```

### 4.4 Favorites Flow E2E

- [ ] **Test favorite toggle and list**

  ```
  Files: tests/e2e/favorites.spec.ts (new)
  Architecture: Test favorites feature end-to-end
  Success: Tests pass, validates favorite persistence
  Test Cases:
    - Toggle favorite on poem → heart icon updates
    - Navigate to /me/poems → favorited poem appears
    - Unfavorite → removal from list
  Dependencies: Playwright configured, game flow complete
  Time: 1.5 hours

  E2E Coverage: 100% of critical user flows (5-10 tests total)
  ```

---

## Phase 5: Hardening & Documentation (4-6 hours)

### 5.1 Test Stability

- [ ] **Review all tests for flakiness**

  ```
  Files: All test files (review)
  Architecture: Identify race conditions, timeouts
  Success: No flaky tests in 10 consecutive CI runs
  Test: Run CI 10 times → <2% failure rate
  Dependencies: All tests written
  Time: 2 hours
  ```

- [ ] **Add Playwright retries and error handling**
  ```
  Files: playwright.config.ts (modify)
  Architecture: Configure retries, timeouts, screenshots
  Success: E2E tests more resilient
  Test: Flaky E2E test passes after retry
  Dependencies: E2E tests written
  Time: 1 hour
  ```

### 5.2 CI Optimization

- [ ] **Parallelize CI jobs and optimize caching**
  ```
  Files: .github/workflows/ci.yml (modify)
  Architecture: Parallel jobs, cache node_modules and browsers
  Success: CI runs in <5 minutes
  Test: Push change → CI completes in <5min
  Dependencies: All CI jobs configured
  Time: 1 hour
  ```

### 5.3 Documentation

- [ ] **Update README with testing section**

  ```
  Files: README.md (modify after Tech Stack section)
  Architecture: Add "Testing" section with commands
  Success: Clear instructions for running tests
  Content:
    - How to run tests locally (unit, E2E)
    - How to add new tests
    - Coverage badge meanings
    - Test patterns reference
  Dependencies: None
  Time: 45 min
  ```

- [ ] **Create docs/testing.md**
  ```
  Files: docs/testing.md (new)
  Architecture: Comprehensive testing guide
  Success: New contributors can add tests
  Content:
    - Test patterns reference (AAA, mocking)
    - When to unit vs integration vs E2E test
    - Troubleshooting common issues
    - Test helpers API documentation
  Dependencies: None
  Time: 1 hour
  ```

---

## Final Validation Checklist

**Before merging to master:**

### Infrastructure

- [ ] PR comments show coverage diff with file-level detail
- [ ] README displays 4 coverage badges (all green ≥80%)
- [ ] `pnpm test:ci` passes with 80%+ coverage
- [ ] `pnpm test:e2e` passes all E2E tests
- [ ] Lefthook pre-push shows coverage info (non-blocking)
- [ ] CI runs all jobs in <5 minutes

### Coverage Metrics

- [ ] Lines: ≥80%
- [ ] Branches: ≥80%
- [ ] Functions: ≥80%
- [ ] Statements: ≥80%

### Test Quality

- [ ] All tests follow AAA pattern
- [ ] Descriptive test names (complete sentences)
- [ ] Minimal mocking (behavior, not implementation)
- [ ] No flaky tests (<2% failure rate in CI)

### Documentation

- [ ] README testing section complete
- [ ] docs/testing.md comprehensive
- [ ] Test helpers documented
- [ ] All patterns clearly explained

---

## Success Metrics

**Automated:**

- Coverage: 80%+ all metrics ✅
- PR coverage reports: 100% of PRs ✅
- Badge updates: 100% of master merges ✅
- E2E test pass rate: >98% ✅
- CI duration: <5 minutes ✅

**Quality:**

- Production bugs from tested code: <1 per quarter
- Flaky test rate: <2%
- Test documentation completeness: 100%

---

## Time Budget

**Phase 1 (Infrastructure)**: 8-12 hours
**Phase 2 (Backend Tests)**: 16-24 hours
**Phase 3 (Frontend Tests)**: 12-16 hours
**Phase 4 (E2E Tests)**: 8-12 hours
**Phase 5 (Hardening)**: 4-6 hours

**Total: 48-70 hours** (6-9 days full-time, 2-3 weeks part-time)

---

## Dependencies Graph

```
Phase 1 (Infrastructure)
  ├─ 1.1-1.3 (Coverage) → 1.2 (Badges) → README
  ├─ 1.4 (Playwright) → Phase 4
  ├─ 1.5 (convex-test) → 1.6 (Helpers) → Phase 2
  └─ All complete → Phase 2-5 can start

Phase 2 (Backend) → Phase 3 (Frontend) → Phase 4 (E2E)
  ↓                    ↓                    ↓
Phase 5 (Hardening & Docs) - requires all phases complete
```

**Parallel Opportunities:**

- Within Phase 1: Coverage (1.1-1.3) || Playwright (1.4) || convex-test (1.5)
- Within Phase 2: All test files can be written in parallel
- Within Phase 3: All component tests can be written in parallel
- Within Phase 4: E2E tests independent (but auth.spec needs game-flow.spec complete)

---

## Notes

**Why One Branch:**

1. 80% threshold blocks merging until all tests written
2. Solo developer (no parallel team benefit)
3. Atomic feature (automation + tests ship together)
4. Less context switching, one comprehensive PR

**Module Value Check:**

- Coverage Reporter: High value, low interface ✅
- Test Helpers: Medium value, minimal interface ✅
- Playwright: High value, simple interface ✅
- convex-test: High value, hides complexity ✅
- Backend tests: High value (prevents bugs), simple interface (test files) ✅
- E2E tests: High value (user confidence), simple interface (spec files) ✅

**Critical Success Factor:**
This is ambitious (48-70 hours) but achievable with focused execution. The 80% threshold is realistic given codebase size and existing test quality. Infrastructure (Phase 1) enables everything else—once automated reporting works, writing tests becomes straightforward.

**Strategic Milestone:**
After Phase 1: Infrastructure enforces quality
After Phase 2: Backend coverage ≥80%, CI starts passing
After Phase 3: Frontend coverage ≥80%, full coverage achieved
After Phase 4: E2E coverage proves critical flows work
After Phase 5: Production-ready, supremely confident deployments
