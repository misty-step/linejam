import * as Sentry from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Each entrypoint calls the real SDK; the resulting client's options are the
// proof. Nothing is captured, so no transport is exercised.
const ENTRYPOINTS = [
  ['server', () => import('@/sentry.server.config')],
  ['edge', () => import('@/sentry.edge.config')],
  ['browser', () => import('@/instrumentation-client')],
] as const;

async function resetSentryClient() {
  await Sentry.getClient()?.close(0);
  Sentry.getCurrentScope().setClient(undefined);
  Sentry.getIsolationScope().setClient(undefined);
  Sentry.getGlobalScope().setClient(undefined);
}

describe.each(ENTRYPOINTS)('Sentry %s init', (_, load) => {
  beforeEach(async () => {
    vi.resetModules();
    await resetSentryClient();
    vi.stubEnv(
      'NEXT_PUBLIC_SENTRY_DSN',
      ['https://public', 'sentry.example.test/1'].join('@')
    );
    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENABLED', '1');
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await resetSentryClient();
  });

  it('is disabled under NODE_ENV=test', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENVIRONMENT', 'production');

    await load();

    expect(Sentry.getClient()?.getOptions().enabled).toBe(false);
  });

  it('is disabled for CI and Playwright test builds', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENVIRONMENT', 'test');

    await load();

    expect(Sentry.getClient()?.getOptions()).toMatchObject({
      enabled: false,
      environment: 'test',
    });
  });

  it('stays enabled for production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENVIRONMENT', 'production');

    await load();

    expect(Sentry.getClient()?.getOptions()).toMatchObject({
      enabled: true,
      environment: 'production',
    });
  });
});
