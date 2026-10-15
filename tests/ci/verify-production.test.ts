/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

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
