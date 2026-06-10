# Testing Guide

Linejam uses a hybrid testing stack: Vitest for unit/integration tests and Playwright for E2E tests. 500+ tests with 85% coverage enforcement.

## Quick Reference

```bash
pnpm test          # Run unit tests once
pnpm test:watch    # Watch mode for development
pnpm test:ci       # CI mode with coverage
pnpm ci:dagger:all # Local-first CI contract
pnpm test:e2e      # Run deterministic E2E tests (excludes @evidence)
pnpm test:e2e:smoke # Remote preview/prod smoke
pnpm test:e2e:evidence # Run the tagged evidence capture spec
pnpm test:e2e:ui   # Playwright UI mode
pnpm evidence:guest-flow # Package screenshots, video, GIF, and summary
pnpm qa:agentic:local --mission guest-host-signed-in-join # Advisory agentic QA against an already-running local target
pnpm qa:agentic:preview --mission guest-host-signed-in-join --base-url https://<preview-url> # Advisory preview QA
```

## Test Structure

```
tests/
├── app/api/           # API route tests
├── components/        # React component tests
├── convex/           # Convex function tests
│   └── lib/          # Auth and utility tests
├── e2e/              # Playwright E2E tests
├── helpers/          # Shared test utilities
└── lib/              # Frontend utility tests
```

## Test Patterns

### AAA Pattern (Arrange-Act-Assert)

All tests follow the AAA pattern for clarity:

```typescript
it('creates room with valid host', async () => {
  // Arrange
  mockDb.first.mockResolvedValue(null);
  mockDb.insert.mockResolvedValue('room_123');

  // Act
  const result = await mutation.handler(mockCtx, { hostName: 'Alice' });

  // Assert
  expect(result.roomCode).toMatch(/^[A-Z]{4}$/);
});
```

### Descriptive Test Names

Test names are complete sentences describing behavior:

```typescript
// Good
it('returns empty array when user has no poems');
it('throws Unauthorized when guest token is invalid');
it('displays error message when submission fails');

// Bad
it('empty poems');
it('invalid token');
it('error');
```

### Minimal Mocking

Mock at boundaries, test real behavior:

```typescript
// Good: Mock the database, test the function logic
mockDb.first.mockResolvedValue({ id: 'room_1', state: 'LOBBY' });
const result = await joinRoom.handler(mockCtx, args);
expect(result.playerId).toBeTruthy();

// Bad: Mock the function under test
vi.mock('./rooms', () => ({ joinRoom: vi.fn() }));
```

## Test Helpers

### Database Mock Factory

```typescript
import { createMockDb, createMockCtx } from '@/tests/helpers/mockConvexDb';

const mockDb = createMockDb();
const mockCtx = createMockCtx(mockDb);

// Configure mock responses
mockDb.first.mockResolvedValue({ id: 'room_1', code: 'ABCD' });
mockDb.collect.mockResolvedValue([{ id: 'player_1' }]);
```

### Environment Helper

```typescript
import { withEnv } from '@/tests/helpers/envHelper';

it('uses production secret', async () => {
  await withEnv({ GUEST_TOKEN_SECRET: 'prod-secret' }, async () => {
    // Test runs with env var set, restored afterward
  });
});
```

## Convex Function Testing

Convex functions are tested by mocking the generated server module:

```typescript
// Mock Convex server
vi.mock('../../convex/_generated/server', () => ({
  mutation: (args: unknown) => args,
  query: (args: unknown) => args,
}));

// Import after mocking
import { createRoom } from '@/convex/rooms';

// Cast to access handler
const mutation = createRoom as unknown as { handler: Function };

// Call handler directly
const result = await mutation.handler(mockCtx, { hostName: 'Alice' });
```

**Why this pattern?**

- Convex wraps functions in runtime machinery
- We test the handler logic directly
- `@ts-expect-error` comments document the type escape hatch

## Component Testing

React components are tested with Testing Library:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

