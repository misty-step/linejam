import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

/**
 * Tests grouped by env configuration to minimize module reloads.
 * Release tests each need different env at module load time, so they
 * use individual loads, but we avoid the afterEach reset overhead.
 */

describe('sentryOptions', () => {
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('without DSN', () => {
    let sentryOptions: typeof import('@/lib/sentry').sentryOptions;
    let isSentryEnabled: typeof import('@/lib/sentry').isSentryEnabled;

    beforeAll(async () => {
      vi.resetModules();
      process.env = { ...ORIGINAL_ENV };
      process.env.SENTRY_DSN = '';
      process.env.NEXT_PUBLIC_SENTRY_DSN = '';

      const mod = await import('@/lib/sentry');
      sentryOptions = mod.sentryOptions;
      isSentryEnabled = mod.isSentryEnabled;

      process.env = ORIGINAL_ENV;
    });

    it('disables instrumentation when no DSN is configured', () => {
      expect(isSentryEnabled).toBe(false);
      expect(sentryOptions.enabled).toBe(false);
    });
  });

  describe('with DSN', () => {
    let sentryOptions: typeof import('@/lib/sentry').sentryOptions;
    let isSentryEnabled: typeof import('@/lib/sentry').isSentryEnabled;

    beforeAll(async () => {
      vi.resetModules();
      process.env = { ...ORIGINAL_ENV };
      process.env.SENTRY_DSN = 'https://public@sentry.io/123';

      const mod = await import('@/lib/sentry');
      sentryOptions = mod.sentryOptions;
      isSentryEnabled = mod.isSentryEnabled;

      process.env = ORIGINAL_ENV;
    });

    it('enables instrumentation when DSN is present', () => {
      expect(isSentryEnabled).toBe(true);
      expect(sentryOptions.enabled).toBe(true);
    });

    it('scrubs poem text and display names before events are sent', () => {
      type SentryEvent = Parameters<typeof sentryOptions.beforeSend>[0];

      const event = {
        contexts: {
          poem: { text: 'secret line', safe: 'keep' },
          user: { displayName: 'Ada', id: 'user_1' },
        },
        user: { displayName: 'Ada Lovelace', id: 'user_2' },
        extra: { lineText: 'should remove', meta: 'keep me' },
        request: {
          data: { text: 'payload body', hint: 'persist' },
          headers: { displayName: 'hidden', 'x-forwarded-for': '127.0.0.1' },
        },
        breadcrumbs: [{ data: { content: 'hide me', detail: 'keep me' } }],
      } as unknown as SentryEvent;

      const scrubbed = sentryOptions.beforeSend(event);
      expect(scrubbed).toBeTruthy();

      const sanitized = scrubbed!;
      const requestData = sanitized.request?.data as
        | Record<string, unknown>
        | undefined;

      expect(sanitized.contexts?.poem?.text).toBeUndefined();
      expect(sanitized.contexts?.poem?.safe).toBe('keep');
      expect(sanitized.contexts?.user?.displayName).toBeUndefined();
      expect(sanitized.contexts?.user?.id).toBe('user_1');
      expect(sanitized.user?.displayName).toBeUndefined();
      expect(sanitized.extra?.lineText).toBeUndefined();
      expect(sanitized.extra?.meta).toBe('keep me');
      expect(requestData?.text).toBeUndefined();
      expect(requestData?.hint).toBe('persist');
      expect(sanitized.request?.headers?.displayName).toBeUndefined();
      expect(sanitized.breadcrumbs?.[0]?.data?.content).toBeUndefined();
      expect(sanitized.breadcrumbs?.[0]?.data?.detail).toBe('keep me');
    });
  });

  describe('release derivation', () => {
    // Each test needs different env at module load time
    it('derives release from commit SHA and package version', async () => {
      vi.resetModules();
      process.env = { ...ORIGINAL_ENV };
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://public@sentry.io/123';
      process.env.npm_package_version = '1.2.3';
      process.env.npm_package_name = 'linejam';
      process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890';

      const { sentryOptions } = await import('@/lib/sentry');
      process.env = ORIGINAL_ENV;

      expect(sentryOptions.release).toBe('linejam@1.2.3+abcdef1');
    });

    it('prefers explicit SENTRY_RELEASE when provided', async () => {
      vi.resetModules();
      process.env = { ...ORIGINAL_ENV };
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://public@sentry.io/123';
      process.env.SENTRY_RELEASE = 'release-2024-07-01';
      process.env.npm_package_version = '1.2.3';
      process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890';

      const { sentryOptions } = await import('@/lib/sentry');
      process.env = ORIGINAL_ENV;

      expect(sentryOptions.release).toBe('release-2024-07-01');
    });

    it('falls back to package version when commit information is missing', async () => {
      vi.resetModules();
      process.env = { ...ORIGINAL_ENV };
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://public@sentry.io/123';
      process.env.npm_package_version = '0.9.0';
      // Clear all commit SHA env vars to isolate test from CI environment
      delete process.env.VERCEL_GIT_COMMIT_SHA;
      delete process.env.GITHUB_SHA;
      delete process.env.CF_PAGES_COMMIT_SHA;
      delete process.env.SOURCE_VERSION;
      delete process.env.COMMIT_SHA;

      const { sentryOptions } = await import('@/lib/sentry');
      process.env = ORIGINAL_ENV;

      expect(sentryOptions.release).toBe('linejam@0.9.0+local');
    });
  });
});
