import { afterEach, describe, expect, it, vi } from 'vitest';

type EnvOverrides = Record<string, string | null | undefined>;

const ORIGINAL_ENV = { ...process.env };

async function loadSentryModule(overrides: EnvOverrides = {}) {
  vi.resetModules();
  resetEnv(overrides);
  const sentryModule = await import('@/lib/sentry');
  resetEnv();
  return sentryModule;
}

function resetEnv(overrides: EnvOverrides = {}) {
  process.env = { ...ORIGINAL_ENV } as NodeJS.ProcessEnv;

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  vi.resetModules();
  resetEnv();
});

describe('sentryOptions', () => {
  it('disables instrumentation when no DSN is configured', async () => {
    const { sentryOptions, isSentryEnabled } = await loadSentryModule({
      SENTRY_DSN: '',
      NEXT_PUBLIC_SENTRY_DSN: '',
    });

    expect(isSentryEnabled).toBe(false);
    expect(sentryOptions.enabled).toBe(false);
  });

  it('enables instrumentation when DSN is present', async () => {
    const { sentryOptions, isSentryEnabled } = await loadSentryModule({
      SENTRY_DSN: 'https://public@sentry.io/123',
    });

    expect(isSentryEnabled).toBe(true);
    expect(sentryOptions.enabled).toBe(true);
  });

  it('scrubs poem text and display names before events are sent', async () => {
    const { sentryOptions } = await loadSentryModule({
      SENTRY_DSN: 'https://public@sentry.io/123',
    });

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

  it('derives release from commit SHA and package version', async () => {
    const { sentryOptions } = await loadSentryModule({
      NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.io/123',
      npm_package_version: '1.2.3',
      npm_package_name: 'linejam',
      VERCEL_GIT_COMMIT_SHA: 'abcdef1234567890',
    });

    expect(sentryOptions.release).toBe('linejam@1.2.3+abcdef1');
  });

  it('prefers explicit SENTRY_RELEASE when provided', async () => {
    const { sentryOptions } = await loadSentryModule({
      NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.io/123',
      SENTRY_RELEASE: 'release-2024-07-01',
      npm_package_version: '1.2.3',
      VERCEL_GIT_COMMIT_SHA: 'abcdef1234567890',
    });

    expect(sentryOptions.release).toBe('release-2024-07-01');
  });

  it('falls back to package version when commit information is missing', async () => {
    const { sentryOptions } = await loadSentryModule({
      NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.io/123',
      npm_package_version: '0.9.0',
      // Clear all commit SHA env vars to isolate test from CI environment
      VERCEL_GIT_COMMIT_SHA: undefined,
      GITHUB_SHA: undefined,
      CF_PAGES_COMMIT_SHA: undefined,
      SOURCE_VERSION: undefined,
      COMMIT_SHA: undefined,
    });

    expect(sentryOptions.release).toBe('linejam@0.9.0+local');
  });
});