it('enables submit when word count matches', async () => {
  const user = userEvent.setup();
  render(<WritingScreen roomCode="ABCD" />);

  await user.type(screen.getByRole('textbox'), 'Hello');

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /Submit/i })).toBeEnabled();
  });
});
```

**Key practices**:

- Mock Convex hooks (`useQuery`, `useMutation`)
- Mock auth hook (`useUser`)
- Use `userEvent` for realistic interactions
- Use `waitFor` for async state updates

## E2E Testing

Playwright tests run against a real dev server:

```typescript
test('host creates room', async ({ page }) => {
  await page.goto('/host');
  await page.fill('input#name', 'Host Player');
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/room\/[A-Z]{4}$/);
  expect(page.url()).toMatch(/\/room\/[A-Z]{4}$/);
});
```

**Configuration** (playwright.config.ts):

- Retries: 2 on CI, 0 locally
- Traces: collected on first retry
- Screenshots: on failure only
- Port: 3333 (avoids conflicts with dev server)
- Browser base URL: `http://localhost:${PORT_E2E:-3333}`
- `E2E_BASE_URL=https://...` targets a remote deployment and skips the local web server bootstrap
- `prod-smoke.spec.ts` is excluded from the local suite and runs only through `playwright.smoke.config.ts`

**Environment contract**:

- Local Dagger hydrates `GUEST_TOKEN_SECRET` automatically when `NEXT_PUBLIC_CONVEX_URL` points at the same Convex dev or prod deployment that the CLI resolves.
- `CLERK_SECRET_KEY` plus `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` enable authenticated browser coverage. The Playwright harness mirrors that publishable key into `CLERK_PUBLISHABLE_KEY` for Clerk's testing helpers. `PLAYWRIGHT_CLERK_TEST_EMAIL` is optional for dev/test Clerk keys because the harness can provision a default smoke user automatically there. Live Clerk keys fail closed instead: point `PLAYWRIGHT_CLERK_TEST_EMAIL` at a precreated smoke user.
- Local Dagger syncs the active Convex dev deployment before `pnpm ci:dagger:all` and `pnpm ci:dagger:e2e` so auth-heavy browser coverage exercises backend code from the current branch. Set `LINEJAM_SYNC_CONVEX_BEFORE_DAGGER=0` only when you intentionally want to skip that preparation step.
- Local Dagger ensures the Clerk `convex` JWT template exists before local auth-heavy browser coverage. Dev/test Clerk keys can be bootstrapped automatically; live-key creation requires `LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE=1`.
- Local Dagger refuses to push Convex production code unless `LINEJAM_ALLOW_PROD_CONVEX_SYNC=1` is set explicitly.
- Local Dagger loads `.env.local` after `.env.production.local`, so authenticated browser coverage can use localhost-safe Clerk test/dev keys from `.env.local`.
- The authoritative Dagger contract requires real browser-side Canary config for build-bearing lanes. Keep `NEXT_PUBLIC_CANARY_ENDPOINT` and `NEXT_PUBLIC_CANARY_API_KEY` set before running `pnpm ci:dagger:all`, `pnpm ci:dagger:all-no-e2e`, `pnpm ci:dagger:build-check`, or `pnpm ci:dagger:e2e`.
- Dagger treats authenticated browser coverage as part of the default contract. Set `PLAYWRIGHT_REQUIRE_AUTH_E2E=0` only when you are intentionally running a guest-only loop.
- Authenticated Playwright coverage signs into Clerk inside each live browser context after the app is serving traffic. That avoids depending on serialized auth state for dev-session syncing and keeps protected-route checks aligned with the actual test context.
- Remote smoke inverts the env preference: `.env.production.local` wins over `.env.local` so deployed targets use production-aligned Clerk keys by default. Authenticated smoke against `https://www.linejam.app` now fails fast if the active Clerk publishable key is still a `pk_test_...` localhost key or the secret key is still `sk_test_...`, and authenticated smoke validates that Clerk already has the `convex` JWT template before starting the browser run.
- `/api/health` reports app health separately from Canary readiness, so missing Canary ingest should be treated as degraded observability rather than proof that the game flow is down.

**Multi-player tests** use separate browser contexts:

```typescript
const hostContext = await browser.newContext();
const guestContext = await browser.newContext();
```

### Evidence Capture

The visual QA/demo path is a tagged Playwright spec plus a packaging wrapper:

```bash
pnpm test:e2e:evidence
pnpm evidence:guest-flow
```

