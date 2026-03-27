import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/nextjs';

const fetchMock = vi.fn();

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Mock isSentryEnabled to true so we test the Sentry path
vi.mock('@/lib/sentry', () => ({
  isSentryEnabled: true,
}));

// Import after mocking
import { captureError } from '@/lib/error';

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

  it('calls Sentry.captureException with scrubbed error context', () => {
    // Arrange
    const error = new Error('Test error');
    const context = { roomCode: 'ABCD', userId: '123' };

    // Act
    captureError(error, context);

    // Assert
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      contexts: { custom: { roomCode: 'ABCD' } },
    });
  });

  it('calls Sentry.captureException without context when not provided', () => {
    // Arrange
    const error = new Error('Test error');

    // Act
    captureError(error);

    // Assert
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      contexts: undefined,
    });
  });

  it('logs to console.error in development mode', () => {
    // Arrange
    vi.stubEnv('NODE_ENV', 'development');
    const error = new Error('Dev error');
    const context = { operation: 'test', guestToken: 'secret-token' };

    // Act
    captureError(error, context);

    // Assert
    expect(console.error).toHaveBeenCalledWith('Captured error:', error, {
      operation: 'test',
    });
  });

  it('does not log to console.error in production mode', () => {
    // Arrange
    vi.stubEnv('NODE_ENV', 'production');
    const error = new Error('Prod error');

    // Act
    captureError(error);

    // Assert
    expect(console.error).not.toHaveBeenCalled();
  });

  it('handles string errors', () => {
    // Arrange
    const error = 'String error message';

    // Act
    captureError(error);

    // Assert
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      contexts: undefined,
    });
  });

  it('handles unknown error types', () => {
    // Arrange
    const error = { custom: 'error object' };

    // Act
    captureError(error);

    // Assert
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      contexts: undefined,
    });
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
    };

    expect(body.context).toEqual({ route: '/room/ABCD' });
  });
});

describe('captureError when Sentry disabled', () => {
  it('logs to console and skips Sentry when disabled', async () => {
    vi.resetModules();

    // Mock Sentry disabled
    vi.doMock('@/lib/sentry', () => ({
      isSentryEnabled: false,
    }));

    vi.doMock('@sentry/nextjs', () => ({
      captureException: vi.fn(),
    }));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const testError = new Error('Test error');
    const context = { operation: 'submitLine', userId: 'user_123' };

    const { captureError: captureErrorDisabled } = await import('@/lib/error');
    const SentryMock = await import('@sentry/nextjs');

    captureErrorDisabled(testError, context);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error captured (Sentry disabled):',
      testError,
      { operation: 'submitLine' }
    );
    expect(SentryMock.captureException).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
    vi.resetModules();
  });
});
