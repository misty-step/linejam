/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

describe('captureCanaryException', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', 'sk_test_canary');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', 'https://canary.test/');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubGlobal('fetch', fetchMock);
  });

  it('logs the reporting failure with the original error and context', async () => {
    const reportingError = new Error('network down');
    fetchMock.mockRejectedValue(reportingError);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { captureCanaryException } = await import('@/lib/canary');
    const originalError = new Error('original boom');
    const context = { route: '/room/ABCD' };

    await captureCanaryException(originalError, context);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Canary capture failed:',
      reportingError,
      {
        originalError,
        context,
      }
    );
  });
});
