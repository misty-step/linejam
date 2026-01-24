/**
 * Next.js Structured Logging
 *
 * JSON logging for Vercel log parsing. Errors go to stderr, rest to stdout.
 *
 * @example
 * log.info('User joined', { roomCode: 'ABCD' });
 * log.error('Operation failed', { error: err });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function serializeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack?.split('\n').slice(0, 5).join('\n'),
  };
}

function sanitize(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {};

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Error) {
      result[key] = serializeError(value);
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

function write(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitize(data),
  };

  const output = level === 'error' ? console.error : console.log;
  output(JSON.stringify(entry));
}

/**
 * Log a caught error with context. Consistent interface with Convex logger.
 */
export function logError(
  message: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const errorData =
    error instanceof Error
      ? {
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack?.split('\n').slice(0, 5).join('\n'),
        }
      : { errorValue: String(error) };

  write('error', message, { ...errorData, ...context });
}

export const log = {
  debug: (msg: string, data?: Record<string, unknown>) =>
    write('debug', msg, data),
  info: (msg: string, data?: Record<string, unknown>) =>
    write('info', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) =>
    write('warn', msg, data),
  error: (msg: string, data?: Record<string, unknown>) =>
    write('error', msg, data),
};

export default log;
