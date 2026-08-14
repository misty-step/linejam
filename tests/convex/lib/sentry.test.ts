/** @vitest-environment node */
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { Mock } from 'vitest';
import {
  rethrowAfterBackendReport,
  returnAfterBackendReportScheduled,
} from '../../../convex/errors';

const ORIGINAL_ENV = { ...process.env };
const RELEASE = '0123456789abcdef0123456789abcdef01234567';
const EVENT_ID = '0123456789abcdef0123456789abcdef';
const backendReport = {
  operation: 'sweepAbandonedGames',
  failureCode: 'unexpected_error',
} as const;

function sentryModule() {
  // Reloading resets the module-local bounded-diagnostic guard between cases.
  return import('../../../convex/lib/sentry');
}

function configureSentry() {
  process.env.LINEJAM_SENTRY_ENABLED = 'true';
  process.env.SENTRY_DSN = ['https://public123', 'sentry.example.test/42'].join(
    '@'
  );
  process.env.SENTRY_ENVIRONMENT = 'preview';
  process.env.SENTRY_RELEASE = RELEASE;
}

function envelopePayload(body: string) {
  const lines = body.split('\n');
  expect(lines).toHaveLength(3);
  return {
    header: JSON.parse(lines[0]),
    item: JSON.parse(lines[1]),
    payload: JSON.parse(lines[2]),
  };
}

