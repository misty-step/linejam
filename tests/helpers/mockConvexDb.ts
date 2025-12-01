import { vi } from 'vitest';

/**
 * Creates a mock Convex database with chainable query methods.
 * Used for testing Convex mutations and queries without a real database.
 *
 * @returns Mock database object with spy functions
 */
export function createMockDb() {
  const mockDb = {
    query: vi.fn(function (this: typeof mockDb) {
      return this;
    }),
    withIndex: vi.fn(function (this: typeof mockDb) {
      return this;
    }),
    first: vi.fn(),
    collect: vi.fn(),
    patch: vi.fn(),
    insert: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  };
  return mockDb;
}

/**
 * Creates a mock Convex context with database and auth.
 * Optionally accepts a pre-configured mock database.
 *
 * @param db - Optional pre-configured mock database
 * @returns Mock context object matching Convex runtime context
 */
export function createMockCtx(db?: ReturnType<typeof createMockDb>) {
  const mockDb = db || createMockDb();
  return {
    db: mockDb,
    auth: { getUserIdentity: vi.fn() },
  };
}
