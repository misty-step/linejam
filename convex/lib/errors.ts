/**
 * Convex Error Tracking
 *
 * Structured error logging for Convex backend. Outputs JSON to stdout/stderr
 * for Convex dashboard log parsing.
 *
 * Since Sentry SDK doesn't run in Convex, this provides structured logging
 * that surfaces errors clearly in the Convex dashboard.
 *
 * @example
 * import { logError, log } from './errors';
 *
 * try {
 *   await riskyOperation();
 * } catch (err) {
 *   logError('Failed to complete operation', err, { userId, roomCode });
 *   throw err; // Re-throw if needed
 * }
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ConvexLogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: 'convex';
  [key: string]: unknown;
}

/**
 * Create a structured log entry.
 */
function write(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  const entry: ConvexLogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'convex',
    ...sanitizeContext(context),
  };

  const json = JSON.stringify(entry);

  if (level === 'error') {
    console.error(json);
  } else {
    console.log(json);
  }
}

/**
 * Sanitize context for logging - handle Error objects safely.
 */
function sanitizeContext(
  context?: Record<string, unknown>
): Record<string, unknown> {
  if (!context) return {};

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    if (value instanceof Error) {
      result[key] = {
        name: value.name,
        message: value.message,
        // Truncate stack to first 5 lines
        stack: value.stack?.split('\n').slice(0, 5).join('\n'),
      };
    } else if (typeof value === 'object' && value !== null) {
      try {
        JSON.stringify(value);
        result[key] = value;
      } catch {
        result[key] = '[Non-serializable]';
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Log an error with context. Use for caught exceptions.
 *
 * @param message - Human-readable description of what failed
 * @param error - The caught error
 * @param context - Additional context (userId, roomCode, etc.)
 */
export function logError(
  message: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const errorObj =
    error instanceof Error
      ? {
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack?.split('\n').slice(0, 5).join('\n'),
        }
      : { errorValue: String(error) };

  write('error', message, { ...errorObj, ...context });
}

/**
 * Structured logger with level methods.
 */
export const log = {
  debug: (message: string, context?: Record<string, unknown>) =>
    write('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    write('error', message, context),
};
