/** @vitest-environment node */
import { once } from 'node:events';
import { createServer, type RequestListener } from 'node:http';
import type { Socket } from 'node:net';
import { describe, expect, it } from 'vitest';

import { waitForProduction } from '@/scripts/ci/verify-production.mjs';

const EXPECTED = 'a'.repeat(40);
const PREVIOUS = 'b'.repeat(40);
const ready = {
  status: 'ok',
  deployment: { id: EXPECTED },
  convex: 'connected',
  env: { guestTokenParity: true },
};

async function loopback(
  respond: RequestListener,
  check: (
    origin: string,
    requests: string[],
    closed: Set<Socket>
  ) => Promise<void>
) {
  const requests: string[] = [];
  const closed = new Set<Socket>();
  const server = createServer((request, response) => {
    requests.push(request.url ?? '');
    respond(request, response);
  });
  server.on('connection', (socket) => {
    socket.once('close', () => closed.add(socket));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Node returns a TCP address or a pipe name; this fixture requires TCP.
  if (!address || typeof address === 'string')
    throw new Error('No TCP address');
  try {
    await check(`http://127.0.0.1:${address.port}`, requests, closed);
  } finally {
    const stopped = once(server, 'close');
    server.close();
    server.closeAllConnections();
    await stopped;
  }
}

// Fail quickly even against the inherited checker whose body read can hang.
async function watchdog<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Test watchdog expired')),
          1500
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const options = { expectedSha: EXPECTED, attemptTimeoutMs: 100 };

describe('production readiness over real HTTP', () => {
  it('accepts immediate readiness without sleeping', async () => {
    await loopback(
      (_, response) => response.end(JSON.stringify(ready)),
      async (origin, requests) => {
        const pauses: number[] = [];
        await expect(
          waitForProduction({
            ...options,
            origin,
            sleep: async (ms: number) => {
              pauses.push(ms);
            },
          })
        ).resolves.toBe(1);
        expect(requests).toEqual(['/api/health']);
        expect(pauses).toEqual([]);
      }
    );
  });

  it('waits for old-source to new-source propagation', async () => {
    let count = 0;
    await loopback(
      (_, response) => {
        count += 1;
        response.end(
          JSON.stringify({
            ...ready,
            deployment: { id: count < 3 ? PREVIOUS : EXPECTED },
          })
        );
      },
      async (origin, requests) => {
        const pauses: number[] = [];
        await expect(
          waitForProduction({
            ...options,
            origin,
            intervalMs: 5,
            sleep: async (ms: number) => {
              pauses.push(ms);
            },
          })
        ).resolves.toBe(3);
        expect(requests).toEqual(Array(3).fill('/api/health'));
        expect(pauses).toEqual([5, 5]);
      }
    );
  });

  it('decodes BOM-prefixed UTF-8 split across response chunks', async () => {
    const encoded = Buffer.from(
      '\uFEFF' + JSON.stringify({ note: '🌧', ...ready })
    );
    // Split inside the four-byte code point, not at a character boundary.
    const split = encoded.indexOf(Buffer.from('🌧')) + 2;
    await loopback(
      (_, response) => {
        response.write(encoded.subarray(0, split));
        const finish = setTimeout(
          () => response.end(encoded.subarray(split)),
          10
        );
        response.once('close', () => clearTimeout(finish));
      },
      async (origin) => {
        await expect(
          waitForProduction({ ...options, origin, attempts: 1 })
        ).resolves.toBe(1);
      }
    );
  });

  it.each(['no headers', 'incomplete JSON body'])(
    'deadlines %s on every attempt and closes the timed-out sockets',
    async (stall) => {
      await loopback(
        (_, response) => {
          if (stall === 'incomplete JSON body') {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.write('{"status":"ok",');
          }
        },
        async (origin, requests, closed) => {
          const pauses: number[] = [];
          const started = performance.now();
          await expect(
            watchdog(
              waitForProduction({
                ...options,
                origin,
                attempts: 3,
                intervalMs: 5,
                sleep: async (ms: number) => {
                  pauses.push(ms);
                },
              })
            )
          ).rejects.toThrow(
            `Production readiness failed: ${origin} served Error: Production health attempt timed out after 100ms. after 3 attempts.`
          );
          expect(performance.now() - started).toBeLessThan(1200);
          expect(requests).toEqual(Array(3).fill('/api/health'));
          expect(pauses).toEqual([5, 5]);
          // Checked before server cleanup: an abandoned Promise.race is not enough.
          await expect.poll(() => closed.size).toBe(3);
        }
      );
    }
  );

  it('recovers after a timed-out body without accepting the stale attempt', async () => {
    let count = 0;
    await loopback(
      (_, response) => {
        count += 1;
        if (count === 1) response.write('{');
        else response.end(JSON.stringify(ready));
      },
      async (origin, requests, closed) => {
        await expect(
          watchdog(
            waitForProduction({
              ...options,
              origin,
              attempts: 2,
              intervalMs: 1,
            })
          )
        ).resolves.toBe(2);
        expect(requests).toHaveLength(2);
        await expect.poll(() => closed.size).toBe(1);
      }
    );
  });

  it('shares one deadline between headers and the complete body', async () => {
    let finish: ReturnType<typeof setTimeout> | undefined;
    await loopback(
      (_, response) => {
        const headers = setTimeout(() => {
          response.writeHead(200);
          response.write('{');
          finish = setTimeout(() => response.end('}'), 80);
        }, 60);
        response.once('close', () => {
          clearTimeout(headers);
          clearTimeout(finish);
        });
      },
      async (origin, _, closed) => {
        await expect(
          watchdog(
            waitForProduction({
              ...options,
              origin,
              attempts: 1,
            })
          )
        ).rejects.toThrow('attempt timed out after 100ms');
        await expect.poll(() => closed.size).toBe(1);
      }
    );
  });

  it('refuses redirects without contacting their target', async () => {
    await loopback(
      (request, response) => {
        if (request.url === '/api/health') {
          response.writeHead(302, { Location: '/redirected' });
          response.end();
        } else response.end(JSON.stringify(ready));
      },
      async (origin, requests) => {
        await expect(
          waitForProduction({
            ...options,
            origin,
            attempts: 2,
            intervalMs: 1,
          })
        ).rejects.toThrow('after 2 attempts.');
        expect(requests).toEqual(['/api/health', '/api/health']);
      }
    );
  });

  it('fails closed with the final health diagnostic after permanent failure', async () => {
    await loopback(
      (_, response) => {
        response.writeHead(503);
        response.end(JSON.stringify(ready));
      },
      async (origin, requests) => {
        await expect(
          waitForProduction({
            ...options,
            origin,
            attempts: 3,
            intervalMs: 1,
          })
        ).rejects.toThrow(
          `served {"http":503,"status":"ok","deployment":"${EXPECTED}","convex":"connected","guestTokenParity":true} after 3 attempts.`
        );
        expect(requests).toHaveLength(3);
      }
    );
  });
});