- `pnpm test:e2e` excludes the `@evidence` suite so merge-gating stays deterministic.
- `pnpm evidence:guest-flow` runs the canonical guest flow, then writes screenshots, `guest-flow.webm`, `guest-flow.gif`, `qa-summary.md`, and `manifest.json`.
- When local Convex/Clerk wiring is unavailable, point the evidence run at a deployed target with `LINEJAM_BASE_URL=https://www.linejam.app`.

### Agentic QA

The agentic QA lane is advisory and writes stable artifacts under `.qa/runs/<run-id>/`. It does not replace `pnpm ci:prepush`, deterministic Playwright, or Dagger.

```bash
pnpm qa:agentic:local --mission guest-host-signed-in-join
pnpm qa:agentic:local --mission signed-in-host-guest-join
pnpm qa:agentic:preview --mission guest-host-signed-in-join --base-url https://<preview-url>
```

- Local runs target `PLAYWRIGHT_BASE_URL` or `http://localhost:3333`; start the app outside the harness before running the command.
- Preview runs require an explicit `--base-url`.
- Stagehand exploration is required for a passing agentic QA run. Set `STAGEHAND_MODEL_API_KEY` or a provider key such as `OPENAI_API_KEY`; override the default `openai/gpt-4.1-mini` model with `STAGEHAND_MODEL` when needed.
- Authenticated missions reuse the Clerk browser auth posture and fail closed when Clerk credentials are missing.
- Each run writes `manifest.json`, `stagehand.json`, screenshots, `critic.json`, `critic-summary.md`, and a Promptfoo receipt when model grading is enabled.
- Deterministic manifest checks decide pass/fail first. Set `LINEJAM_PROMPTFOO_CRITIC=1` to run the optional `qa/agentic/promptfoo.yaml` advisory model critic; a Promptfoo failure is recorded in the manifest but does not replace deterministic critic findings.
- Canary responder follow-up is disabled by default. Set `LINEJAM_AGENTIC_QA_AFTER_SMOKE=1`, `STAGEHAND_MODEL_API_KEY`, and optionally `LINEJAM_AGENTIC_QA_MISSION=<mission>` to attach an agentic artifact path after deterministic smoke succeeds.

## Coverage

### Thresholds

| Metric     | Threshold | Current       | Rationale                        |
| ---------- | --------- | ------------- | -------------------------------- |
| Lines      | 85%       | See latest CI | Standard coverage target         |
| Branches   | 85%       | See latest CI | Ensures conditional logic tested |
| Functions  | 85%       | See latest CI | Standard coverage target         |
| Statements | 85%       | See latest CI | Standard coverage target         |

### Viewing Coverage

```bash
pnpm test:ci              # Generates coverage/
open coverage/index.html  # Interactive report
```

## Adding New Tests

### Unit Test Checklist

1. Create file: `tests/[module].test.ts`
2. Add mocks at top of file
3. Use `describe` blocks for grouping
4. Follow AAA pattern
5. Use complete sentence test names
6. Run with coverage: `pnpm test:ci`

### E2E Test Checklist

1. Create file: `tests/e2e/[feature].spec.ts`
2. Use `test.describe` for grouping
3. Set `mode: 'serial'` if tests share state
4. Add `test.skip` for environment-dependent tests
5. Ensure `NEXT_PUBLIC_CONVEX_URL` points at the backend you want Dagger to exercise. Local Dagger will sync the matching Convex dev deployment automatically unless you disable it.
6. Run locally: `pnpm test:e2e`
7. Run with UI: `pnpm test:e2e:ui`

## Troubleshooting

### "Cannot find module" errors

Ensure imports happen after mocks:

```typescript
// Mocks first
vi.mock('convex/react', () => ({ useQuery: vi.fn() }));

// Then imports
import { MyComponent } from '@/components/MyComponent';
```

### Slow tests

Check for:

- Missing mock resolutions (use `mockResolvedValue`, not real async)
- Real network calls (mock fetch/API endpoints)
- Large DOM renders (isolate component under test)

### Flaky E2E tests

- Use explicit waits: `waitForURL`, `waitForSelector`
- Use serial mode for dependent tests
- Check for race conditions in real-time sync

### Coverage not updating

Clear cache and regenerate:

```bash
rm -rf coverage/
pnpm test:ci
```
