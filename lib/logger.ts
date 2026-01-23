/**
 * Structured Logger
 *
 * JSON logging for Vercel log parsing. Works in both Next.js and Convex.
 * All output goes to stdout/stderr as parseable JSON.
 *
 * @example
 * log.info('User joined room', { roomCode: 'ABCD', userId: '123' });
 * log.error('Failed to generate AI line', { error: err, roomId });
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Create a structured log entry and write to console.
 * Errors go to stderr, everything else to stdout.
 */
function write(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitizeData(data),
  };

  const json = JSON.stringify(entry);

  if (level === 'error') {
    console.error(json);
  } else {
    console.log(json);
  }
}

/**
 * Sanitize data for logging - handle Error objects and circular refs.
 */
function sanitizeData(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {};

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Error) {
      result[key] = {
        name: value.name,
        message: value.message,
        stack: value.stack?.split('\n').slice(0, 5).join('\n'),
      };
    } else if (typeof value === 'object' && value !== null) {
      try {
        // Test for circular references
        JSON.stringify(value);
        result[key] = value;
      } catch {
        result[key] = '[Circular or non-serializable]';
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Structured logger with level methods.
 */
export const log = {
  debug: (message: string, data?: Record<string, unknown>) =>
    write('debug', message, data),
  info: (message: string, data?: Record<string, unknown>) =>
    write('info', message, data),
  warn: (message: string, data?: Record<string, unknown>) =>
    write('warn', message, data),
  error: (message: string, data?: Record<string, unknown>) =>
    write('error', message, data),
};

export default log;
