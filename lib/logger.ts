import type { ErrorReportable } from '@/lib/errorCore';

/**
 * Next.js Structured Logging
 *
 * Provider-portable JSON logging. Errors go to stderr, rest to stdout.
 *
 * @example
 * log.info('User joined', { roomCode: 'ABCD' });
 * log.error('Operation failed', { error: err });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogScalar = string | number | boolean | null | undefined;

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
}

export type LogValue =
  LogScalar | Error | SerializedError | readonly LogScalar[];

export type LogContext = Record<string, LogValue>;

export type TimestampFields =
  | { timestamp: string }
  | {
      timestamp: string;
      timestampErrorName: string;
      timestampErrorMessage: string;
    };

function timestampFields(): TimestampFields {
  try {
    return { timestamp: new Date().toISOString() };
  } catch (error) {
    return {
      timestamp: 'timestamp-unavailable',
      timestampErrorName: error instanceof Error ? error.name : 'UnknownError',
      timestampErrorMessage:
        error instanceof Error ? error.message : String(error),
    };
  }
}

function serializeError(error: Error): SerializedError {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack?.split('\n').slice(0, 5).join('\n'),
  };
}

function sanitize(data?: LogContext) {
  if (!data) return {};

  const entries = Object.entries(data).map(([key, value]) => {
    if (value instanceof Error) {
      return [key, serializeError(value)];
    }
    if (
      value !== null &&
      value !== undefined &&
      Object(value) === value &&
      !Array.isArray(value)
    ) {
      try {
        JSON.stringify(value);
        return [key, value];
      } catch {
        return [key, '[Non-serializable]'];
      }
    }
    return [key, value];
  });
  return Object.fromEntries(entries);
}

function write(level: LogLevel, message: string, data?: LogContext): void {
  const entry = {
    level,
    message,
    ...timestampFields(),
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
  error: ErrorReportable,
  context?: LogContext
): void {
  const errorData: LogContext =
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
  debug: (msg: string, data?: LogContext) => write('debug', msg, data),
  info: (msg: string, data?: LogContext) => write('info', msg, data),
  warn: (msg: string, data?: LogContext) => write('warn', msg, data),
  error: (msg: string, data?: LogContext) => write('error', msg, data),
};

export interface LogRequestData extends LogContext {
  method: string;
  route: string;
  status: number;
  durationMs: number;
}

export function logRequest(data: LogRequestData): void {
  write('info', 'Request completed', data);
}

export default log;
