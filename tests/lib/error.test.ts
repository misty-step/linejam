import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureError } from '@/lib/error';

const fetchMock = vi.fn();

describe('captureError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('forwards scrubbed context to Canary when enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', 'sk_test_canary');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', 'https://canary.test/');
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    const error = new Error('Canary error');
    const context = { route: '/room/ABCD', userId: 'user_123' };

    captureError(error, context);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as {
      context?: Record<string, unknown>;
      message: string;
    };

    expect(body.message).toBe('Canary error');
    expect(body.context).toEqual({ route: '/room/ABCD' });
  });

  it('logs scrubbed context in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', 'sk_test_canary');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', 'https://canary.test/');
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    const error = new Error('Dev error');
    const context = { operation: 'test', guestToken: 'secret-token' };

    captureError(error, context);

    expect(console.error).toHaveBeenCalledWith('Captured error:', error, {
      operation: 'test',
    });
  });

  it('does not log to console.error in production when Canary is enabled', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', 'sk_test_canary');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', 'https://canary.test/');
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    captureError(new Error('Prod error'));

    expect(console.error).not.toHaveBeenCalled();
  });

  it('logs to console when Canary is disabled', () => {
    vi.stubEnv('CANARY_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', '');
    const error = new Error('Test error');
    const context = { operation: 'submitLine', userId: 'user_123' };

    captureError(error, context);

    expect(console.error).toHaveBeenCalledWith(
      'Error captured (Canary disabled):',
      error,
      { operation: 'submitLine' }
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs without context when Canary is disabled', () => {
    vi.stubEnv('CANARY_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', '');
    const error = new Error('Context-free error');

    captureError(error);

    expect(console.error).toHaveBeenCalledWith(
      'Error captured (Canary disabled):',
      error
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
