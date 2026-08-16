import { afterEach, describe, expect, it, vi } from 'vitest';
import { log, logError, logRequest } from '@/lib/logger';

type ParsedLogPayload = {
  level?: string;
  message?: string;
  timestamp?: string;
  timestampErrorName?: string;
  timestampErrorMessage?: string;
  errorName?: string;
  errorMessage?: string;
  errorValue?: string;
  circular?: string;
  cause?: {
    name?: string;
    message?: string;
    stack?: unknown;
  };
  durationMs?: number;
  method?: string;
  route?: string;
  status?: number;
};

class SelfReferentialLogValue {
  readonly name = 'SelfReferential';
  readonly message = 'circular log fixture';
  readonly self = this;
}

function parseJsonCall(spy: {
  mock: { calls: unknown[][] };
}): ParsedLogPayload {
  const firstCall = spy.mock.calls[0];
  const firstArg = firstCall !== undefined ? firstCall[0] : '';
  // SAFETY: JSON.parse parses structured JSON emitted by logger methods under test.
  return JSON.parse(String(firstArg)) as ParsedLogPayload;
}

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes request logs as structured JSON to stdout', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logRequest({
      method: 'GET',
      route: '/api/health',
      status: 200,
      durationMs: 12,
    });

    expect(parseJsonCall(consoleLogSpy)).toMatchObject({
      level: 'info',
      message: 'Request completed',
      method: 'GET',
      route: '/api/health',
      status: 200,
      durationMs: 12,
    });
  });

  it('falls back when timestamp serialization fails', () => {
    vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => {
      throw new Error('clock failed');
    });
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    log.info('clock checked');

    expect(parseJsonCall(consoleLogSpy)).toMatchObject({
      level: 'info',
      message: 'clock checked',
      timestamp: 'timestamp-unavailable',
      timestampErrorName: 'Error',
      timestampErrorMessage: 'clock failed',
    });
  });

  it('describes non-Error timestamp failures', () => {
    vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => {
      throw 'clock failed';
    });
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    log.info('clock checked');

    expect(parseJsonCall(consoleLogSpy)).toMatchObject({
      level: 'info',
      message: 'clock checked',
      timestamp: 'timestamp-unavailable',
      timestampErrorName: 'UnknownError',
      timestampErrorMessage: 'clock failed',
    });
  });

  it('serializes Error values embedded in structured context', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    log.warn('recoverable failure', { cause: new TypeError('bad input') });

    expect(parseJsonCall(consoleLogSpy)).toMatchObject({
      level: 'warn',
      message: 'recoverable failure',
      cause: {
        name: 'TypeError',
        message: 'bad input',
        stack: expect.stringContaining('TypeError: bad input'),
      },
    });
  });

  it('serializes Error objects and protects against circular context', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const circular = new SelfReferentialLogValue();

    logError('request failed', new Error('boom'), { circular });

    expect(parseJsonCall(consoleErrorSpy)).toMatchObject({
      level: 'error',
      message: 'request failed',
      errorName: 'Error',
      errorMessage: 'boom',
      circular: '[Non-serializable]',
    });
  });

  it('logs non-Error failures with a string fallback', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    logError('request failed', 'boom', { route: '/api/health' });

    expect(parseJsonCall(consoleErrorSpy)).toMatchObject({
      level: 'error',
      message: 'request failed',
      errorValue: 'boom',
      route: '/api/health',
    });
  });
});
