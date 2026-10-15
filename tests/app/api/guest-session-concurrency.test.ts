/** @vitest-environment node */
import { AsyncLocalStorage } from 'node:async_hooks';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/guest/session/handler';
import { verifyGuestTokenPayload } from '@/lib/guestToken';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const success = () => Response.json({ status: 'success', value: { ok: true } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('guest-session request ownership with the real Convex HTTP client', () => {
  it.each([200, 503])(
    'does not queue another request behind a held mutation (first upstream status %i)',
    async (firstStatus) => {
      vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', 'https://concurrency.convex.cloud');
      vi.stubEnv('GUEST_TOKEN_SECRET', 'request-isolation-test-secret');
      vi.stubEnv('LINEJAM_LOCAL', '0');
      vi.stubEnv('NEXT_PUBLIC_LINEJAM_LOCAL', '0');
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const owner = new AsyncLocalStorage<string>();
      const first = deferred<Response>();
      const second = deferred<Response>();
      const calls: Array<{ owner: string | undefined; url: string }> = [];
      // Replace only transport: the production handler, proof, SDK mutation
      // queue, token signing and response/cookie creation all run unchanged.
      vi.stubGlobal('fetch', (url: string) => {
        calls.push({ owner: owner.getStore(), url });
        return calls.length === 1 ? first.promise : second.promise;
      });
      const request = () =>
        new NextRequest('https://linejam.example/api/guest/session');
      const firstRequest = owner.run('first', () => GET(request()));
      let secondRequest: ReturnType<typeof GET> | undefined;
      try {
        await vi.waitFor(() => expect(calls).toHaveLength(1));
        secondRequest = owner.run('second', () => GET(request()));
        // Both fetches must start while the first is held. A shared SDK queue
        // instead starts the second fetch in the first request's context.
        await vi.waitFor(() => expect(calls).toHaveLength(2));
        expect(calls).toEqual([
          {
            owner: 'first',
            url: 'https://concurrency.convex.cloud/api/mutation',
          },
          {
            owner: 'second',
            url: 'https://concurrency.convex.cloud/api/mutation',
          },
        ]);
        first.resolve(
          firstStatus === 200
            ? success()
            : new Response('Unavailable', { status: firstStatus })
        );
        expect((await firstRequest).status).toBe(
          firstStatus === 200 ? 200 : 500
        );
        // The first request is now finished; its lifetime cannot own the
        // second's still-pending I/O.
        second.resolve(success());
        const response = await secondRequest;
        expect(response.status).toBe(200);
        const cookie = response.cookies.get('linejam_guest_token');
        if (!cookie)
          throw new Error('Successful guest response must set a cookie');
        const payload = await verifyGuestTokenPayload(cookie.value);
        expect(payload.sessionId).toBeTruthy();
        expect(payload.rateLimitKey).toMatch(/^guestSession:/);
      } finally {
        first.resolve(success());
        second.resolve(success());
        await Promise.all([firstRequest, secondRequest]);
      }
    }
  );
});
