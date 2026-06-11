import { afterEach, describe, expect, it, vi } from 'vitest';
import { log, logError, logRequest } from '@/lib/logger';

function parseJsonCall(spy: ReturnType<typeof vi.spyOn>) {
  const calls = spy.mock.calls as Array<[unknown, ...unknown[]]>;
  return JSON.parse(String(calls[0]?.[0])) as Record<string, unknown>;
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

  it('serializes Error objects and protects against circular context', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    logError('request failed', new Error('boom'), { circular });

    expect(parseJsonCall(consoleErrorSpy)).toMatchObject({
      level: 'error',
      message: 'request failed',
      errorName: 'Error',
      errorMessage: 'boom',
      circular: '[Non-serializable]',
    });
  });
});
