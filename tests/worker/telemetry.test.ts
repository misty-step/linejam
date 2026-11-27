import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signGuestToken } from '../../src/auth.ts';
import type { Env } from '../../src/env.ts';
import { RELEASE, parseDsn, resetBeaconWindow, scrub } from '../../src/telemetry.ts';
import worker from '../../src/worker.ts';
import { ORIGIN, bindings, call } from './helpers.ts';

const SECRET = 'local-test-guest-secret-0123456789abcdef';
const DSN = 'https://public0key@sentry.test/42';
const ENDPOINT = 'https://sentry.test/api/42/envelope/';

// Everything [L1-8.6] says must never leave the Worker.
const SHARE = 'Zx9_share-slug-0123456789abcdefABCD';
const TOKEN = 'eyJndWVzdElkIjoiYWJjIiwiaXNzdWVkQXQiOjF9.c2lnbmF0dXJlLXNpZ25hdHVyZS1zaWc';
const SECRETS = [SHARE, TOKEN, 'K7QM', 'ada@example.com', 'p_0123456789abcdef01234567', DSN, 'public0key@'];

let sentry: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>;
let logged: string[];

beforeEach(() => {
  resetBeaconWindow();
  sentry = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 200 }));
  logged = [];
  vi.spyOn(console, 'error').mockImplementation((line: unknown) => void logged.push(String(line)));
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function run(request: Request, env: Partial<Env> = {}): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, { ...bindings, ...env } as Env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

