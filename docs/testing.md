# Testing Guide

Linejam uses a hybrid testing stack: Vitest for unit/integration tests and Playwright for E2E tests.

## Quick Reference

```bash
pnpm test          # Run unit tests once
pnpm test:watch    # Watch mode for development
pnpm test:ci       # CI mode with coverage
pnpm test:e2e      # Run E2E tests
pnpm test:e2e:ui   # Playwright UI mode
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

**Multi-player tests** use separate browser contexts:

```typescript
const hostContext = await browser.newContext();
const guestContext = await browser.newContext();
```

## Coverage

### Thresholds

| Metric     | Threshold | Rationale                              |
| ---------- | --------- | -------------------------------------- |
| Lines      | 80%       | Standard coverage target               |
| Branches   | 80%       | Ensures conditional logic tested       |
| Functions  | 60%       | Convex wrappers inflate function count |
| Statements | 80%       | Standard coverage target               |

### Viewing Coverage

```bash
pnpm test:ci              # Generates coverage/
open coverage/index.html  # Interactive report
```

### Why 60% for Functions?

Convex generates wrapper functions for each query/mutation. These wrappers are tested indirectly through handler tests, but count against function coverage. The 60% threshold reflects this architectural reality.

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
5. Run locally: `pnpm test:e2e`
6. Run with UI: `pnpm test:e2e:ui`

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
