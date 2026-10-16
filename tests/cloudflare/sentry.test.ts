import { describe, expect, it } from 'vitest';
import { workerSentryOptions } from '@/cloudflare/sentry';

const release = 'a'.repeat(40);
const dsn = 'https://public-key@sentry.example.test/1';

describe('native Worker Sentry configuration', () => {
  it('reuses train release and closed privacy transport, without tracing or identity capture', () => {
    const options = workerSentryOptions({
      NEXT_PUBLIC_SENTRY_DSN: dsn,
      NEXT_PUBLIC_SENTRY_ENABLED: '1',
      LINEJAM_DEPLOY_ENVIRONMENT: 'production',
      NEXT_DEPLOYMENT_ID: release,
    });
    expect(options).toMatchObject({
      enabled: true,
      dsn,
      environment: 'production',
      release,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      maxBreadcrumbs: 0,
      initialScope: { tags: { runtime: 'worker' } },
    });
    expect(
      options.integrations([{ name: 'HttpServer' }, { name: 'Dedupe' }])
    ).toEqual([{ name: 'Dedupe' }]);
    const serialized = JSON.stringify(
      options.beforeSend(
        {
          type: undefined,
          event_id: 'b'.repeat(32),
          message: 'PRIVATE_CANARY',
          exception: {
            values: [
              {
                type: 'Error',
                value: 'PRIVATE_CANARY',
                mechanism: { type: 'auto.http.cloudflare', handled: false },
              },
            ],
          },
          tags: { runtime: 'worker', private: 'PRIVATE_CANARY' },
          request: {
            url: 'https://example.test/backend/api/mutation?token=PRIVATE_CANARY',
            data: 'PRIVATE_CANARY',
            headers: { cookie: 'PRIVATE_CANARY' },
          },
          user: { email: 'PRIVATE_CANARY' },
        },
        {}
      )
    );
    expect(serialized).not.toContain('PRIVATE_CANARY');
    expect(serialized).toContain('worker');
  });

  it('leaves local or unconfigured Workers silent', () => {
    expect(workerSentryOptions({}).enabled).toBe(false);
    expect(
      workerSentryOptions({
        NEXT_PUBLIC_LINEJAM_LOCAL: '1',
        NEXT_PUBLIC_SENTRY_DSN: dsn,
        NEXT_PUBLIC_SENTRY_ENABLED: '1',
      }).enabled
    ).toBe(false);
  });
});
