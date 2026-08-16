import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import { captureError, setErrorReporterForTests } from '@/lib/error';
import { captureReportedError, isSentryEnabled } from '@/lib/errorCore';
import { sanitizeSentryReporterContext } from '@/lib/sentryPrivacy';

const captureExceptionMock = vi.fn();
describe('captureError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      'NEXT_PUBLIC_SENTRY_DSN',
      ['https://public', 'sentry.example.test/1'].join('@')
    );
    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENABLED', '1');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setErrorReporterForTests({
      captureException: captureExceptionMock,
      isEnabled: isSentryEnabled,
      sanitizeContext: sanitizeSentryReporterContext,
    });
  });

  afterEach(() => {
    setErrorReporterForTests(null);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('forwards only closed Sentry context', () => {
    const error = new Error('backend response containing a private poem');

    captureError(error, {
      operation: 'finishAbandonedGame',
      attempt: 2,
      roomCode: 'ABCD',
      poemId: 'poem_123',
      userId: 'user_123',
      requestBody: 'private poem draft',
    });

    expect(captureExceptionMock).toHaveBeenCalledWith(error, {
      tags: { operation: 'finishAbandonedGame' },
      contexts: { linejam: { attempt: 2 } },
    });
    expect(JSON.stringify(captureExceptionMock.mock.calls)).not.toContain(
      'private poem draft'
    );
    expect(JSON.stringify(captureExceptionMock.mock.calls)).not.toContain(
      'poem_123'
    );
  });

  it('does not report expected Convex rate-limit rejections', () => {
    const error = new ConvexError(
      'Rate limit exceeded. Please try again later.'
    );
    error.message = '[Request ID: prod123] Server Error';

    captureError(error, { operation: 'finishAbandonedGame' });

    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('still reports unexpected Convex failures', () => {
    const error = new ConvexError('Unexpected storage failure');
    error.message = '[Request ID: prod456] Server Error';

    captureError(error, { operation: 'finishAbandonedGame' });

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });

  it('does not enqueue an SDK event when the DSN is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    const error = new Error('private disabled error');

    captureError(error, {
      operation: 'finishAbandonedGame',
      roomCode: 'ABCD',
    });

    expect(captureExceptionMock).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      'Error captured (Sentry disabled):',
      error,
      { tags: { operation: 'finishAbandonedGame' } }
    );
  });

  it('does not enqueue an SDK event when ingest is not explicitly enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENABLED', '0');

    captureError(new Error('disabled despite DSN'), {
      operation: 'finishAbandonedGame',
    });

    expect(captureExceptionMock).not.toHaveBeenCalled();
  });
});

describe('captureReportedError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the reporter seam without waiting for transport', () => {
    const captureException = vi.fn();
    const context = { tags: { operation: 'renderRoomPanel' } };

    captureReportedError(
      {
        captureException,
        isEnabled: () => true,
        sanitizeContext: () => context,
      },
      new Error('render failed'),
      { roomCode: 'ABCD' }
    );

    expect(captureException).toHaveBeenCalledWith(expect.any(Error), context);
  });
});
