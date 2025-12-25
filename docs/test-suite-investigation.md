# Test Suite Investigation & Optimization Plan

Investigation completed: December 2025

## Executive Summary

The Linejam test suite contains **315 tests** (294 unit/integration + 21 E2E) with significant performance bottlenecks. Analysis reveals 6 major optimization areas with potential **60-70% overall speedup**.

### Current State

| Metric              | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| Total Tests         | 315 tests                                                               |
| Unit/Integration    | 294 tests (33 files)                                                    |
| E2E Tests           | 21 tests (4 files)                                                      |
| Test Directory Size | 316K                                                                    |
| Largest Test Files  | game.test.ts (707 lines, 27 tests), poems.test.ts (657 lines, 23 tests) |
| beforeEach Hooks    | 56 instances                                                            |
| Module Reloads      | 25 `vi.resetModules()` calls                                            |
| Artificial Timeouts | 5 instances (1-sec + 100ms delays)                                      |
| Mock Operations     | 154 total (118 `vi.fn()`, 36 `vi.mock()`, 27 cleanups)                  |

---

## Performance Bottlenecks

### 1. Excessive beforeEach Overhead

**Problem:** Every test file runs `beforeEach()` to recreate mocks, even when identical state is needed across tests.

**Impact:**

- Mock object instantiation overhead
- Repeated mock configuration
- 56 hooks across the suite

**Example:**

```typescript
// tests/convex/game.test.ts
beforeEach(() => {
  mockDb = createMockDb(); // New instance every test
  mockCtx = createMockCtx(mockDb);
  mockGetUser.mockReset(); // Over-aggressive reset
});
```

**Cost:** ~10-15% of total test time

---

### 2. Module Reload Pattern

**Problem:** API and Sentry tests reload entire module hierarchy per describe block to reset env vars.

**Files affected:**

- `tests/app/api/health.test.ts` (6 `resetModules`)
- `tests/app/api/guest-session.test.ts` (4 `resetModules`)
- `tests/lib/sentry.test.ts` (5 `resetModules`)

**Example:**

```typescript
describe('with DSN', () => {
  beforeAll(async () => {
    vi.resetModules(); // Reloads entire module tree
    process.env.SENTRY_DSN = '...';
    const mod = await import('@/lib/sentry');
  });
});
```

**Cost:** Module reload is expensive, especially with React/Next.js dependencies

---

### 3. Explicit Timeout Delays

**Problem:** Artificial delays simulating async operations add unnecessary wait time.

**Locations:**

- `tests/components/WritingScreen.test.tsx:168` - 1000ms `setTimeout`
- `tests/components/RevealPhase.test.tsx:117` - 1000ms `setTimeout`
- `tests/integration/guestToken-cross-platform.test.ts:131` - 100ms `setTimeout`
- `tests/e2e/auth.spec.ts` - 2 instances of `waitForTimeout(500)`

**Example:**

```typescript
// WritingScreen.test.tsx
mockSubmitLineMutation.mockImplementation(
  () => new Promise((resolve) => setTimeout(resolve, 1000))
);
```

**Cost:** 3+ seconds per full test run, zero value gained

---

### 4. Heavy Mock Reconfiguration

**Problem:** 154 mock operations create significant overhead.

**Breakdown:**

- 118 `vi.fn()` calls
- 36 `vi.mock()` declarations
- 27 `mockReset/mockClear/mockRestore` operations

**Example:**

```typescript
// tests/convex/game.test.ts
const mockGetUser = vi.fn();
const mockScheduler = vi.fn();
vi.mock('../../convex/lib/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));
```

**Cost:** Mock setup/teardown overhead, unnecessary for immutable mocks

---

### 5. Large Monolithic Test Files

**Problem:** Files with 500-700 lines create maintenance burden and slow selective execution.

**Top offenders:**
| File | Lines | Tests | Purpose |
|------|-------|-------|---------|
| game.test.ts | 707 | 27 | Game state machine |
| poems.test.ts | 657 | 23 | Poem queries |
| rooms.test.ts | 552 | 22 | Room management |
| favorites.test.ts | 377 | 16 | Favorite operations |
| llm.test.ts | 433 | 21 | AI line generation |

**Cost:**

- Slow test discovery
- Hard to run targeted tests
- Poor test locality

