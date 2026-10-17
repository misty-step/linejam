import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Event } from '@sentry/nextjs';

const CANARY = 'PRIVATE_CANARY_invitation_guest_token_poem_line';

/** Isolated native collector, reached through workerd's real outbound service. */
export function telemetryCollector() {
  let healthy = false;
  const events: Event[] = [];
  const pending = new Set<() => void>();
  return {
    events,
    recover() {
      healthy = true;
    },
    async receive(request: Request) {
      assert.equal(new URL(request.url).hostname, 'sentry.example.test');
      const envelope = await request.text();
      assert(
        !envelope.includes(CANARY),
        'Privacy canary reached native Sentry transport'
      );
      const rows = envelope.split('\n');
      for (let index = 1; index < rows.length - 1; index += 2) {
        const header = JSON.parse(rows[index]);
        if (header.type !== 'event') continue;
        const event: Event = JSON.parse(rows[index + 1]);
        assert.equal(event.tags?.runtime, 'worker');
        assert.equal(event.environment, 'development');
        assert.equal(event.exception?.values?.[0]?.mechanism?.handled, false);
        assert(!event.request?.headers && !event.request?.data && !event.user);
        events.push(event);
        for (const resolve of pending) resolve();
      }
      return new Response('', { status: healthy ? 200 : 503 });
    },
    next() {
      const previous = events.length;
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(received);
          reject(
            new Error(
              'Native Worker Sentry event did not reach isolated collector'
            )
          );
        }, 10_000);
        const received = () => {
          if (events.length <= previous) return;
          clearTimeout(timer);
          pending.delete(received);
          resolve();
        };
        pending.add(received);
      });
    },
  };
}

export async function verifyWorkerTelemetry(
  origin: URL,
  collector: ReturnType<typeof telemetryCollector>,
  release: string
) {
  for (const recovery of [false, true]) {
    if (recovery) collector.recover();

    // The disposable verifier intentionally omits the DO binding, so the REAL
    // deployed entry throws before forwarding. No production debug route.
    const [response] = await Promise.all([
      fetch(new URL(`/backend/api/query?private=${CANARY}`, origin), {
        method: 'POST',
        headers: { cookie: CANARY, authorization: CANARY },
        body: CANARY,
        signal: AbortSignal.timeout(15_000),
      }),
      collector.next(),
    ]);
    assert.equal(
      response.status,
      500,
      'Missing binding must fail, not masquerade as success'
    );
    const home = await fetch(new URL('/api/deployment', origin), {
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(
      home.status,
      200,
      'Telemetry failure/recovery must not block deployment identity requests'
    );
  }
  assert.equal(collector.events.length, 2);
  for (const event of collector.events) assert.equal(event.release, release);
  mkdirSync('.qa/telemetry', { recursive: true });
  writeFileSync(
    '.qa/telemetry/receipt.json',
    JSON.stringify(
      {
        result: 'PASS',
        runtime: 'workerd',
        ingress: 'loopback_http',
        release,
        environment: 'development',
        nativeWorkerErrors: collector.events.length,
        privacyCanaryAbsent: true,
        sinkFailureAndRecovery: true,
        deploymentIdentityRequestsHealthy: true,
        productionIngestClaimed: false,
      },
      null,
      2
    ) + '\n'
  );
}
