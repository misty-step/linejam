import { describe, expect, it } from 'vitest';
import type { ErrorEvent, Event } from '@sentry/nextjs';
import {
  beforeSend,
  beforeSendTransaction,
  sanitizeSentryReporterContext,
} from '@/lib/sentryPrivacy';

type TransactionEvent = Event & { type: 'transaction' };

const FORBIDDEN = 'LINEJAM_SENTRY_FORBIDDEN_SENTINEL';

function taintedEvent(): ErrorEvent {
  return {
    type: undefined,
    event_id: 'a'.repeat(32),
    environment: 'preview',
    release: 'b'.repeat(40),
    message: FORBIDDEN,
    logentry: { message: FORBIDDEN },
    user: {
      id: FORBIDDEN,
      email: `${FORBIDDEN}@example.com`,
      ip_address: '203.0.113.42',
    },
    request: {
      url: `https://linejam.app/room/${FORBIDDEN}?prompt=${FORBIDDEN}`,
      query_string: `prompt=${FORBIDDEN}`,
      headers: { authorization: FORBIDDEN, cookie: FORBIDDEN },
      cookies: { session: FORBIDDEN },
      data: { poem: FORBIDDEN },
    },
    extra: { prompt: FORBIDDEN },
    contexts: {
      rejected: { poem: FORBIDDEN },
      linejam: {
        durationMs: 12,
        requestId: 'request_12345678',
        poemId: FORBIDDEN,
      },
    },
    breadcrumbs: [
      {
        message: FORBIDDEN,
        data: { requestBody: FORBIDDEN },
      },
    ],
    tags: {
      runtime: 'browser',
      operation: 'sentryPreviewDrill',
      forbidden: FORBIDDEN,
    },
    exception: {
      values: [
        {
          type: 'SentryPreviewDrillError',
          value: FORBIDDEN,
          stacktrace: {
            frames: [
              {
                filename: `${FORBIDDEN}.js`,
                function: FORBIDDEN,
                module: FORBIDDEN,
                lineno: 42,
                colno: 7,
                vars: { prompt: FORBIDDEN },
                context_line: FORBIDDEN,
                pre_context: [FORBIDDEN],
                post_context: [FORBIDDEN],
              },
            ],
          },
        },
      ],
    },
    debug_meta: {
      images: [
        {
          type: 'sourcemap',
          code_file: `https://linejam.app/_next/static/chunk.js?token=${FORBIDDEN}`,
          debug_id: '12345678-1234-1234-1234-123456789abc',
        },
      ],
    },
  };
}

