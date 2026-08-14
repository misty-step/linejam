/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { captureExceptionMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@sentry/nextjs', () => ({
  captureException: captureExceptionMock,
}));

import { captureServerError } from '@/lib/errorServer';

describe('captureServerError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      'NEXT_PUBLIC_SENTRY_DSN',
      ['https://public', 'sentry.example.test/1'].join('@')
    );
    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENABLED', '1');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reports a handled server failure with only closed context', () => {
    const error = new Error('private request body');

    captureServerError(error, {
      operation: 'createGuestSession',
      statusCode: 500,
      userId: 'user_123',
      requestBody: 'private prompt',
    });

    expect(captureExceptionMock).toHaveBeenCalledWith(error, {
      tags: { operation: 'createGuestSession' },
      contexts: { linejam: { statusCode: 500 } },
    });
    expect(JSON.stringify(captureExceptionMock.mock.calls)).not.toContain(
      'private prompt'
    );
  });

  it('does not enqueue an SDK event when the DSN is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');

    captureServerError(new Error('disabled'));

    expect(captureExceptionMock).not.toHaveBeenCalled();
  });
});
