import { describe, expect, it, vi } from 'vitest';
import {
  planSentryReport,
  reportSentryWorkflow,
  sanitizePreviewSmokeEvent,
  SENTRY_MONITOR_SLUGS,
} from '@/scripts/ops/report-sentry-check-in.mjs';

const RELEASE = 'a'.repeat(40);
const RUNTIME_OPTIONS = {
  enabled: true,
  dsn: ['https://public', 'sentry.example.test/1'].join('@'),
  environment: 'preview',
  release: RELEASE,
  sendDefaultPii: false,
  enableLogs: false,
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
};

function sentrySdk() {
  return {
    init: vi.fn(),
    captureCheckIn: vi.fn(() => 'check-in-id'),
    captureException: vi.fn(() => 'event-id'),
    flush: vi.fn(async () => true),
  };
}

describe('Sentry workflow reporting', () => {
  it('keeps the first production smoke failure below the incident threshold', () => {
    expect(
      planSentryReport({
        monitorSlug: SENTRY_MONITOR_SLUGS.productionSmoke,
        outcome: 'failure',
        consecutiveFailures: 1,
      })
    ).toEqual({
      kind: 'check_in',
      monitorSlug: SENTRY_MONITOR_SLUGS.productionSmoke,
      status: 'ok',
    });
  });

  it('reports the second production smoke failure with the real schedule', async () => {
    const sdk = sentrySdk();

    await reportSentryWorkflow({
      monitorSlug: SENTRY_MONITOR_SLUGS.productionSmoke,
      outcome: 'failure',
      consecutiveFailures: 2,
      sdk,
      runtimeOptions: RUNTIME_OPTIONS,
    });

    expect(sdk.captureCheckIn).toHaveBeenCalledWith(
      {
        kind: 'check_in',
        monitorSlug: SENTRY_MONITOR_SLUGS.productionSmoke,
        status: 'error',
      },
      {
        schedule: { type: 'crontab', value: '17 * * * *' },
        checkinMargin: 5,
        maxRuntime: 15,
        timezone: 'UTC',
      }
    );
    expect(sdk.captureException).not.toHaveBeenCalled();
    expect(sdk.flush).toHaveBeenCalledWith(5_000);
  });

  it('does not invent a monitor record for a successful event-driven preview', async () => {
    const sdk = sentrySdk();

    const result = await reportSentryWorkflow({
      monitorSlug: SENTRY_MONITOR_SLUGS.previewSmoke,
      outcome: 'success',
      sdk,
      runtimeOptions: RUNTIME_OPTIONS,
    });

    expect(result).toMatchObject({ kind: 'event', skipped: true });
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.captureCheckIn).not.toHaveBeenCalled();
    expect(sdk.captureException).not.toHaveBeenCalled();
  });

  it('turns a failed event-driven preview into a closed-tag Sentry issue', async () => {
    const sdk = sentrySdk();

    const result = await reportSentryWorkflow({
      monitorSlug: SENTRY_MONITOR_SLUGS.previewSmoke,
      outcome: 'failure',
      sdk,
      runtimeOptions: RUNTIME_OPTIONS,
    });

    expect(result).toMatchObject({ kind: 'event', eventId: 'event-id' });
    expect(sdk.init).toHaveBeenCalledWith(
      expect.objectContaining({ beforeSend: sanitizePreviewSmokeEvent })
    );
    expect(sdk.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Linejam preview smoke failed' }),
      {
        fingerprint: ['linejam-preview-smoke'],
        tags: {
          runtime: 'github-actions',
          operation: 'previewSmoke',
          failure_code: 'unexpected_error',
        },
      }
    );
    expect(sdk.captureCheckIn).not.toHaveBeenCalled();

    const filtered = sanitizePreviewSmokeEvent({
      event_id: 'b'.repeat(32),
      timestamp: 123,
      platform: 'node',
      level: 'error',
      environment: 'preview',
      release: RELEASE,
      server_name: 'PROHIBITED_HOST',
      modules: { prohibited: '1.0.0' },
      contexts: { runtime: { name: 'PROHIBITED_RUNTIME' } },
      breadcrumbs: [{ message: 'PROHIBITED_BREADCRUMB' }],
      extra: { output: 'PROHIBITED_OUTPUT' },
      tags: {
        runtime: 'github-actions',
        operation: 'previewSmoke',
        failure_code: 'unexpected_error',
        forbidden: 'PROHIBITED_TAG',
      },
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Linejam preview smoke failed',
            stacktrace: {
              frames: [
                {
                  filename: '/home/runner/work/private.mjs',
                  vars: { secret: 'PROHIBITED_FRAME_VALUE' },
                },
              ],
            },
          },
        ],
      },
    });
    expect(filtered).toEqual({
      event_id: 'b'.repeat(32),
      timestamp: 123,
      platform: 'node',
      level: 'error',
      environment: 'preview',
      release: RELEASE,
      fingerprint: ['linejam-preview-smoke'],
      tags: {
        runtime: 'github-actions',
        operation: 'previewSmoke',
        failure_code: 'unexpected_error',
      },
      exception: {
        values: [{ type: 'Error', value: 'Linejam preview smoke failed' }],
      },
    });
    expect(JSON.stringify(filtered)).not.toContain('PROHIBITED');
  });

  it('rejects an unconfigured workflow slug', () => {
    expect(() =>
      planSentryReport({ monitorSlug: 'invented', outcome: 'failure' })
    ).toThrow('Unsupported Sentry monitor slug');
  });

  it('fails when an enabled report cannot flush', async () => {
    const sdk = sentrySdk();
    sdk.flush.mockResolvedValue(false);

    await expect(
      reportSentryWorkflow({
        monitorSlug: SENTRY_MONITOR_SLUGS.previewSmoke,
        outcome: 'failure',
        sdk,
        runtimeOptions: RUNTIME_OPTIONS,
      })
    ).rejects.toThrow('Sentry workflow report flush did not complete');
  });
});
