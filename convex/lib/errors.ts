/**
 * Convex Structured Logging
 *
 * JSON logging for Convex dashboard. Errors go to stderr, rest to stdout.
 *
 * @example
 * log.info('User joined', { roomCode: 'ABCD' });
 * logError('Operation failed', err, { userId });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
}

export type LogPrimitive = string | number | boolean | null;

export type LogValue =
  | LogPrimitive
  | Error
  | SerializedError
  | readonly LogPrimitive[]
  | Readonly<Record<string, LogPrimitive>>;

export type LogContext = Record<string, LogValue>;

function serializeError(error: Error): SerializedError {
  const serialized: SerializedError = {
    name: error.name,
    message: error.message,
  };
  if (error.stack) {
    serialized.stack = error.stack.split('\n').slice(0, 5).join('\n');
  }
  return serialized;
}

function sanitize(data?: LogContext) {
  if (!data) return {};

  const entries = Object.entries(data).map(([key, value]) => [
    key,
    value instanceof Error ? serializeError(value) : value,
  ]);
  return Object.fromEntries(entries);
}

function write(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'convex',
    ...sanitize(context),
  };

  const output = level === 'error' ? console.error : console.log;
  output(JSON.stringify(entry));
}

/**
 * Log a caught error with context.
 */
export function logError(
  message: string,
  error?: Error | string | null,
  context?: LogContext
): void {
  if (error instanceof Error) {
    const errorContext = {
      ...context,
      errorName: error.name,
      errorMessage: error.message,
    };
    if (error.stack) {
      write('error', message, {
        ...errorContext,
        errorStack: error.stack.split('\n').slice(0, 5).join('\n'),
      });
      return;
    }
    write('error', message, errorContext);
    return;
  }
  if (error !== null && error !== undefined) {
    write('error', message, { ...context, errorValue: String(error) });
    return;
  }
  write('error', message, context);
}

export const log = {
  debug: (msg: string, ctx?: LogContext) => write('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => write('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => write('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => write('error', msg, ctx),
};
