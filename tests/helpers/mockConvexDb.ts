import { vi } from 'vitest';

/**
 * Creates a mock query builder for withIndex callbacks.
 * Calling methods returns this, enabling chained eq() calls.
 */
function createMockQueryBuilder() {
  const builder: { eq: ReturnType<typeof vi.fn> } = {
    eq: vi.fn(function (this: typeof builder) {
      return this;
    }),
  };
  return builder;
}

/**
 * Creates a mock Convex database with chainable query methods.
 * Used for testing Convex mutations and queries without a real database.
 *
 * The withIndex mock calls the provided callback to ensure arrow functions
 * are executed for proper function coverage tracking.
 *
 * @returns Mock database object with spy functions
 */
/**
 * Creates a mock filter query builder for filter callbacks.
 */
function createMockFilterBuilder() {
  const builder: {
    eq: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    field: ReturnType<typeof vi.fn>;
  } = {
    eq: vi.fn(),
    or: vi.fn(),
    field: vi.fn(),
  };
  return builder;
}

export function createMockDb() {
  const mockDb = {
    query: vi.fn(function (this: typeof mockDb) {
      return this;
    }),
    withIndex: vi.fn(function (
      this: typeof mockDb,
      _indexName: string,
      callback?: (q: ReturnType<typeof createMockQueryBuilder>) => unknown
    ) {
      // Call the callback to ensure arrow functions are executed (for coverage)
      if (callback) {
        callback(createMockQueryBuilder());
      }
      return this;
    }),
    filter: vi.fn(function (
      this: typeof mockDb,
      callback?: (q: ReturnType<typeof createMockFilterBuilder>) => unknown
    ) {
      // Call the callback to ensure arrow functions are executed (for coverage)
      if (callback) {
        callback(createMockFilterBuilder());
      }
      return this;
    }),
    order: vi.fn(function (this: typeof mockDb) {
      return this;
    }),
    take: vi.fn(),
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
