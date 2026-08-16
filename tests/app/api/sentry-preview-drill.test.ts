/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSentryPreviewDrillRoute,
  type SentryPreviewDrillRouteDependencies,
} from '@/app/api/internal/sentry-preview-drill/route';

const url = 'https://preview.linejam.app/api/internal/sentry-preview-drill';

function request(token = 'drill-secret') {
  return new Request(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
}

const captureExceptionMock = vi.fn<
  SentryPreviewDrillRouteDependencies['captureException']
>(() => 'drill-event-id');
const flushMock = vi.fn(async () => true);
const POST = createSentryPreviewDrillRoute({
  captureException: captureExceptionMock,
  flush: flushMock,
});

describe('preview Sentry privacy drill', () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
    flushMock.mockClear();

    vi.stubEnv('LINEJAM_DEPLOY_ENVIRONMENT', 'preview');
    vi.stubEnv(
      'NEXT_PUBLIC_SENTRY_DSN',
      ['https://public', 'sentry.example.test/1'].join('@')
    );
    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENABLED', '1');
    vi.stubEnv('SENTRY_PREVIEW_DRILL_TOKEN', 'drill-secret');
  });

  afterEach(() => {
    captureExceptionMock.mockClear();
    flushMock.mockClear();
    vi.unstubAllEnvs();
  });

  it('is unreachable outside preview', async () => {
    vi.stubEnv('LINEJAM_DEPLOY_ENVIRONMENT', 'production');

    const response = await POST(request());

    expect(response.status).toBe(404);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('stays unreachable when a preview DSN is present but ingest is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENABLED', '0');

    const response = await POST(request());

    expect(response.status).toBe(404);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('does not reveal itself to an unauthorized preview caller', async () => {
    const response = await POST(request('wrong-secret'));

    expect(response.status).toBe(404);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('emits one fixed event for an authorized preview caller', async () => {
    const response = await POST(request());

    expect(response.status).toBe(202);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock.mock.calls[0]?.[0]).toMatchObject({
      name: 'SentryPreviewDrillError',
      message: 'Linejam preview privacy drill',
    });
    expect(flushMock).toHaveBeenCalledWith(2_000);
  });
});
