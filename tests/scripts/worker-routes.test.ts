import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  ROUTE_CONTRACTS,
  ROUTE_TEMPLATES,
  assertRouteResponse,
  assertRuntimeLogs,
  routeProbe,
} from '@/scripts/qa/worker-route-contracts';

function response(status: number, body: string, contentType = 'text/html') {
  return [
    { status, headers: new Headers({ 'content-type': contentType }) },
    Buffer.from(body),
  ] as const;
}

describe('Worker route release gate', () => {
  it('defines exactly one explicit pass condition for every canonical route', () => {
    expect(Object.keys(ROUTE_CONTRACTS).sort()).toEqual(
      [...ROUTE_TEMPLATES].sort()
    );
    for (const template of ROUTE_TEMPLATES) {
      expect(routeProbe(template).path).not.toContain('[');
    }
    expect(routeProbe('/api/guest/session')).toEqual({
      path: '/api/guest/session?existing=1',
      method: 'GET',
      backendUnavailable: false,
    });
    expect(routeProbe('/api/internal/sentry-preview-drill').method).toBe(
      'POST'
    );
    expect(routeProbe('/api/health').backendUnavailable).toBe(true);
    expect(routeProbe('/recap/[code]').backendUnavailable).toBe(true);
  });

  it('rejects arbitrary 5xx, redirects, wrong media and empty success bodies', () => {
    for (const status of [302, 404, 500, 503]) {
      expect(() =>
        assertRouteResponse('/releases', ...response(status, '>Changelog</h1>'))
      ).toThrow();
    }
    expect(() =>
      assertRouteResponse(
        '/releases',
        ...response(200, '>Changelog</h1>', 'application/json')
      )
    ).toThrow();
    expect(() => assertRouteResponse('/', ...response(200, ''))).toThrow();
    expect(() =>
      assertRouteResponse('/', ...response(200, '</html>', 'text/html-broken'))
    ).toThrow();
    expect(() =>
      assertRouteResponse('/releases', ...response(200, '>Changelog</h1>'))
    ).not.toThrow();
  });

  it('rejects streamed render failures even after the HTTP 200 headers', () => {
    for (const body of [
      '</html><script>"digest":"123"</script>',
      '</html><script>\\"digest\\":\\"123\\"</script>',
    ]) {
      expect(() => assertRouteResponse('/', ...response(200, body))).toThrow(
        'streamed render error'
      );
    }
    expect(() =>
      assertRouteResponse(
        '/recap/[code]',
        ...response(
          404,
          'Page not found </html> "digest":"NEXT_HTTP_ERROR_FALLBACK;404"'
        )
      )
    ).not.toThrow();
    expect(() =>
      assertRouteResponse(
        '/recap/[code]',
        ...response(404, 'Page not found </html> "digest":"123"')
      )
    ).toThrow('streamed render error');
  });

  it('only accepts the deliberate backend-unavailable health response', () => {
    const check = (status: number, body: string) =>
      assertRouteResponse(
        '/api/health',
        ...response(status, body, 'application/json')
      );
    const unavailable =
      '{"status":"unhealthy","convex":"unreachable","convexEnv":null}';
    expect(() => check(503, unavailable)).not.toThrow();
    for (const body of [
      { status: 'error' },
      { status: 'unhealthy', convex: 'connected', convexEnv: {} },
      { status: 'unhealthy', convex: 'unreachable', convexEnv: {} },
    ]) {
      expect(() => check(503, JSON.stringify(body))).toThrow();
    }
    expect(() => check(500, unavailable)).toThrow();
  });

  it('rejects session issuance and invalid images instead of treating them as coverage', () => {
    expect(() =>
      assertRouteResponse(
        '/api/guest/session',
        ...response(
          200,
          '{"guestId":"new","token":"not-a-real-token"}',
          'application/json'
        )
      )
    ).toThrow();
    expect(() =>
      assertRouteResponse(
        '/opengraph-image',
        ...response(200, 'not PNG', 'image/png')
      )
    ).toThrow();
    expect(() =>
      assertRouteResponse(
        '/opengraph-image',
        ...response(200, 'not PNG', 'image/png; charset=binary')
      )
    ).toThrow();
  });

  it('fails on workerd/Next errors and codegen, including errors swallowed by a backend catch', () => {
    for (const log of [
      { level: 'error', message: 'uncaught TypeError' },
      { level: 'log', message: '{"level":"error","message":"render failed"}' },
      {
        level: 'warn',
        message: 'EvalError: Code generation from strings disallowed',
      },
    ]) {
      expect(() => assertRuntimeLogs([log])).toThrow('Worker runtime error');
    }
    expect(() =>
      assertRuntimeLogs([
        {
          level: 'log',
          message:
            '{"level":"warn","message":"Convex health ping failed; marking unreachable"}',
        },
      ])
    ).not.toThrow();
  });

  it('accepts only the native client-cancel diagnostic, not application or other socket faults', () => {
    const disconnect =
      'kj::getCaughtExceptionAsKj() = rust/cxx/kj-rs-io/ffi.rs:164: disconnected: write(): Connection reset by peer (os error 104)\nstack: /runtime/bin/workerd@57d56c3';
    expect(() =>
      assertRuntimeLogs([{ level: 'error', message: disconnect }])
    ).not.toThrow();
    for (const log of [
      { level: 'fatal', message: disconnect },
      { level: 'error', message: 'Connection reset by peer (os error 104)' },
      { level: 'error', message: disconnect.replace('write()', 'read()') },
      { level: 'error', message: disconnect + '\nuncaught TypeError' },
      {
        level: 'log',
        message: JSON.stringify({ level: 'error', message: disconnect }),
      },
    ]) {
      expect(() => assertRuntimeLogs([log])).toThrow('Worker runtime error');
    }
  });

  it('runs before deployment and is an unskippable dependency of PR merge-gate', () => {
    const release = parse(
      readFileSync('.github/workflows/cloudflare-production.yml', 'utf8')
    );
    const command = release.jobs.deploy.steps.find((step: { run?: string }) =>
      step.run?.includes('pnpm build:cf')
    ).run;
    expect(command.indexOf('pnpm test:worker-routes')).toBeGreaterThan(
      command.indexOf('pnpm build:cf')
    );
    expect(command.indexOf('pnpm test:worker-routes')).toBeLessThan(
      command.indexOf("['deploy:cf:production'")
    );
    const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
    expect(
      ci.jobs['worker-images'].steps.some(
        (step: { run?: string }) => step.run === 'pnpm test:worker-routes'
      )
    ).toBe(true);
    expect(ci.jobs['merge-gate'].needs).toContain('worker-images');
    expect(ci.jobs['worker-images']['continue-on-error']).not.toBe(true);
  });
});
