# TODO: Infrastructure & UX Sprint

## Context

- Architecture: Convex backend, Next.js 16 frontend, Tailwind CSS 4 design system
- Patterns: Auth helper in convex/lib/auth.ts, design tokens in globals.css
- Prior Work: Security hardening complete (auth centralization, authorization checks, build fix)

## Infrastructure Tasks

### Observability (Parallel)

- [x] Wire logger throughout application

  ```
  Files: components/WritingScreen.tsx:59, components/RevealPhase.tsx, components/Lobby.tsx:22,
         app/join/page.tsx, app/host/page.tsx:35-38, convex/lib/assignmentMatrix.ts
  Pattern: Replace console.error → logger.error with context
  Example:
    // Before: console.error('Failed to submit line:', error);
    // After: logger.error({ error, roomCode, poemId }, 'Failed to submit line');
  Success: Zero console.error in production code, all errors logged with context
  Test: grep console.error returns only test files
  Dependencies: None
  Time: 1h
  ```

- [x] Wire Sentry error capture in all catch blocks

  ```
  Files: Same files as logger task
  Pattern: Add Sentry.captureException after logger.error
  Example:
    Sentry.captureException(error, { contexts: { room: { code: roomCode } } });
  Success: All catch blocks capture to Sentry with relevant context
  Test: Throw error → appears in Sentry dashboard
  Dependencies: None (can parallel with logger)
  Time: 1h
  ```

- [x] Add test-error route for Sentry verification

  ```
  Files: app/test-error/page.tsx (new)
  Pattern: Simple button that throws test error
  Success: Clicking button shows error in Sentry dashboard
  Test: Navigate to /test-error, click button, verify in Sentry
  Dependencies: Sentry wiring complete
  Time: 10m
  ```

- [x] Add health check endpoint
  ```
  Files: app/api/health/route.ts (new)
  Pattern: Simple JSON response with status and timestamp
  Success: GET /api/health returns 200 with { status: 'ok', timestamp }
  Test: curl localhost:3000/api/health
  Dependencies: None
  Time: 10m
  ```

### Performance (Parallel - Convex N+1 Fixes)

- [ ] Parallelize submitLine round completion check

  ```
  Files: convex/game.ts:213-230
  Pattern: Promise.all instead of sequential loop
  Example:
    const lineChecks = await Promise.all(
      poems.map((p) => ctx.db.query('lines')
        .withIndex('by_poem_index', (q) => q.eq('poemId', p._id).eq('indexInPoem', lineIndex))
        .first())
    );
    const allSubmitted = lineChecks.every((line) => line !== null);
  Success: No sequential loops with DB queries in submitLine
  Test: 8 players submit → completion check < 50ms (was 150ms)
  Dependencies: None
  Time: 15m
  ```

- [ ] Parallelize getRoundProgress queries

  ```
  Files: convex/game.ts:391-428
  Pattern: Batch fetch poems once, parallelize line checks
  Success: O(1) poem fetch + parallel line checks
  Test: Waiting screen loads < 100ms (was 320ms)
  Dependencies: None
  Time: 30m
  ```

- [ ] Parallelize getPoemDetail author lookups

  ```
  Files: convex/poems.ts:57-64
  Pattern: Promise.all for author fetches, create lookup map
  Success: No for-loops with sequential DB queries
  Test: Poem detail loads < 50ms (was 9 sequential lookups)
  Dependencies: None
  Time: 45m
  ```

- [ ] Parallelize getMyPoems/getPoemsForRoom queries
  ```
  Files: convex/poems.ts:153-173, convex/poems.ts:24-35
  Pattern: Batch fetch with Promise.all
  Success: "My Collection" loads < 500ms (was 3+ seconds for 50 poems)
  Test: Load 50 poems → < 500ms total
  Dependencies: None
  Time: 45m
  ```

### Quality Gates (Sequential)

- [ ] Optimize pre-commit hooks (remove typecheck)

  ```
  Files: lefthook.yml:17-19
  Pattern: Move typecheck to pre-push only
  Rationale: Typecheck takes 5-10s, pre-commit should be < 5s
  Success: Pre-commit completes < 5s for typical commits
  Test: Time pre-commit with `time git commit --dry-run`
  Dependencies: None
  Time: 10m
  ```

- [ ] Add secrets scanning to pre-commit

  ```
  Files: lefthook.yml
  Pattern: gitleaks protect --staged --redact
  Prerequisite: brew install gitleaks
  Success: Commits with CLERK_SECRET_KEY blocked with clear message
  Test: Stage .env file → commit blocked
  Dependencies: None
  Time: 15m
  ```

