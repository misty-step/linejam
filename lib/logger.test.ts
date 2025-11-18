import { describe, it, expect } from 'vitest';
import { logger, createRequestLogger, createContextLogger } from './logger';

describe('Logger', () => {
  it('should create logger instance with required methods', () => {
    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.debug).toBeDefined();
    expect(logger.child).toBeDefined();
  });

  it('should create child logger with correlation ID', () => {
    const requestLogger = createRequestLogger('test-request-123');

    expect(requestLogger).toBeDefined();
    expect(requestLogger.info).toBeDefined();
    expect(requestLogger.child).toBeDefined();

    // Should not throw when logging
    expect(() => {
      requestLogger.info('Test message');
    }).not.toThrow();
  });

  it('should create child logger with context', () => {
    const contextLogger = createContextLogger({
      roomCode: 'ABCD',
      gameId: '123',
    });

    expect(contextLogger).toBeDefined();
    expect(contextLogger.info).toBeDefined();

    // Should not throw when logging
    expect(() => {
      contextLogger.info({ action: 'playerJoined' }, 'Player joined room');
    }).not.toThrow();
  });

  it('should handle logging with sensitive data (redaction configured)', () => {
    // This tests that the logger accepts sensitive fields
    // Actual redaction verification would require inspecting log output
    expect(() => {
      logger.info(
        {
          displayName: 'ShouldBeRedacted',
          text: 'Poem content should be redacted',
          password: 'secret123',
          userId: '123', // Not redacted
        },
        'Test log with sensitive data'
      );
    }).not.toThrow();
  });

  it('should handle errors in logging', () => {
    const error = new Error('Test error');

    expect(() => {
      logger.error({ error, roomCode: 'ABCD' }, 'Failed to create room');
    }).not.toThrow();
  });
});
