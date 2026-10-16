import assert from 'node:assert/strict';
import { APP_VERSION } from '../../lib/appVersion';
import { ROUTE_TEMPLATES } from '../../lib/sentryPrivacy';

export { ROUTE_TEMPLATES };
export type RouteTemplate = (typeof ROUTE_TEMPLATES)[number];

type Contract = {
  status: number;
  contentType: string;
  includes?: string;
  method?: string;
  query?: string;
  backendUnavailable?: true;
};
const html = { status: 200, contentType: 'text/html', includes: '</html>' };
const png = { status: 200, contentType: 'image/png' };

// This is a pass-condition map, not a route inventory. Missing or extra entries
// fail typecheck; ROUTE_TEMPLATES (itself checked against app/) owns enumeration.
export const ROUTE_CONTRACTS = {
  '/': html,
  '/_not-found': { ...html, status: 404, includes: 'Page not found' },
  '/api/deployment': { status: 200, contentType: 'application/json' },
  '/api/guest/session': {
    status: 200,
    contentType: 'application/json',
    query: '?existing=1', // Never create a guest session or consume a throttle.
  },
  '/api/health': {
    status: 503,
    contentType: 'application/json',
    backendUnavailable: true,
  },
  '/api/internal/sentry-preview-drill': {
    status: 404,
    contentType: '',
    method: 'POST',
  },
  '/callback': html,
  '/changelog': { ...html, includes: '>Changelog</h1>' },
  '/host': html,
  '/join': html,
  '/me/poems': html,
  '/me/profile': html,
  '/opengraph-image': png,
  '/poem/[id]': { ...html, backendUnavailable: true },
  '/poem/[id]/card': {
    status: 404,
    contentType: 'text/plain',
    includes: 'Poem not found or unavailable.',
    backendUnavailable: true,
  },
  '/poem/[id]/opengraph-image': {
    ...png,
    status: 404,
    backendUnavailable: true,
  },
  '/recap/[code]': {
    ...html,
    status: 404,
    includes: 'Page not found',
    backendUnavailable: true,
  },
  '/recap/[code]/opengraph-image': { ...png, backendUnavailable: true },
  '/releases': { ...html, includes: '>Changelog</h1>' },
  '/releases.xml': {
    status: 200,
    contentType: 'application/xml',
    includes: '<rss ',
  },
  '/robots.txt': {
    status: 200,
    contentType: 'text/plain',
    includes: 'User-Agent:',
  },
  '/room/[code]': html,
  '/sign-in/[[...sign-in]]': html,
  '/sign-up/[[...sign-up]]': html,
  '/sitemap.xml': {
    status: 200,
    contentType: 'application/xml',
    includes: '<urlset ',
  },
} satisfies Record<RouteTemplate, Contract>;

export function routeProbe(template: RouteTemplate) {
  const contract: Contract = ROUTE_CONTRACTS[template];
  const path = template
    .replace('[id]', 'k970000000000000000000000000000a')
    .replace('[code]', 'ZZZZ')
    .replace(/\/\[\[\.\.\.[^\]]+\]\]/g, '');
  assert(!path.includes('['), `No probe parameter for ${template}`);
  return {
    path: path + (contract.query ?? ''),
    method: contract.method ?? 'GET',
    backendUnavailable: contract.backendUnavailable ?? false,
  };
}

export function assertRouteResponse(
  template: RouteTemplate,
  response: { status: number; headers: Pick<Headers, 'get'> },
  bytes: Buffer
) {
  const contract: Contract = ROUTE_CONTRACTS[template];
  assert.equal(
    response.status,
    contract.status,
    `${template}: unexpected status`
  );
  const contentType = (response.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim();
  assert.equal(
    contentType,
    contract.contentType,
    `${template}: unexpected content type`
  );
  if (contract.includes) {
    assert(
      bytes.toString().includes(contract.includes),
      `${template}: missing response marker`
    );
  }
  // Streaming Server Component failures can leave HTTP 200 on the wire.
  if (contentType.startsWith('text/html')) {
    const html = bytes.toString().replaceAll('\\"', '"');
    for (const match of html.matchAll(/"digest"\s*:\s*"([^"]*)"/g)) {
      // notFound() uses an RSC control-flow digest, not a runtime exception.
      assert(
        response.status === 404 && match[1] === 'NEXT_HTTP_ERROR_FALLBACK;404',
        `${template}: streamed render error`
      );
    }
  }
  if (contentType === 'image/png') {
    assert.deepEqual(
      bytes.subarray(0, 8),
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
    assert.equal(bytes.readUInt32BE(16), 1200);
    assert.equal(bytes.readUInt32BE(20), 630);
  }
  if (template === '/api/health') {
    const health = JSON.parse(bytes.toString());
    // The ONLY permitted 5xx: the handler explicitly reports an unreachable,
    // deliberately isolated backend, not a crash or a generic unhealthy result.
    assert.equal(health.status, 'unhealthy');
    assert.equal(health.convex, 'unreachable');
    assert.equal(health.convexEnv, null);
  }
  if (template === '/api/guest/session') {
    assert.deepEqual(JSON.parse(bytes.toString()), {
      guestId: null,
      token: null,
    });
    assert.equal(response.headers.get('set-cookie'), null);
  }
  if (template === '/api/deployment') {
    assert.equal(JSON.parse(bytes.toString()).version, APP_VERSION);
  }
}

export function assertRuntimeLogs(logs: { level: string; message: string }[]) {
  for (const log of logs) {
    // Reloads, aborted asset loads and sleeping phones can cancel an in-flight
    // native write. This exact workerd peer-disconnect is not an app exception.
    if (
      log.level === 'error' &&
      /^kj::getCaughtExceptionAsKj\(\) = rust\/cxx\/kj-rs-io\/ffi\.rs:\d+: disconnected: write\(\): Connection reset by peer \(os error 104\)\nstack: [^\n]*\/workerd@[^\n]+$/.test(
        log.message
      )
    )
      continue;
    let applicationLevel: unknown;
    try {
      applicationLevel = JSON.parse(log.message)?.level;
    } catch {
      // Next/workerd diagnostics are plain text, not the application logger.
    }
    assert(
      !['error', 'fatal'].includes(log.level) &&
        applicationLevel !== 'error' &&
        applicationLevel !== 'fatal' &&
        !/EvalError|code generation from strings|disallowed.*codegen/i.test(
          log.message
        ),
      `Worker runtime error: ${log.message}`
    );
  }
}