- [ ] Parallelize CI pipeline

  ```
  Files: .github/workflows/ci.yml:32-45
  Pattern: Lint/format/typecheck as parallel jobs, test-build waits for all
  Success: CI runs 2-3 min faster
  Test: CI completion time before/after
  Dependencies: None
  Time: 30m
  ```

- [ ] Fix CI/Release branch naming

  ```
  Files: .github/workflows/ci.yml:6-7, release.yml:5
  Pattern: Standardize on master everywhere
  Success: All workflows use same branch name
  Test: grep for 'main' in workflows returns nothing
  Dependencies: None
  Time: 5m
  ```

- [ ] Target test coverage at critical paths
  ```
  Files: vitest.config.ts:24-29
  Pattern: convex/*.ts at 80%, global at 50%
  Success: CI fails if game logic < 80% coverage
  Test: Drop coverage in game.ts → CI fails
  Dependencies: None
  Time: 20m
  ```

## UX Tasks

- [ ] Replace alert() with inline error states

  ```
  Files: components/Lobby.tsx:22, components/WritingScreen.tsx:59
  Pattern: const [error, setError] = useState(''); with inline display
  Example: <p className="text-sm text-[var(--color-error)]">{error}</p>
  Success: Zero alert() calls in codebase
  Test: grep 'alert(' returns nothing
  Dependencies: None
  Time: 30m
  ```

- [ ] Fix silent failure on room creation

  ```
  Files: app/host/page.tsx:35-38
  Pattern: Add error state, display user-friendly message
  Success: Errors display message to user
  Test: Simulate failure → user sees error text
  Dependencies: None
  Time: 15m
  ```

- [ ] Add beforeunload warning for draft loss

  ```
  Files: components/WritingScreen.tsx
  Pattern: useEffect with beforeunload when textarea has content
  Success: Browser warns before closing with unsaved text
  Test: Type in textarea, close tab → browser prompts
  Dependencies: None
  Time: 15m
  ```

- [ ] Migrate profile page to design tokens

  ```
  Files: app/me/profile/page.tsx
  Pattern: Replace Tailwind grays with CSS variables
  Example:
    // Before: bg-gray-50 text-gray-500 border-gray-100
    // After: bg-[var(--color-background)] text-[var(--color-text-muted)] border-[var(--color-border)]
  Success: Zero Tailwind color utilities in profile page
  Test: grep 'gray-' in profile returns nothing
  Dependencies: None
  Time: 30m
  ```

- [ ] Fix "Play Again" button (implement or remove)
  ```
  Files: components/RevealPhase.tsx:157-159
  Options:
    A) Implement playAgain mutation (2-3h) - creates new game in same room
    B) Remove dead button (1m) - temporary until implemented
  Success: Button either works or doesn't exist
  Test: Click Play Again → new game starts OR button is gone
  Dependencies: Product decision on approach
  Time: 1m (remove) or 2-3h (implement)
  ```

## Analytics (Quick Win)

- [ ] Install Vercel Analytics + Speed Insights
  ```
  Files: app/layout.tsx
  Commands: pnpm add @vercel/analytics @vercel/speed-insights
  Pattern: Add Analytics and SpeedInsights components after children
  Success: Vercel dashboard shows page views and Core Web Vitals
  Test: Deploy → check Vercel Analytics tab
  Dependencies: None
  Time: 15m
  ```

## Sentry CI Integration (After Observability)

- [ ] Add Sentry release automation to CI

  ```
  Files: .github/workflows/ci.yml
  Pattern: Create release on master merge with commit info
  Success: Errors in Sentry show associated commits
  Test: Deploy → Sentry release appears with commit hashes
  Dependencies: Sentry wiring complete
  Time: 30m
  ```

- [ ] Reduce Session Replay sampling
  ```
  Files: sentry.client.config.ts:12
  Pattern: replaysSessionSampleRate: 0.0, keep replaysOnErrorSampleRate: 1.0
  Rationale: Conserves quota for actual errors
  Success: Replays only captured when errors occur
  Test: Browse normally → no replay, trigger error → replay captured
  Dependencies: None
  Time: 5m
  ```

## Design Iteration

After completing observability tasks: Review error handling patterns, extract common error UI component
After completing N+1 fixes: Profile Convex query times, identify any remaining bottlenecks

## Time Estimates

| Category      | Tasks | Total Time  |
| ------------- | ----- | ----------- |
| Observability | 4     | 2h 20m      |
| Performance   | 4     | 2h 15m      |
| Quality Gates | 5     | 1h 20m      |
| UX            | 5     | 1h 30m - 4h |
| Analytics     | 1     | 15m         |
| Sentry CI     | 2     | 35m         |

**Sprint Total**: ~8-11h depending on Play Again decision
