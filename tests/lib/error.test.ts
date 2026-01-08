import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/nextjs';

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
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('calls Sentry.captureException with error and context', () => {
    // Arrange
    const error = new Error('Test error');
    const context = { roomCode: 'ABCD', userId: '123' };

    // Act
    captureError(error, context);

    // Assert
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      contexts: { custom: context },
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
    const context = { operation: 'test' };

    // Act
    captureError(error, context);

    // Assert
    expect(console.error).toHaveBeenCalledWith(
      'Captured error:',
      error,
      context
    );

    // Cleanup
    vi.unstubAllEnvs();
  });

  it('does not log to console.error in production mode', () => {
    // Arrange
    vi.stubEnv('NODE_ENV', 'production');
    const error = new Error('Prod error');

    // Act
    captureError(error);

    // Assert
    expect(console.error).not.toHaveBeenCalled();

    // Cleanup
    vi.unstubAllEnvs();
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
    const context = { userId: 'user_123' };

    const { captureError: captureErrorDisabled } = await import('@/lib/error');
    const SentryMock = await import('@sentry/nextjs');

    captureErrorDisabled(testError, context);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error captured (Sentry disabled):',
      testError,
      context
    );
    expect(SentryMock.captureException).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
    vi.resetModules();
  });
});