describe('Sentry transport privacy boundary', () => {
  it('removes every forbidden sentinel while retaining safe classification and frame coordinates', () => {
    const sanitized = beforeSend(taintedEvent(), {});
    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.toContain(FORBIDDEN);
    expect(sanitized).toMatchObject({
      environment: 'preview',
      release: 'b'.repeat(40),
      tags: {
        runtime: 'browser',
        operation: 'sentryPreviewDrill',
      },
      contexts: {
        linejam: {
          durationMs: 12,
          requestId: 'request_12345678',
        },
      },
      exception: {
        values: [
          {
            type: 'SentryPreviewDrillError',
            stacktrace: {
              frames: [
                {
                  lineno: 42,
                  colno: 7,
                },
              ],
            },
          },
        ],
      },
    });
    const frame = sanitized?.exception?.values?.[0]?.stacktrace?.frames?.[0];
    expect(frame).not.toHaveProperty('function');
    expect(frame).not.toHaveProperty('module');
    expect(frame).not.toHaveProperty('filename');
    expect(sanitized?.debug_meta).toEqual({
      images: [
        {
          type: 'sourcemap',
          code_file: 'app:///_next/static/chunk.js',
          debug_id: '12345678-1234-1234-1234-123456789abc',
        },
      ],
    });
    expect(sanitized).not.toHaveProperty('user');
    expect(serialized).not.toContain('203.0.113.42');
    expect(sanitized).not.toHaveProperty('request');
    expect(sanitized).not.toHaveProperty('extra');
    expect(sanitized).not.toHaveProperty('breadcrumbs');
  });

  it('retains only normalized static bundle locations and debug IDs', () => {
    const event = taintedEvent();
    event.exception!.values![0]!.stacktrace!.frames![0]!.filename = `https://assets.example/_next/static/chunks/app/room/%5Bcode%5D/page.js?token=${FORBIDDEN}`;
    event.exception!.values![0]!.stacktrace!.frames![0]!.abs_path = `https://assets.example/_next/static/chunks/app/room/%5Bcode%5D/page.js#${FORBIDDEN}`;
    event.debug_meta!.images![0]!.code_file = `https://assets.example/_next/static/chunks/app/room/%5Bcode%5D/page.js?token=${FORBIDDEN}`;

    const sanitized = beforeSend(event, {});
    const frame = sanitized?.exception?.values?.[0]?.stacktrace?.frames?.[0];
    expect(frame).toMatchObject({
      filename: 'app:///_next/static/chunks/app/room/%5Bcode%5D/page.js',
      abs_path: 'app:///_next/static/chunks/app/room/%5Bcode%5D/page.js',
    });
    expect(sanitized?.debug_meta).toEqual({
      images: [
        {
          type: 'sourcemap',
          code_file: 'app:///_next/static/chunks/app/room/%5Bcode%5D/page.js',
          debug_id: '12345678-1234-1234-1234-123456789abc',
        },
      ],
    });
    expect(JSON.stringify(sanitized)).not.toContain(FORBIDDEN);
    expect(JSON.stringify(sanitized)).not.toContain('assets.example');
  });

  it('drops traversal, non-static source locations, and malformed debug IDs', () => {
    const event = taintedEvent();
    event.exception!.values![0]!.stacktrace!.frames![0]!.filename =
      'https://linejam.app/_next/static/%2e%2e/server.js';
    event.debug_meta = {
      images: [
        {
          type: 'sourcemap',
          code_file: 'file:///srv/linejam/server.js',
          debug_id: '12345678-1234-1234-1234-123456789abc',
        },
        {
          type: 'sourcemap',
          code_file: 'https://linejam.app/_next/static/%2e%2e/server.js',
          debug_id: '12345678-1234-1234-1234-123456789abc',
        },
        {
          type: 'sourcemap',
          code_file: [
            'https://private-user',
            'linejam.app/_next/static/chunk.js',
          ].join('@'),
          debug_id: '12345678-1234-1234-1234-123456789abc',
        },
        {
          type: 'sourcemap',
          code_file: 'https://linejam.app/_next/static/chunk.js',
          debug_id: FORBIDDEN,
        },
      ],
    };

    const sanitized = beforeSend(event, {});
    const frame = sanitized?.exception?.values?.[0]?.stacktrace?.frames?.[0];
    expect(frame).not.toHaveProperty('filename');
    expect(frame).not.toHaveProperty('abs_path');
    expect(sanitized).not.toHaveProperty('debug_meta');
  });

  it.each([
    'Clerk did not load in time; continuing with guest play',
    'Linejam preview privacy drill',
  ])('retains the fixed safe exception message %s', (message) => {
    const event = taintedEvent();
    event.exception!.values![0]!.value = message;

    expect(beforeSend(event, {})).toHaveProperty(
      'exception.values.0.value',
      message
    );
  });

  it('rejects inherited prototype names from every closed allowlist', () => {
    const event = taintedEvent();
    Object.assign(event, {
      environment: 'constructor',
      level: 'constructor',
      platform: 'toString',
      tags: {
        runtime: 'constructor',
        operation: 'toString',
      },
      transaction: 'constructor',
    });
    event.exception!.values![0] = {
      type: 'constructor',
      value: 'constructor',
      mechanism: {
        type: 'toString',
        handled: true,
      },
    };

    const sanitized = beforeSend(event, {});
    expect(sanitized).not.toHaveProperty('environment');
    expect(sanitized).not.toHaveProperty('level');
    expect(sanitized).not.toHaveProperty('platform');
    expect(sanitized).not.toHaveProperty('tags');
    expect(sanitized).toMatchObject({
      exception: {
        values: [
          {
            type: 'Error',
          },
        ],
      },
    });
    expect(sanitized).not.toHaveProperty('exception.values.0.value');
    expect(sanitized).not.toHaveProperty('exception.values.0.mechanism');

    // SAFETY: Test fixture reuses base event envelope with TransactionEvent fields to test beforeSendTransaction boundary.
    const transaction = beforeSendTransaction({
      ...(event as TransactionEvent),
      type: 'transaction',
      transaction: 'constructor',
      start_timestamp: 1,
      spans: [
        {
          trace_id: 'c'.repeat(32),
          span_id: 'd'.repeat(16),
          start_timestamp: 1,
          timestamp: 2,
          op: 'constructor',
          status: 'toString',
          data: {},
        },
      ],
    });
    expect(transaction?.transaction).toBe('unknown-route');
    expect(transaction?.spans?.[0]).not.toHaveProperty('op');
    expect(transaction?.spans?.[0]).not.toHaveProperty('status');
  });

  it('drops deployment-skew noise before it becomes an incident', () => {
    const error = new Error('private action detail');
    error.name = 'UnrecognizedActionError';

    expect(beforeSend(taintedEvent(), { originalException: error })).toBeNull();
  });

  it('reduces reporter context to closed tags and bounded numeric/correlation fields', () => {
    expect(
      sanitizeSentryReporterContext({
        operation: 'finishAbandonedGame',
        failureCode: 'unexpected_error',
        durationMs: Number.POSITIVE_INFINITY,
        attempt: 3,
        correlationId: 'correlation_12345678',
        roomCode: FORBIDDEN,
        poemId: FORBIDDEN,
        prompt: FORBIDDEN,
      })
    ).toEqual({
      tags: {
        operation: 'finishAbandonedGame',
        failure_code: 'unexpected_error',
      },
      contexts: {
        linejam: {
          attempt: 3,
          correlationId: 'correlation_12345678',
        },
      },
    });
  });

  it('normalizes dynamic transaction names and strips span descriptions and data', () => {
    const event: TransactionEvent = {
      ...taintedEvent(),
      type: 'transaction' as const,
      transaction: `GET /room/${FORBIDDEN}?prompt=${FORBIDDEN}`,
      start_timestamp: 1,
      spans: [
        {
          trace_id: 'c'.repeat(32),
          span_id: 'd'.repeat(16),
          start_timestamp: 1,
          timestamp: 2,
          op: 'http.server',
          description: FORBIDDEN,
          data: { prompt: FORBIDDEN },
        },
      ],
    };

    const sanitized = beforeSendTransaction(event);
    expect(sanitized).not.toBeNull();
    expect(sanitized?.transaction).toBe('GET /room/[code]');
    expect(JSON.stringify(sanitized)).not.toContain(FORBIDDEN);
    expect(sanitized?.spans?.[0]).not.toHaveProperty('description');
    expect(sanitized?.spans?.[0]?.data).toEqual({});
  });
  it('retains the complete closed error topology and clamps numeric context', () => {
    const event = taintedEvent();
    Object.assign(event, {
      timestamp: 123,
      level: 'error',
      platform: 'node',
      environment: 'production',
      release: 'c'.repeat(40),
      tags: {
        runtime: 'node',
        environment: 'production',
        release: 'd'.repeat(40),
        operation: 'sentryPreviewDrill',
        failure_code: 'unexpected_error',
      },
      contexts: {
        trace: {
          trace_id: 'e'.repeat(32),
          span_id: 'f'.repeat(16),
          parent_span_id: '1'.repeat(16),
          op: 'http.server',
          status: 'internal_error',
        },
        linejam: {
          attempt: -5,
          durationMs: 2_000_000_000,
          correlationId: 'correlation_12345678',
        },
      },
    });
    event.exception!.values![0] = {
      type: 'Error',
      value: 'Linejam preview privacy drill',
      mechanism: { type: 'generic', handled: false },
      stacktrace: {
        frames: [
          {
            filename: '~/_next/static/chunks/app.mjs',
            lineno: -2,
            colno: 2_000_000_000,
            in_app: false,
          },
        ],
      },
    };

    expect(beforeSend(event, {})).toMatchObject({
      event_id: 'a'.repeat(32),
      timestamp: 123,
      level: 'error',
      platform: 'node',
      environment: 'production',
      release: 'c'.repeat(40),
      tags: {
        runtime: 'node',
        environment: 'production',
        release: 'd'.repeat(40),
        operation: 'sentryPreviewDrill',
        failure_code: 'unexpected_error',
      },
      contexts: {
        trace: {
          trace_id: 'e'.repeat(32),
          span_id: 'f'.repeat(16),
          parent_span_id: '1'.repeat(16),
          op: 'http.server',
          status: 'internal_error',
        },
        linejam: {
          attempt: 0,
          durationMs: 1_000_000_000,
          correlationId: 'correlation_12345678',
        },
      },
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Linejam preview privacy drill',
            mechanism: { type: 'generic', handled: false },
            stacktrace: {
              frames: [
                {
                  filename: 'app:///_next/static/chunks/app.mjs',
                  abs_path: 'app:///_next/static/chunks/app.mjs',
                  lineno: 0,
                  colno: 1_000_000_000,
                  in_app: false,
                },
              ],
            },
          },
        ],
      },
    });
  });

  it('drops malformed optional topology and events without a safe exception', () => {
    const event = taintedEvent();
    Object.assign(event, {
      event_id: 'invalid',
      timestamp: Number.NaN,
      level: 'notice',
      platform: 'python',
      environment: 'staging',
      release: 'invalid',
      tags: {},
      contexts: {
        trace: { trace_id: 'invalid', span_id: 'invalid' },
        linejam: false,
      },
      debug_meta: { images: [] },
    });
    event.exception!.values![0] = {
      type: 'Error',
      mechanism: { type: 'invalid', handled: true },
      stacktrace: { frames: [] },
    };

    const sanitized = beforeSend(event, {});
    expect(sanitized).toEqual({
      type: undefined,
      exception: { values: [{ type: 'Error' }] },
    });
    expect(beforeSend({ type: undefined }, {})).toBeNull();
  });

  it.each([
    `https://linejam.app/_next/static/${'a'.repeat(1_025)}.js`,
    String.raw`C:\linejam\_next\static\chunk.js`,
    'https://linejam.app/_next/static/%E0%A4%A.js',
    `https://linejam.app/_next/static/${'a'.repeat(513)}.js`,
    'https://linejam.app/_next/static/chunks//page.js',
    'https://linejam.app/_next/static/chunk.css',
    'ftp://linejam.app/_next/static/chunk.js',
    ['https://user:password', 'linejam.app/_next/static/chunk.js'].join('@'),
  ])('rejects unsafe source location %s', (filename) => {
    const event = taintedEvent();
    event.exception!.values![0]!.stacktrace!.frames![0]!.filename = filename;
    expect(
      beforeSend(event, {})?.exception?.values?.[0]?.stacktrace?.frames?.[0]
    ).not.toHaveProperty('filename');
  });

  it('filters malformed spans while retaining closed trace topology', () => {
    const event: TransactionEvent = {
      ...taintedEvent(),
      type: 'transaction',
      transaction: undefined,
      start_timestamp: 10,
      spans: [
        {
          trace_id: 'invalid',
          span_id: '2'.repeat(16),
          start_timestamp: 1,
          timestamp: 2,
          data: {},
        },
        {
          trace_id: '2'.repeat(32),
          span_id: '3'.repeat(16),
          start_timestamp: Number.POSITIVE_INFINITY,
          timestamp: 2,
          data: {},
        },
        {
          trace_id: '4'.repeat(32),
          span_id: '5'.repeat(16),
          parent_span_id: '6'.repeat(16),
          start_timestamp: 1,
          timestamp: 2,
          op: 'http.client',
          status: 'ok',
          data: {},
        },
        {
          trace_id: '7'.repeat(32),
          span_id: '8'.repeat(16),
          start_timestamp: 1,
          timestamp: 2,
          data: {},
        },
      ],
    };

    const sanitized = beforeSendTransaction(event);
    expect(sanitized?.transaction).toBe('unknown-route');
    expect(sanitized?.spans).toEqual([
      {
        trace_id: '4'.repeat(32),
        span_id: '5'.repeat(16),
        parent_span_id: '6'.repeat(16),
        start_timestamp: 1,
        timestamp: 2,
        data: {},
        op: 'http.client',
        status: 'ok',
      },
      {
        trace_id: '7'.repeat(32),
        span_id: '8'.repeat(16),
        start_timestamp: 1,
        timestamp: 2,
        data: {},
      },
    ]);
    expect(
      beforeSendTransaction({ ...event, start_timestamp: Number.NaN })
    ).toBeNull();
  });

  it('returns no reporter context when no closed field survives', () => {
    expect(sanitizeSentryReporterContext()).toBeUndefined();
    expect(
      sanitizeSentryReporterContext({
        operation: 'invented',
        prompt: FORBIDDEN,
      })
    ).toBeUndefined();
  });
});
