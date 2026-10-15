/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

import { waitForProduction } from '@/scripts/ci/verify-production.mjs';

const EXPECTED = 'a'.repeat(40);
const PREVIOUS = 'b'.repeat(40);

type HealthBody = {
  status?: string;
  deployment?: { id: string };
  convex?: string;
  env?: { guestTokenParity: boolean };
};

const ready: HealthBody = {
  status: 'ok',
  deployment: { id: EXPECTED },
  convex: 'connected',
  env: { guestTokenParity: true },
};

// Production answers in order; the last answer repeats.
function production(...answers: (Response | Error)[]) {
  const urls: string[] = [];
  const pauses: number[] = [];
  return {
    urls,
    pauses,
    fetchHealth: async (url: string) => {
      urls.push(url);
      const answer = answers[Math.min(urls.length, answers.length) - 1];
      if (answer instanceof Response) return answer.clone();
      throw answer;
    },
    sleep: async (ms: number) => {
      pauses.push(ms);
    },
  };
}

const health = (body: HealthBody, status = 200) =>
  new Response(JSON.stringify(body), { status });
const previous = health({ ...ready, deployment: { id: PREVIOUS } });

describe('production readiness after a Cloudflare deploy', () => {
  it('preserves the default 24 attempts and 23 five-second sleeps', async () => {
    const served = production(previous);
    await expect(
      waitForProduction({ expectedSha: EXPECTED, ...served })
    ).rejects.toThrow('after 24 attempts.');
    expect(served.urls).toHaveLength(24);
    expect(served.pauses).toEqual(Array(23).fill(5000));
  });

  it('bounds default stalled attempts and retry sleeps to 595 seconds', async () => {
    vi.useFakeTimers();
    try {
      const signals: AbortSignal[] = [];
      const started = Date.now();
      const work = waitForProduction({
        expectedSha: EXPECTED,
        fetchHealth: (_url: string, options: RequestInit) => {
          if (options.signal) signals.push(options.signal);
          return new Promise<Response>(() => {});
        },
      });
      const failure = expect(work).rejects.toThrow(
        'attempt timed out after 20000ms. after 24 attempts.'
      );
      await vi.advanceTimersByTimeAsync(595000);
      await failure;
      expect(Date.now() - started).toBe(595000);
      expect(signals).toHaveLength(24);
      expect(signals.every((signal) => signal.aborted)).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(['ready', 'invalid JSON', 'network failure'])(
    'clears its deadline timer after %s',
    async (outcome) => {
      vi.useFakeTimers();
      try {
        const served = production(
          outcome === 'ready'
            ? health(ready)
            : outcome === 'invalid JSON'
              ? new Response('{')
              : new Error('offline')
        );
        const work = waitForProduction({
          expectedSha: EXPECTED,
          attempts: 1,
          ...served,
        });
        if (outcome === 'ready') await expect(work).resolves.toBe(1);
        else await expect(work).rejects.toThrow('Production readiness failed');
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    }
  );

  it('bounds an injected fetch that ignores cancellation and clears its timer', async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | null | undefined;
      const work = waitForProduction({
        expectedSha: EXPECTED,
        attempts: 1,
        attemptTimeoutMs: 50,
        fetchHealth: (_url: string, options: RequestInit) => {
          signal = options.signal;
          expect(options.redirect).toBe('error');
          return new Promise<Response>(() => {});
        },
      });
      const failure = expect(work).rejects.toThrow(
        'attempt timed out after 50ms'
      );
      await vi.advanceTimersByTimeAsync(50);
      await failure;
      expect(signal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels and releases the body reader even if fetch ignores abort', async () => {
    let cancelled: Error | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{'));
      },
      cancel(reason: Error) {
        cancelled = reason;
      },
    });
    await expect(
      waitForProduction({
        expectedSha: EXPECTED,
        attempts: 1,
        attemptTimeoutMs: 5,
        fetchHealth: async () => new Response(body),
      })
    ).rejects.toThrow('attempt timed out after 5ms');
    expect(cancelled?.message).toBe(
      'Production health attempt timed out after 5ms.'
    );
    expect(body.locked).toBe(false);
  });

  it('discards and cancels a response arriving after its attempt timed out', async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
    });
    let finish: (response: Response) => void = () => {};
    const late = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    await expect(
      waitForProduction({
        expectedSha: EXPECTED,
        attempts: 1,
        attemptTimeoutMs: 5,
        fetchHealth: () => late,
      })
    ).rejects.toThrow('attempt timed out after 5ms');
    finish(new Response(body));
    await expect.poll(() => cancelled).toBe(true);
    expect(body.locked).toBe(false);
  });

  it('waits for the new source to reach the edge', async () => {
    const served = production(previous, previous, health(ready));
    await expect(
      waitForProduction({ expectedSha: EXPECTED, intervalMs: 5, ...served })
    ).resolves.toBe(3);
    expect(served.urls).toEqual(
      Array(3).fill('https://linejam.mistystep.io/api/health')
    );
    expect(served.pauses).toEqual([5, 5]);
  });

  it('fails with what production served when the source never arrives', async () => {
    const served = production(previous);
    await expect(
      waitForProduction({ expectedSha: EXPECTED, attempts: 3, ...served })
    ).rejects.toThrow(
      `Production readiness failed: https://linejam.mistystep.io served {"http":200,"status":"ok","deployment":"${PREVIOUS}","convex":"connected","guestTokenParity":true} after 3 attempts.`
    );
    expect(served.pauses).toHaveLength(2);
  });

  it.each([
    [
      'Convex is disconnected',
      { convex: 'disconnected' },
      '"convex":"disconnected"',
    ],
    [
      'guest secrets differ',
      { env: { guestTokenParity: false } },
      '"guestTokenParity":false',
    ],
    ['health is degraded', { status: 'degraded' }, '"status":"degraded"'],
  ])(
    'requires full readiness on the new source when %s',
    async (_: string, change: HealthBody, reported: string) => {
      const served = production(health({ ...ready, ...change }));
      await expect(
        waitForProduction({ expectedSha: EXPECTED, attempts: 2, ...served })
      ).rejects.toThrow(reported);
    }
  );

  it('rejects an unhealthy HTTP status even with a ready body', async () => {
    const served = production(health(ready, 503));
    await expect(
      waitForProduction({ expectedSha: EXPECTED, attempts: 1, ...served })
    ).rejects.toThrow('"http":503');
    expect(served.pauses).toEqual([]);
  });

  it('retries network failures and non-JSON pages', async () => {
    const served = production(
      new Error('fetch failed'),
      new Response('<html>Bad gateway</html>', { status: 502 }),
      health(ready)
    );
    await expect(
      waitForProduction({ expectedSha: EXPECTED, ...served })
    ).resolves.toBe(3);
  });

  it('reports the last failure when no attempt is ready', async () => {
    await expect(
      waitForProduction({
        expectedSha: EXPECTED,
        attempts: 2,
        ...production(new Error('socket hang up')),
      })
    ).rejects.toThrow('served Error: socket hang up after 2 attempts.');
    await expect(
      waitForProduction({
        expectedSha: EXPECTED,
        attempts: 1,
        ...production(health({})),
      })
    ).rejects.toThrow('served {"http":200} after 1 attempts.');
  });
});
