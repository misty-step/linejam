import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit } from '../../convex/lib/rateLimit';
import { createMockDb, createMockCtx } from '../helpers/mockConvexDb';

describe('checkRateLimit', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCtx: any;

  beforeEach(() => {
    mockDb = createMockDb();
    mockCtx = createMockCtx(mockDb);
  });

  it('allows request when no limit exists', async () => {
    mockDb.first.mockResolvedValue(null);

    await checkRateLimit(mockCtx, { key: 'test:1', max: 5, windowMs: 1000 });

    expect(mockDb.insert).toHaveBeenCalledWith(
      'rateLimits',
      expect.objectContaining({
        key: 'test:1',
        hits: 1,
      })
    );
  });

  it('allows request when limit exists and under max', async () => {
    mockDb.first.mockResolvedValue({
      _id: 'limit1',
      key: 'test:1',
      hits: 2,
      resetTime: Date.now() + 10000,
    });

    await checkRateLimit(mockCtx, { key: 'test:1', max: 5, windowMs: 1000 });

    expect(mockDb.patch).toHaveBeenCalledWith('limit1', {
      hits: 3,
    });
  });

  it('throws when limit exceeded within window', async () => {
    mockDb.first.mockResolvedValue({
      _id: 'limit1',
      key: 'test:1',
      hits: 5,
      resetTime: Date.now() + 10000,
    });

    await expect(
      checkRateLimit(mockCtx, { key: 'test:1', max: 5, windowMs: 1000 })
    ).rejects.toThrow('Rate limit exceeded');
  });

  it('resets limit when window expired', async () => {
    mockDb.first.mockResolvedValue({
      _id: 'limit1',
      key: 'test:1',
      hits: 5,
      resetTime: Date.now() - 1000, // Expired
    });

    await checkRateLimit(mockCtx, { key: 'test:1', max: 5, windowMs: 1000 });

    expect(mockDb.patch).toHaveBeenCalledWith(
      'limit1',
      expect.objectContaining({
        hits: 1,
        resetTime: expect.any(Number),
      })
    );
  });

  it('resets when resetTime equals current time (boundary)', async () => {
    const now = Date.now();
    mockDb.first.mockResolvedValue({
      _id: 'limit1',
      key: 'test:1',
      hits: 5,
      resetTime: now, // Exactly at boundary — should reset
    });

    await checkRateLimit(mockCtx, { key: 'test:1', max: 5, windowMs: 1000 });

    expect(mockDb.patch).toHaveBeenCalledWith(
      'limit1',
      expect.objectContaining({
        hits: 1,
      })
    );
  });

  it('allows request at max-1 hits and increments to max', async () => {
    mockDb.first.mockResolvedValue({
      _id: 'limit1',
      key: 'test:1',
      hits: 4,
      resetTime: Date.now() + 10000,
    });

    await checkRateLimit(mockCtx, { key: 'test:1', max: 5, windowMs: 1000 });

    expect(mockDb.patch).toHaveBeenCalledWith('limit1', { hits: 5 });
  });

  it('sets correct resetTime on fresh window', async () => {
    mockDb.first.mockResolvedValue(null);

    const before = Date.now();
    await checkRateLimit(mockCtx, {
      key: 'test:1',
      max: 5,
      windowMs: 60000,
    });
    const after = Date.now();

    const insertCall = mockDb.insert.mock.calls[0];
    const resetTime = insertCall[1].resetTime;
    expect(resetTime).toBeGreaterThanOrEqual(before + 60000);
    expect(resetTime).toBeLessThanOrEqual(after + 60000);
  });
});
