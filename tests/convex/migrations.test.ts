import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../convex/_generated/server', () => ({
  mutation: (config: { args: unknown; handler: unknown }) => config,
}));

import { backfillMissingGameCycles } from '../../convex/migrations';

describe('backfillMissingGameCycles', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCtx: any;

  beforeEach(() => {
    process.env.ALLOW_CONVEX_MIGRATIONS = 'true';
    mockDb = {
      query: vi.fn(),
      get: vi.fn(),
      patch: vi.fn(),
    };
    mockCtx = { db: mockDb };
  });

  it('patches games without cycles using room.currentCycle when present', async () => {
    const games = [
      { _id: 'g1', roomId: 'r1' },
      { _id: 'g2', roomId: 'r2', cycle: 2 },
    ];
    mockDb.query.mockReturnValue({ collect: vi.fn().mockResolvedValue(games) });
    mockDb.get
      .mockResolvedValueOnce({ currentCycle: 4 })
      .mockResolvedValueOnce(undefined); // Should fall back to 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (backfillMissingGameCycles as any).handler(
      mockCtx,
      {}
    );

    expect(mockDb.patch).toHaveBeenCalledWith('g1', { cycle: 4 });
    expect(result).toEqual({ patched: 1, dryRun: false });
  });

  it('dryRun avoids patching while reporting count', async () => {
    const games = [{ _id: 'g3', roomId: 'r3' }];
    mockDb.query.mockReturnValue({ collect: vi.fn().mockResolvedValue(games) });
    mockDb.get.mockResolvedValue({ currentCycle: 2 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (backfillMissingGameCycles as any).handler(mockCtx, {
      dryRun: true,
    });

    expect(mockDb.patch).not.toHaveBeenCalled();
    expect(result).toEqual({ patched: 1, dryRun: true });
  });
});
