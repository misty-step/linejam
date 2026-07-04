import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TIMEOUT_MS,
  readTimeoutMs,
  runHealthCheck,
} from '../../scripts/ops/check-health.mjs';

describe('runHealthCheck', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it('fails when fetch is unavailable', async () => {
    await expect(runHealthCheck({ fetchImpl: null })).rejects.toThrow(
      'fetch is not available'
    );
  });

  it('reports timeout failures distinctly', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn((_url, init) => {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      });

      const check = runHealthCheck({
        url: 'https://www.linejam.app/api/health',
        timeoutMs: 10,
        fetchImpl,
      });
      const expectation = expect(check).rejects.toThrow('timed out after 10ms');
      await vi.advanceTimersByTimeAsync(10);

      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it('passes through non-timeout fetch failures', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(
      runHealthCheck({ url: 'https://www.linejam.app/api/health', fetchImpl })
    ).rejects.toThrow('network down');
  });

  it('handles empty and long failure bodies without leaking huge payloads', async () => {
    const emptyFetch = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 503 }));
    await expect(
      runHealthCheck({
        url: 'https://www.linejam.app/api/health',
        fetchImpl: emptyFetch,
      })
    ).rejects.toThrow('<empty>');

    const longBody = 'x'.repeat(600);
    const longFetch = vi
      .fn()
      .mockResolvedValue(new Response(longBody, { status: 503 }));

    await expect(
      runHealthCheck({
        url: 'https://www.linejam.app/api/health',
        fetchImpl: longFetch,
      })
    ).rejects.toThrow(`${'x'.repeat(500)}...`);
  });

  it.each([
    [undefined, DEFAULT_TIMEOUT_MS],
    ['', DEFAULT_TIMEOUT_MS],
    ['0', DEFAULT_TIMEOUT_MS],
    ['-5', DEFAULT_TIMEOUT_MS],
    ['not-a-number', DEFAULT_TIMEOUT_MS],
    ['12.9', 12],
    ['2500', 2500],
  ])('reads timeout env value %s as %dms', (raw, expected) => {
    if (raw === undefined) {
      vi.stubEnv('LINEJAM_HEALTH_TIMEOUT_MS', undefined);
    } else {
      vi.stubEnv('LINEJAM_HEALTH_TIMEOUT_MS', raw);
    }

    expect(readTimeoutMs()).toBe(expected);
  });
});
