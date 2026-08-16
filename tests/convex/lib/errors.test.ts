import type { MockInstance } from 'vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { log, logError } from '../../../convex/lib/errors';

function firstJsonCall(spy: MockInstance): object {
  const emitted = spy.mock.calls[0]?.[0];
  if (Object.prototype.toString.call(emitted) !== '[object String]') {
    throw new Error('Expected structured JSON log output');
  }
  const parsed = JSON.parse(String(emitted));
  if (Object.prototype.toString.call(parsed) !== '[object Object]') {
    throw new Error('Expected structured JSON log object');
  }
  return parsed;
}

describe('Convex structured logging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes errors with a bounded stack and context', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const error = new TypeError('provider failed');
    error.stack = [
      'TypeError: provider failed',
      'one',
      'two',
      'three',
      'four',
      'five',
    ].join('\n');

    logError('request failed', error, { operation: 'providerRead' });

    expect(firstJsonCall(consoleError)).toMatchObject({
      level: 'error',
      message: 'request failed',
      service: 'convex',
      operation: 'providerRead',
      errorName: 'TypeError',
      errorMessage: 'provider failed',
      errorStack: [
        'TypeError: provider failed',
        'one',
        'two',
        'three',
        'four',
      ].join('\n'),
    });
  });

  it('serializes errors without a stack', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const error = new Error('stack unavailable');
    error.stack = undefined;

    logError('request failed', error);

    expect(firstJsonCall(consoleError)).toMatchObject({
      errorName: 'Error',
      errorMessage: 'stack unavailable',
    });
    expect(firstJsonCall(consoleError)).not.toHaveProperty('errorStack');
  });

  it('stringifies non-Error failures and accepts empty failures', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    logError('string failure', 'provider failed', { attempt: 2 });
    logError('null failure', null);
    logError('missing failure');

    expect(consoleError).toHaveBeenCalledTimes(3);
    expect(firstJsonCall(consoleError)).toMatchObject({
      message: 'string failure',
      errorValue: 'provider failed',
      attempt: 2,
    });
  });

  it('serializes Error values nested in regular log context', () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    log.warn('recoverable', { cause: new Error('retry') });
    log.info('without context');

    expect(firstJsonCall(consoleLog)).toMatchObject({
      level: 'warn',
      cause: {
        name: 'Error',
        message: 'retry',
        stack: expect.stringContaining('Error: retry'),
      },
    });
    expect(consoleLog).toHaveBeenCalledTimes(2);
  });
});
