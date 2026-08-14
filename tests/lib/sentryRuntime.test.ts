import { describe, expect, it } from 'vitest';
import { getSentryRuntimeOptions } from '@/sentry.runtime.mjs';

describe('Sentry runtime options', () => {
  it('fails closed without a DSN', () => {
    expect(
      getSentryRuntimeOptions({
        NODE_ENV: 'production',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        NEXT_DEPLOYMENT_ID: 'a'.repeat(40),
      })
    ).toMatchObject({
      dsn: undefined,
      enabled: false,
      environment: 'production',
      release: 'a'.repeat(40),
      enableLogs: false,
      sendDefaultPii: false,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      tracesSampleRate: 0.05,
    });
  });

  it('does not authorize production ingestion from DSN presence alone', () => {
    expect(
      getSentryRuntimeOptions({
        NEXT_PUBLIC_SENTRY_DSN: [
          'https://public',
          'sentry.example.test/1',
        ].join('@'),
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
      }).enabled
    ).toBe(false);
  });

  it('samples all preview traces and uses the deployed commit release', () => {
    expect(
      getSentryRuntimeOptions({
        NEXT_PUBLIC_SENTRY_DSN: [
          'https://public',
          'sentry.example.test/1',
        ].join('@'),
        NEXT_PUBLIC_SENTRY_ENABLED: '1',
        LINEJAM_DEPLOY_ENVIRONMENT: 'preview',
        NEXT_DEPLOYMENT_ID: 'b'.repeat(40),
        GITHUB_SHA: 'c'.repeat(40),
      })
    ).toMatchObject({
      enabled: true,
      environment: 'preview',
      release: 'b'.repeat(40),
      tracesSampleRate: 1,
    });
  });

  it('rejects non-commit release values', () => {
    expect(
      getSentryRuntimeOptions({
        NEXT_PUBLIC_SENTRY_DSN: [
          'https://public',
          'sentry.example.test/1',
        ].join('@'),
        LINEJAM_DEPLOY_ENVIRONMENT: 'preview',
        NEXT_DEPLOYMENT_ID: 'preview-room-secret',
      }).release
    ).toBeUndefined();
  });
});