describe('closed Convex Sentry transport', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.LINEJAM_SENTRY_ENABLED;
    delete process.env.SENTRY_DSN;
    delete process.env.SENTRY_ENVIRONMENT;
    delete process.env.SENTRY_RELEASE;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('parses only credential-safe HTTPS DSNs and preserves relay path prefixes', async () => {
    const mod = await sentryModule();
    expect(
      mod.parseSentryDsn(
        ['https://public123', 'relay.test/sentry/project/42'].join('@')
      )
    ).toEqual({
      envelopeEndpoint: 'https://relay.test/sentry/project/api/42/envelope/',
      publicKey: 'public123',
      projectId: '42',
    });

    for (const unsafe of [
      undefined,
      '',
      'not a URL',
      ['http://public123', 'relay.test/42'].join('@'),
      ['https://public123:secret', 'relay.test/42'].join('@'),
      ['https://public123', 'relay.test/not-a-project'].join('@'),
      ['https://public123', 'relay.test/42?payload=secret'].join('@'),
      ['https://public%2Fkey', 'relay.test/42'].join('@'),
    ]) {
      expect(mod.parseSentryDsn(unsafe)).toBeNull();
    }
  });

  it('requires exact enablement, environment, and lowercase 40-character release', async () => {
    const mod = await sentryModule();
    expect(mod.readSentryConfig({})).toEqual({
      enabled: false,
      diagnostic: 'missing_enablement',
    });
    expect(mod.readSentryConfig({ LINEJAM_SENTRY_ENABLED: '1' })).toEqual({
      enabled: false,
      diagnostic: 'invalid_enablement',
    });
    expect(mod.readSentryConfig({ LINEJAM_SENTRY_ENABLED: 'false' })).toEqual({
      enabled: false,
      diagnostic: 'disabled',
    });
    expect(
      mod.readSentryConfig({
        LINEJAM_SENTRY_ENABLED: 'true',
        SENTRY_DSN: ['https://public123', 'sentry.example.test/42'].join('@'),
        SENTRY_ENVIRONMENT: 'preview',
        SENTRY_RELEASE: RELEASE.toUpperCase(),
      })
    ).toEqual({ enabled: false, diagnostic: 'invalid_configuration' });

    expect(
      mod.readSentryConfig({
        LINEJAM_SENTRY_ENABLED: 'true',
        SENTRY_DSN: ['https://public123', 'sentry.example.test/42'].join('@'),
        SENTRY_ENVIRONMENT: 'preview',
        SENTRY_RELEASE: RELEASE,
      })
    ).toMatchObject({
      enabled: true,
      config: { environment: 'preview', release: RELEASE, projectId: '42' },
    });
  });

  it('disables missing configuration with one static non-blocking diagnostic', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await sentryModule();

    await expect(
      mod.sendBackendSentryEvent(backendReport)
    ).resolves.toBeUndefined();
    await mod.sendBackendSentryEvent(backendReport);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(
      'Sentry transport disabled: enablement is not configured'
    );
  });

  it('returns a mutation outcome only after report scheduling succeeds', async () => {
    const order: string[] = [];
    const scheduling = Promise.resolve().then(() => {
      order.push('scheduled');
    });

    const outcome = await returnAfterBackendReportScheduled(scheduling, {
      scheduled: 2,
      scanned: 3,
    });
    order.push('returned');

    expect(outcome).toEqual({ scheduled: 2, scanned: 3 });
    expect(order).toEqual(['scheduled', 'returned']);
    await expect(
      returnAfterBackendReportScheduled(
        Promise.reject(new Error('SCHEDULING_FAILURE_SENTINEL')),
        outcome
      )
    ).rejects.toThrow('SCHEDULING_FAILURE_SENTINEL');
  });

  it('rethrows the original action failure after reporting succeeds or fails', async () => {
    const originalFailure = new Error('ORIGINAL_FAILURE_SENTINEL');

    await expect(
      rethrowAfterBackendReport(Promise.resolve(), originalFailure)
    ).rejects.toBe(originalFailure);
    await expect(
      rethrowAfterBackendReport(
        Promise.reject(new Error('REPORTING_FAILURE_SENTINEL')),
        originalFailure
      )
    ).rejects.toBe(originalFailure);
  });

  it('builds a static event with exact closed tags and clamped numeric context', async () => {
    const mod = await sentryModule();
    const body = mod.buildBackendSentryEnvelope(
      {
        ...backendReport,
        scheduled: -4,
        scanned: Number.POSITIVE_INFINITY,
        filled: 2_000_000,
      },
      { environment: 'preview', release: RELEASE },
      EVENT_ID
    );
    expect(body).not.toBeNull();
    const built = envelopePayload(body!);

    expect(built).toEqual({
      header: { event_id: EVENT_ID },
      item: { type: 'event' },
      payload: {
        event_id: EVENT_ID,
        platform: 'javascript',
        level: 'error',
        environment: 'preview',
        release: RELEASE,
        message: 'Convex backend operation failed',
        fingerprint: [
          'linejam-convex-backend-failure',
          'sweepAbandonedGames',
          'unexpected_error',
        ],
        tags: {
          runtime: 'convex',
          environment: 'preview',
          release: RELEASE,
          operation: 'sweepAbandonedGames',
          failure_code: 'unexpected_error',
          level: 'error',
        },
        contexts: {
          linejam: { scheduled: 0, scanned: 0, filled: 1_000_000 },
        },
      },
    });
    expect(Object.keys(built.payload.tags)).toEqual([
      'runtime',
      'environment',
      'release',
      'operation',
      'failure_code',
      'level',
    ]);
  });

  it('excludes every string-bearing sentinel and rejects values outside the closed enums', async () => {
    const mod = await sentryModule();
    const tainted = {
      ...backendReport,
      message: 'MESSAGE_SENTINEL',
      title: 'TITLE_SENTINEL',
      stack: 'STACK_SENTINEL',
      culprit: 'CULPRIT_SENTINEL',
      request: 'REQUEST_SENTINEL',
      user: 'USER_SENTINEL',
      poemId: 'IDENTIFIER_SENTINEL',
      context: 'CONTEXT_SENTINEL',
    };
    const body = mod.buildBackendSentryEnvelope(
      tainted,
      { environment: 'preview', release: RELEASE },
      EVENT_ID
    )!;
    for (const sentinel of [
      'MESSAGE_SENTINEL',
      'TITLE_SENTINEL',
      'STACK_SENTINEL',
      'CULPRIT_SENTINEL',
      'REQUEST_SENTINEL',
      'USER_SENTINEL',
      'IDENTIFIER_SENTINEL',
      'CONTEXT_SENTINEL',
    ]) {
      expect(body).not.toContain(sentinel);
    }
    expect(
      mod.buildBackendSentryEnvelope(
        { ...backendReport, operation: 'arbitraryOperation' } as never,
        { environment: 'preview', release: RELEASE },
        EVENT_ID
      )
    ).toBeNull();
  });

  it('builds one aggregate fallback monitor check-in from the threshold status', async () => {
    const mod = await sentryModule();
    const body = mod.buildAiFallbackSentryEnvelope(
      {
        operation: 'aiFallbackRate',
        status: 'error',
        failureCode: 'provider_error',
        totalGenerations: 50,
        fallbackGenerations: 20,
        fallbackRatePercent: 40,
        thresholdPercent: 20,
      },
      { environment: 'preview', release: RELEASE },
      EVENT_ID
    )!;
    const built = envelopePayload(body);
    expect(built.item).toEqual({ type: 'check_in' });
    expect(built.payload).toMatchObject({
      check_in_id: EVENT_ID,
      monitor_slug: 'linejam-ai-fallback-rate',
      status: 'error',
      environment: 'preview',
      release: RELEASE,
    });
    expect(JSON.stringify(built.payload)).not.toContain('totalGenerations');
  });

  it('builds one closed tagged issue event only for a fallback threshold breach', async () => {
    const mod = await sentryModule();
    const report = {
      operation: 'aiFallbackRate',
      status: 'error',
      failureCode: 'provider_error',
      totalGenerations: 50,
      fallbackGenerations: 20,
      fallbackRatePercent: 40.9,
      thresholdPercent: 20,
    } as const;
    const body = mod.buildAiFallbackFailureSentryEnvelope(
      report,
      { environment: 'preview', release: RELEASE },
      EVENT_ID
    )!;
    const built = envelopePayload(body);

    expect(built.item).toEqual({ type: 'event' });
    expect(built.payload).toEqual({
      event_id: EVENT_ID,
      platform: 'javascript',
      level: 'error',
      environment: 'preview',
      release: RELEASE,
      message: 'Convex backend operation failed',
      fingerprint: [
        'linejam-convex-backend-failure',
        'aiFallbackRate',
        'provider_error',
      ],
      tags: {
        runtime: 'convex',
        environment: 'preview',
        release: RELEASE,
        operation: 'aiFallbackRate',
        failure_code: 'provider_error',
        level: 'error',
      },
      contexts: {
        linejam: { observed: 40, threshold: 20 },
      },
    });
    expect(
      mod.buildAiFallbackFailureSentryEnvelope(
        { ...report, status: 'ok' },
        { environment: 'preview', release: RELEASE },
        EVENT_ID
      )
    ).toBeNull();
  });

  describe('reporting failures and retries', () => {
    let fetchMock: Mock;

    beforeEach(() => {
      configureSentry();
      fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
    });

    it('retries a 5xx with the same generated event ID and envelope', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true, status: 200 });
      const mod = await sentryModule();
      await mod.sendBackendSentryEvent(backendReport);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][1].body).toBe(
        fetchMock.mock.calls[1][1].body
      );
      const first = envelopePayload(fetchMock.mock.calls[0][1].body);
      expect(first.header.event_id).toBe(first.payload.event_id);
    });

    it('retries a network failure and remains non-blocking when both attempts fail', async () => {
      fetchMock.mockRejectedValue(new Error('NETWORK_SENTINEL'));
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mod = await sentryModule();

      await expect(
        mod.sendBackendSentryEvent(backendReport)
      ).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(error).toHaveBeenCalledWith('Sentry transport failed');
      expect(JSON.stringify(error.mock.calls)).not.toContain(
        'NETWORK_SENTINEL'
      );
    });

    it('does not retry a reporting 4xx', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 400 });
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const mod = await sentryModule();
      await mod.sendBackendSentryEvent(backendReport);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
