import pino from 'pino';

/**
 * Centralized structured logger for Linejam
 *
 * Features:
 * - JSON structured logging for easy parsing
 * - Automatic sensitive data redaction (PII, auth tokens, poem text)
 * - Correlation IDs for request tracing
 * - Environment-aware configuration
 * - Pretty printing in development
 *
 * Usage:
 *   logger.info({ userId: '123' }, 'User joined room')
 *   logger.error({ error, roomCode: 'ABCD' }, 'Failed to create room')
 *
 *   // With correlation ID (child logger)
 *   const requestLogger = logger.child({ requestId: uuid() })
 *   requestLogger.info('Processing request')
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Base fields included in every log
  base: {
    env: process.env.NODE_ENV,
    pid: process.pid,
  },

  // Redact sensitive data - Privacy and security protection
  redact: {
    paths: [
      // Auth & security
      'req.headers.authorization',
      'req.headers.cookie',
      'authorization',
      'password',
      'token',
      'apiKey',
      'secret',

      // PII - User data
      'displayName',
      'email',
      'clerkUserId',
      'guestId',

      // Game content - Poem text is user-created content
      'text',
      'lineText',
      'poemText',
      'content',
    ],
    // Replace with [Redacted] instead of removing
    censor: '[Redacted]',
  },

  // Pretty printing in development for readability
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }
    : undefined,

  // Silence logs in test environment
  enabled: !isTest,

  // Timestamp formatting
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger with correlation ID
 *
 * Useful for tracing requests across the application
 *
 * @example
 * const requestLogger = createRequestLogger(requestId)
 * requestLogger.info('Processing game creation')
 * requestLogger.error({ error }, 'Game creation failed')
 */
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}

/**
 * Create a child logger with context
 *
 * @example
 * const roomLogger = createContextLogger({ roomCode: 'ABCD', gameId: '123' })
 * roomLogger.info('Player joined')
 */
export function createContextLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

// Export types for TypeScript consumers
export type Logger = pino.Logger;
export type LoggerOptions = pino.LoggerOptions;
