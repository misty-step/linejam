/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import { captureServerError } from '@/lib/errorServer';

const fetchMock = vi.fn();

describe('captureServerError', () => {
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
    vi.stubEnv('CANARY_API_KEY', 'sk_server_canary');
    vi.stubEnv('CANARY_ENDPOINT', 'https://canary.test/');
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    const error = new Error('Server canary error');
    const context = { route: '/api/guest/session', userId: 'user_123' };

    captureServerError(error, context);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as {
      context?: Record<string, unknown>;
      message: string;
    };

    expect(body.message).toBe('Server canary error');
    expect(body.context).toEqual({ route: '/api/guest/session' });
  });

  it('logs scrubbed context in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CANARY_API_KEY', 'sk_server_canary');
    vi.stubEnv('CANARY_ENDPOINT', 'https://canary.test/');
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    const error = new Error('Server dev error');
    const context = {
      operation: 'createGuestSession',
      guestToken: 'secret-token',
    };

    captureServerError(error, context);

    expect(console.error).toHaveBeenCalledWith('Captured error:', error, {
      operation: 'createGuestSession',
    });
  });

  it('logs to console when Canary is disabled', () => {
    vi.stubEnv('CANARY_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', '');
    const error = new Error('Server disabled error');
    const context = { operation: 'createGuestSession', userId: 'user_123' };

    captureServerError(error, context);

    expect(console.error).toHaveBeenCalledWith(
      'Error captured (Canary disabled):',
      error,
      { operation: 'createGuestSession' }
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
