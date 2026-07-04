import { describe, expect, it, vi } from 'vitest';
import { runHealthCheck } from '../../scripts/ops/check-health.mjs';

describe('runHealthCheck', () => {
  it('returns a concise summary when /api/health is ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          convex: 'connected',
          observability: { status: 'ready' },
          timestamp: '2026-07-04T00:00:00.000Z',
        }),
        { status: 200 }
      )
    );

    await expect(
      runHealthCheck({
        url: 'https://www.linejam.app/api/health',
        fetchImpl,
      })
    ).resolves.toEqual({
      ok: true,
      url: 'https://www.linejam.app/api/health',
      httpStatus: 200,
      bodyStatus: 'ok',
      convex: 'connected',
      observabilityStatus: 'ready',
      timestamp: '2026-07-04T00:00:00.000Z',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.linejam.app/api/health',
      expect.objectContaining({
        headers: { accept: 'application/json' },
      })
    );
  });

  it('fails closed on HTTP 503', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'unhealthy' }), { status: 503 })
      );

    await expect(
      runHealthCheck({ url: 'https://www.linejam.app/api/health', fetchImpl })
    ).rejects.toThrow('HTTP 503');
  });

  it('fails when a 200 response carries an unhealthy body', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'unhealthy' }), { status: 200 })
      );

    await expect(
      runHealthCheck({ url: 'https://www.linejam.app/api/health', fetchImpl })
    ).rejects.toThrow('body status "unhealthy"');
  });

  it('fails when the response body is not JSON', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('not json', { status: 200 }));

    await expect(
      runHealthCheck({ url: 'https://www.linejam.app/api/health', fetchImpl })
    ).rejects.toThrow('response was not JSON');
  });
});