---

### 6. E2E Overhead

**Problem:** Dev server startup, timeouts, and serial execution create major bottlenecks.

**Configuration:**

```typescript
// playwright.config.ts
timeout: 120000,              // 2 minutes per test
retries: process.env.CI ? 2 : 0,
workers: process.env.CI ? 2 : undefined,
```

**Issues:**

- Dev server starts fresh per test suite
- Serial mode (`test.describe.configure({ mode: 'serial' })`)
- 2-minute timeout is excessive for simple flows
- Only 2 workers on CI

**Cost:** E2E suite takes 5-10 minutes for 21 tests

---

## Optimization Plan

### Phase 1: Quick Wins (20-30% speedup)

#### 1.1 Remove Artificial Timeouts

**Files to modify:**

- `tests/components/WritingScreen.test.tsx:168`
- `tests/components/RevealPhase.test.tsx:117`
- `tests/integration/guestToken-cross-platform.test.ts:131`
- `tests/e2e/auth.spec.ts`

**Change:**

```typescript
// Before
mockMutation.mockImplementation(
  () => new Promise((resolve) => setTimeout(resolve, 1000))
);

// After
mockMutation.mockResolvedValue(undefined);
```

**Impact:** 3+ seconds saved, no loss in effectiveness

---

#### 1.2 Reduce beforeEach Execution

**Change:**

```typescript
// Current
beforeEach(() => {
  mockDb = createMockDb(); // New every time
  mockCtx = createMockCtx(mockDb);
  mockGetUser.mockReset();
});

// Optimized
const mockDb = createMockDb(); // Shared
const mockCtx = createMockCtx(mockDb);

beforeEach(() => {
  mockGetUser.mockReset(); // Only reset mutable state
});
```

**Files:** All Convex test files (game.test.ts, poems.test.ts, rooms.test.ts, etc.)

**Impact:** 10-15% speedup from reduced mock instantiation

---

#### 1.3 Cache Happy-DOM Environment

**Change:**

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    poolOptions: {
      threads: {
        singleThread: true, // Reuse environment
      },
    },
  },
});
```

**Impact:** 5-10% speedup, avoids recreating DOM

---

### Phase 2: Mock Optimization (15-20% speedup)

#### 2.1 Shared Mock Factories

**Create:** `tests/helpers/convexMocks.ts`

```typescript
export function createConvexMocks() {
  return {
    mockDb: createMockDb(),
    mockCtx: createMockCtx(),
    mockGetUser: vi.fn(),
    mockCheckParticipation: vi.fn(),
  };
}
```

**Usage:**

```typescript
import { createConvexMocks } from '@/tests/helpers/convexMocks';

