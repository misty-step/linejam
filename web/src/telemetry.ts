// [L1-8.3] Uncaught errors, unhandled rejections and CSP violations become one
// diagnostic beacon each to the same origin. No SDK, no other origin, no
// credential: the Worker validates, scrubs and forwards ([L1-8.4], [L1-8.6]).

const ENDPOINT = '/api/telemetry/error';
const MAX_PER_PAGE = 10;
const sent = new Set<string>();

/** The page as a route template: identifiers and the query never leave the browser. */
function route(): string {
  return location.pathname.replace(/^\/(room|poem|recap)\/[^/]+/, '/$1/:id');
}

/** A blocked URI reduced to its origin, or the CSP keyword (`inline`, `eval`). */
function blockedOrigin(uri: string): string {
  try {
    return new URL(uri).origin;
  } catch {
    return uri.slice(0, 40);
  }
}

function beacon(payload: Record<string, string | undefined>): void {
  const key = `${payload.kind}|${payload.type}|${payload.message}`;
  if (sent.has(key) || sent.size >= MAX_PER_PAGE) return;
  sent.add(key);
  // A beacon that cannot be delivered is dropped: reporting an error must never
  // raise another one, and the Worker logs every beacon it does receive.
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'omit',
    keepalive: true,
    body: JSON.stringify({ ...payload, route: route() }),
  }).catch(() => undefined);
}

function describe(value: unknown): { type: string; message: string; stack?: string } {
  if (value instanceof Error) return { type: value.name, message: value.message || value.name, stack: value.stack };
  return { type: typeof value, message: String(value).slice(0, 500) || typeof value };
}

window.addEventListener('error', (event) => {
  // Resource load failures do not bubble to window; this is a script error.
  const error = describe(event.error ?? event.message);
  beacon({ kind: 'browser_error', ...error, message: event.message || error.message });
});

window.addEventListener('unhandledrejection', (event) => {
  beacon({ kind: 'unhandled_rejection', ...describe(event.reason) });
});

document.addEventListener('securitypolicyviolation', (event) => {
  const blocked = blockedOrigin(event.blockedURI);
  beacon({
    kind: 'csp_violation',
    type: 'SecurityPolicyViolation',
    message: `${event.effectiveDirective} blocked ${blocked}`,
    directive: event.effectiveDirective,
    blocked,
  });
});