function beacon(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/telemetry/error`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** The one Sentry envelope sent, parsed: [envelope header, item header, event]. */
function sentEnvelope(): { url: string; auth: string; parts: any[]; raw: string } {
  expect(sentry).toHaveBeenCalledTimes(1);
  const [url, init] = sentry.mock.calls[0]!;
  const raw = String(init!.body);
  return {
    url: String(url),
    auth: new Headers(init!.headers).get('x-sentry-auth')!,
    parts: raw
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line)),
    raw,
  };
}

const LEAKY_BROWSER_ERROR = {
  kind: 'browser_error',
  type: 'TypeError',
  message: `Cannot read x of /poem/p_0123456789abcdef01234567?share=${SHARE} in room K7QM for ada@example.com`,
  stack: `TypeError: boom\n    at render (http://linejam.test/app.js:1:200)\n    at http://linejam.test/room/K7QM?token=${TOKEN}:2:3`,
  route: `/poem/p_0123456789abcdef01234567?share=${SHARE}`,
};

describe('[L1-8.8] health and release identity', () => {
  it('reports status, environment, release and whether Sentry is configured — never a DSN', async () => {
    const plain = await call('GET', '/api/health');
    expect(plain.body).toEqual({ status: 'ok', environment: 'local', release: RELEASE, sentryConfigured: false });
    expect(RELEASE).toMatch(/^[\w.+-]{1,80}$/);

    const wired = await (await run(new Request(`${ORIGIN}/api/health`), { SENTRY_DSN: DSN })).text();
    expect(JSON.parse(wired)).toEqual({ status: 'ok', environment: 'local', release: RELEASE, sentryConfigured: true });
    expect(wired).not.toContain('public0key');
    expect(wired).not.toContain('sentry.test');
  });

  it('accepts NEXT_PUBLIC_SENTRY_DSN and refuses to call a malformed DSN configured', async () => {
    const next = await run(new Request(`${ORIGIN}/api/health`), { NEXT_PUBLIC_SENTRY_DSN: DSN });
    expect(((await next.json()) as { sentryConfigured: boolean }).sentryConfigured).toBe(true);
    const bad = await run(new Request(`${ORIGIN}/api/health`), { SENTRY_DSN: 'not a dsn' });
    expect(((await bad.json()) as { sentryConfigured: boolean }).sentryConfigured).toBe(false);
  });

  it('parses DSNs into the project envelope endpoint', () => {
    expect(parseDsn(DSN)).toEqual({ endpoint: ENDPOINT, key: 'public0key' });
    expect(parseDsn('https://k@o1.ingest.sentry.io/prefix/77')).toEqual({
      endpoint: 'https://o1.ingest.sentry.io/prefix/api/77/envelope/',
      key: 'k',
    });
    expect(parseDsn('https://sentry.test/42')).toBeNull();
    expect(parseDsn('ftp://k@sentry.test/42')).toBeNull();
    expect(parseDsn('https://k@sentry.test/project')).toBeNull();
  });
});

describe('[L1-8.3] the same-origin browser error beacon', () => {
  it('accepts a beacon without any guest credential', async () => {
    const reply = await call('POST', '/api/telemetry/error', { body: { kind: 'browser_error', message: 'boom' } });
    expect(reply.status).toBe(204);
  });

  it('refuses what is not an error beacon, visibly', async () => {
    expect((await run(beacon({ kind: 'page_view', message: 'x' }))).status).toBe(400);
    expect((await run(beacon({ kind: 'browser_error' }))).status).toBe(400);
    expect((await run(beacon('[1]'))).status).toBe(400);
    expect((await run(beacon('{'))).status).toBe(400);
    expect((await run(beacon({ kind: 'browser_error', message: 'x'.repeat(9000) }))).status).toBe(413);
    expect((await run(beacon({ kind: 'browser_error', message: 'x' }, { 'content-type': 'text/plain' }))).status).toBe(
      415
    );
    const crossSite = await run(beacon({ kind: 'browser_error', message: 'x' }, { origin: 'https://evil.test' }));
    expect(crossSite.status).toBe(403);
    expect(sentry).not.toHaveBeenCalled();
  });
});

describe('[L1-8.7] no DSN configured', () => {
  it('forwards nothing and fails no request', async () => {
    expect((await run(beacon(LEAKY_BROWSER_ERROR))).status).toBe(204);
    expect((await run(new Request(`${ORIGIN}/api/health`), { GUEST_TOKEN_SECRET: undefined })).status).toBe(503);
    expect(sentry).not.toHaveBeenCalled();
    // The structured, anonymous log line is still written ([L1-8.1]).
    expect(logged.map((line) => JSON.parse(line))).toEqual([
      { app: 'linejam', event: 'error_captured', kind: 'browser_error', type: 'TypeError' },
      {
        app: 'linejam',
        event: 'error_captured',
        kind: 'worker_exception',
        type: 'Reject:service_unconfigured',
        status: 503,
      },
    ]);
  });
});

describe('[L1-8.4] [L1-8.5] [L1-8.6] forwarding to Sentry', () => {
  it('sends a browser beacon as one scrubbed, tagged Sentry envelope', async () => {
    expect((await run(beacon(LEAKY_BROWSER_ERROR), { SENTRY_DSN: DSN })).status).toBe(204);
    const sent = sentEnvelope();
    expect(sent.url).toBe(ENDPOINT);
    expect(sent.auth).toBe('Sentry sentry_version=7, sentry_key=public0key, sentry_client=linejam-worker/1.0');
    const [header, item, event] = sent.parts;
    expect(header.event_id).toBe(event.event_id);
    expect(item).toEqual({ type: 'event', content_type: 'application/json' });
    expect(event).toMatchObject({
      level: 'error',
      environment: 'local',
      release: RELEASE,
      transaction: '/poem/:id',
      tags: { kind: 'browser_error', environment: 'local', release: RELEASE, route: '/poem/:id' },
    });
    expect(event.exception.values[0].type).toBe('TypeError');
    expect(event.exception.values[0].value).toBe('Cannot read x of /poem/:id in room [code] for [email]');
    expect(event.exception.values[0].stacktrace.frames.map((f: { filename: string }) => f.filename)).toEqual([
      'http://linejam.test/room/:id',
      'http://linejam.test/app.js',
    ]);
    for (const secret of SECRETS) expect(sent.raw).not.toContain(secret);
  });

  it.each([
    ['unhandled_rejection', { message: 'Request failed' }],
    [
      'csp_violation',
      { message: 'img-src blocked https://cdn.test', directive: 'img-src', blocked: 'https://cdn.test' },
    ],
  ])('tags a %s beacon with its kind', async (kind, fields) => {
    await run(beacon({ kind, type: 'X', ...fields }), { SENTRY_DSN: DSN });
    const event = sentEnvelope().parts[2];
    expect(event.tags.kind).toBe(kind);
    if (kind === 'csp_violation')
      expect(event.tags).toMatchObject({ directive: 'img-src', blocked: 'https://cdn.test' });
  });

  it('forwards an unhandled Durable Object exception behind a 500, without delaying the answer', async () => {
    const token = await signGuestToken(SECRET, 'guest-1', Date.now());
    const failing = {
      idFromName: () => ({}),
      get: () => ({
        state: async () => {
          throw new RangeError(`storage failed for room K7QM share=${SHARE}`);
        },
      }),
    };
    const response = await run(
      new Request(`${ORIGIN}/api/rooms/K7QM?v=3`, { headers: { authorization: `Bearer ${token}` } }),
      { SENTRY_DSN: DSN, ROOM: failing as unknown as Env['ROOM'] }
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: 'internal', message: 'Something went wrong. Try again' } });
    const sent = sentEnvelope();
    const event = sent.parts[2];
    expect(event.tags).toMatchObject({
      kind: 'worker_exception',
      route: '/api/rooms/:id',
      method: 'GET',
      status: '500',
      release: RELEASE,
    });
    expect(event.logger).toBe('worker');
    expect(event.exception.values[0]).toMatchObject({
      type: 'RangeError',
      value: 'storage failed for room [code] share=[token]',
    });
    expect(sent.raw).not.toContain(token);
    for (const secret of SECRETS) expect(sent.raw).not.toContain(secret);
  });

  it('forwards a 5xx refusal and never a 4xx one', async () => {
    await run(new Request(`${ORIGIN}/api/nope`), { SENTRY_DSN: DSN });
    expect(sentry).not.toHaveBeenCalled();
    await run(new Request(`${ORIGIN}/api/health`), { SENTRY_DSN: DSN, GUEST_TOKEN_SECRET: undefined });
    expect(sentEnvelope().parts[2].tags).toMatchObject({ kind: 'worker_exception', status: '503' });
  });

  it('rate-limits browser beacons per isolate', async () => {
    const statuses = [];
    for (let i = 0; i < 32; i++)
      statuses.push((await run(beacon({ kind: 'browser_error', message: `e${i}` }), { SENTRY_DSN: DSN })).status);
    expect(statuses.filter((s) => s === 204)).toHaveLength(30);
    expect(statuses.slice(30)).toEqual([429, 429]);
    expect(sentry).toHaveBeenCalledTimes(30);
  });

  it('keeps answering when Sentry is down, and says so in the log', async () => {
    sentry.mockImplementation(async () => {
      throw new TypeError('network down');
    });
    expect((await run(beacon({ kind: 'browser_error', message: 'x' }), { SENTRY_DSN: DSN })).status).toBe(204);
    sentry.mockImplementation(async () => new Response('no', { status: 500 }));
    expect((await run(beacon({ kind: 'browser_error', message: 'y' }), { SENTRY_DSN: DSN })).status).toBe(204);
    expect(logged.map((line) => JSON.parse(line).event)).toEqual([
      'error_captured',
      'sentry_forward_failed',
      'error_captured',
      'sentry_forward_failed',
    ]);
  });
});

describe('[L1-8.6] scrubbing', () => {
  it.each([
    ['/room/K7QM', '/room/:id'],
    ['/api/poems/p_1/share/confirm', '/api/poems/:id/share/confirm'],
    [`GET /recap/g_1?share=${SHARE}#x`, 'GET /recap/:id'],
    [`cookie linejam_guest_token=${TOKEN}; theme=dark`, 'cookie linejam_guest_token=[token]; theme=dark'],
    [`authorization: Bearer ${TOKEN}`, 'authorization: Bearer [token]'],
    ['code K7QM failed', 'code [code] failed'],
    ['mail ada@example.com', 'mail [email]'],
    ['guest 1b4e28ba-2fa1-11d2-883f-0016d3cca427', 'guest [token]'],
  ])('%s → %s', (input, output) => {
    expect(scrub(input)).toBe(output);
  });

  it('bounds length', () => {
    expect(scrub('a '.repeat(1000))).toHaveLength(500);
  });
});