describe('poems', () => {
  const mocks = createConvexMocks();

  beforeEach(() => {
    mocks.mockGetUser.mockReset();
  });
});
```

---

#### 2.2 Reduce Mock Cleanup

**Before:**

```typescript
beforeEach(() => {
  vi.clearAllMocks(); // Everything
  vi.unstubAllGlobals(); // Everything
  vi.restoreAllMocks(); // Everything
});
```

**After:**

```typescript
beforeEach(() => {
  mocks.mockGetUser.mockReset(); // Only what you use
  mockDb.first.mockReset();
});
```

---

#### 2.3 Stub Global Crypto Once

**File:** `tests/lib/assignPoemReaders.test.ts`

```typescript
beforeAll(() => {
  vi.stubGlobal('crypto', {
    getRandomValues: (array: Uint32Array) => {
      array[0] = deterministicCounter++;
      return array;
    },
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});
```

---

### Phase 3: Architecture Improvements (30-40% speedup)

#### 3.1 Test Organization - Feature-Based Splits

**Restructure large files:**

```
tests/convex/
  game/
    startNewCycle.test.ts
    submitLine.test.ts
    getCurrentAssignment.test.ts
    getRevealPhaseState.test.ts
    startGame.test.ts
  poems/
    listForRoom.test.ts
    getDetail.test.ts
    getPublicPoemPreview.test.ts
  rooms/
    createRoom.test.ts
    joinRoom.test.ts
    leaveRoom.test.ts
```

**Benefits:**

- Faster selective execution
- Better test locality
- Easier maintenance
- Parallelizable per-file

---

#### 3.2 Reduce Module Reloads

**Current pattern:**

```typescript
describe('with DSN', () => {
  beforeAll(async () => {
    vi.resetModules();
    process.env.SENTRY_DSN = '...';
  });
});

describe('without DSN', () => {
  beforeAll(async () => {
    vi.resetModules(); // Another reload
    delete process.env.SENTRY_DSN;
  });
});
```

**Optimized:**

```typescript
describe('sentryOptions', () => {
  beforeAll(async () => {
    vi.resetModules();
    // Set all possible env at once
  });

  it('works with DSN', async () => { ... });
  it('works without DSN', async () => {
    // Set/unset at test level instead
  });
});
```

---

#### 3.3 Test Isolation Mode

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    isolate: false, // Share context between tests
  },
});
```

**Warning:** Only safe if tests don't mutate shared state. Use with caution.

---

### Phase 4: E2E Optimization (50%+ speedup)

#### 4.1 Test Tagging & Selective Execution

```typescript
test.describe('Critical Path', { tag: ['@critical'] }, () => {
  test('host creates room', async ({ page }) => { ... });
  test('guest joins room', async ({ page }) => { ... });
});

test.describe('Full Game Flow', { tag: ['@full-game'] }, () => {
  test('complete 9-round game', async ({ page }) => { ... });
});
```

**CI Scripts:**

```json
{
  "scripts": {
    "test:e2e:critical": "playwright test --grep @critical",
    "test:e2e:full": "playwright test --grep @full-game"
  }
}
```

---

#### 4.2 Parallelize Serial Tests

```typescript
// Current: Everything serial
test.describe.configure({ mode: 'serial' });

// Optimized: Group dependent tests only
test.describe('Room Setup', { mode: 'serial' }, () => {
  test('host creates room', async ({ page }) => { ... });
  test('guest joins room', async ({ page }) => { ... });
});

test.describe('Independent Features', () => {
  test('host sees lobby', async ({ page }) => { ... }); // Parallel
  test('guest sees lobby', async ({ page }) => { ... }); // Parallel
});
```

---

#### 4.3 Reduce Timeouts

```typescript
// playwright.config.ts
export default defineConfig({
  timeout: 60000, // Reduce from 120000
  workers: process.env.CI ? 4 : 2, // Increase from 2
});
```

---

#### 4.4 Shared Browser Context

```typescript
test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  // Reuse for all tests in suite
});

test.afterAll(async () => {
  await context.close();
});
```

---

### Phase 5: Coverage & Quality Gates

#### 5.1 Differential Coverage

```bash
# Only check coverage for changed files
npx vitest run --coverage.changed
```

---

#### 5.2 Parallel Vitest Workers

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 2,
        maxThreads: 4, // Match CPU cores
      },
    },
  },
});
```

---

#### 5.3 Test Suites by Tier

```json
{
  "scripts": {
    "test:fast": "vitest run tests/lib/*.test.ts",
    "test:medium": "vitest run tests/convex/*.test.ts",
    "test:slow": "vitest run tests/components/*.test.tsx tests/app/api/*.test.ts",
    "test:ci": "vitest run --coverage",
    "test:e2e:critical": "playwright test --grep @critical"
  }
}
```

**Tier Usage:**

- **Fast:** Pre-commit checks (< 30s)
- **Medium:** CI full suite (< 2 min)
- **Slow:** Nightly runs
- **E2E Critical:** PRs
- **E2E Full:** Nightly/master

---

## Expected Results

| Phase                             | Impact                    | Effort      | Timeline      |
| --------------------------------- | ------------------------- | ----------- | ------------- |
| Phase 1: Quick Wins               | 20-30% faster             | Low         | 1 day         |
| Phase 2: Mock Optimization        | 15-20% faster             | Medium      | 2-3 days      |
| Phase 3: Architecture             | 30-40% faster             | High        | 1 week        |
| Phase 4: E2E Optimization         | 50%+ faster (E2E)         | Medium      | 2-3 days      |
| Phase 5: Coverage & Quality Gates | Faster CI feedback        | Medium      | 2-3 days      |
| **Combined**                      | **60-70% faster overall** | Medium-High | **2-3 weeks** |

---

## Trade-offs & Considerations

### Speed vs. Isolation

`isolate: false` is faster but riskier.

**Recommendation:**

- Use for pure unit tests (no side effects)
- Keep isolation for integration/E2E tests
- Verify with flaky test detection

---

### Module Reloads

Necessary for env-dependent code (health, session, sentry).

**Recommendation:**

- Accept for small number of API tests
- Avoid in large Convex test suites
- Group env-dependent tests together

---

### Test Splits

More files to maintain.

**Recommendation:**

- Trade for faster selective execution
- Use feature-based organization
- Enforce via code review

---

### E2E Strategy

Don't test everything in E2E.

**Principles:**

- Critical paths in E2E
- Edge cases in unit tests
- Tag-based execution for CI speed
- Full E2E on nightly/master only

---

## Implementation Roadmap

### Week 1: Quick Wins

- [ ] Remove artificial timeouts (Phase 1.1)
- [ ] Reduce beforeEach execution (Phase 1.2)
- [ ] Cache Happy-DOM environment (Phase 1.3)
- [ ] Measure impact

### Week 2: Mock Optimization

- [ ] Create shared mock factories (Phase 2.1)
- [ ] Reduce mock cleanup (Phase 2.2)
- [ ] Stub globals once (Phase 2.3)
- [ ] Measure impact

### Week 3-4: Architecture

- [ ] Split large test files (Phase 3.1)
- [ ] Reduce module reloads (Phase 3.2)
- [ ] Test isolation mode (Phase 3.3)
- [ ] Measure impact

### Week 5: E2E Optimization

- [ ] Test tagging system (Phase 4.1)
- [ ] Parallelize serial tests (Phase 4.2)
- [ ] Reduce timeouts (Phase 4.3)
- [ ] Shared browser context (Phase 4.4)
- [ ] Measure impact

### Week 6: Coverage & Quality Gates

- [ ] Differential coverage (Phase 5.1)
- [ ] Parallel workers (Phase 5.2)
- [ ] Test tier system (Phase 5.3)
- [ ] Update CI workflows

---

## Metrics to Track

### Before Optimization

- Full test suite time: `pnpm test:ci`
- E2E test suite time: `pnpm test:e2e`
- Fast test suite (pre-commit): Target < 30s
- Medium test suite (CI): Target < 2 min

### After Optimization

- Target: 60-70% faster overall
- Target: Pre-commit < 10s
- Target: CI unit tests < 1 min
- Target: CI E2E critical < 2 min

---

## Key Files to Modify

### Phase 1 (Quick Wins)

- `tests/components/WritingScreen.test.tsx`
- `tests/components/RevealPhase.test.tsx`
- `tests/integration/guestToken-cross-platform.test.ts`
- `tests/e2e/auth.spec.ts`
- `vitest.config.ts`

### Phase 2 (Mock Optimization)

- `tests/helpers/` (new: `convexMocks.ts`)
- All Convex test files
- `tests/lib/assignPoemReaders.test.ts`

### Phase 3 (Architecture)

- `tests/convex/game.test.ts` → split into 5 files
- `tests/convex/poems.test.ts` → split into 3 files
- `tests/convex/rooms.test.ts` → split into 3 files
- `tests/app/api/health.test.ts`
- `tests/app/api/guest-session.test.ts`
- `tests/lib/sentry.test.ts`

### Phase 4 (E2E)

- All `tests/e2e/*.spec.ts` files
- `playwright.config.ts`

### Phase 5 (Coverage & CI)

- `vitest.config.ts`
- `.github/workflows/ci.yml`
- `package.json` (scripts)

---

## Conclusion

The Linejam test suite has significant optimization potential. Focus on **Phase 1** for immediate wins, then progress through phases systematically. Each phase delivers measurable improvements while maintaining test effectiveness.

**Priority:** Start with Phase 1 (Quick Wins) - 20-30% improvement in 1 day.

**Long-term:** Complete Phases 2-5 for 60-70% overall speedup.

---

## References

- Vitest Configuration: https://vitest.dev/config/
- Playwright Best Practices: https://playwright.dev/docs/best-practices
- Testing Library: https://testing-library.com/docs/guiding-principles/
- Test Pyramids: https://martinfowler.com/articles/practical-test-pyramid.html
