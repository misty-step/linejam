import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/nextjs';

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
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
