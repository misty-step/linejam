// Error capture ([L1-8]): unhandled Worker and Durable Object exceptions and
// scrubbed browser beacons go to Sentry as one lean Envelope HTTP POST — no
// SDK, no dependency. Every event is scrubbed here, before it leaves the
// Worker ([L1-8.6], [L1-4.10]). With no DSN bound, forwarding is a no-op
// ([L1-8.7]); `/api/health` reports `sentryConfigured` so that state is visible.
import { CODE_ALPHABET, CODE_LENGTH } from '../shared/rules.ts';
import type { Env } from './env.ts';
import { RELEASE } from './generated/release.ts';

export { RELEASE };

export type ErrorKind = 'worker_exception' | 'browser_error' | 'unhandled_rejection' | 'csp_violation';
export const BROWSER_KINDS: ReadonlySet<string> = new Set(['browser_error', 'unhandled_rejection', 'csp_violation']);

/** What is known about one error, before scrubbing. */
export interface Capture {
  kind: ErrorKind;
  type: string;
  message: string;
  stack?: string;
  route?: string;
  method?: string;
  status?: number;
  directive?: string;
  blocked?: string;
}

interface SentryTarget {
  endpoint: string;
  key: string;
}

export function environment(env: Env): string {
  return env.LINEJAM_ENVIRONMENT ?? 'unknown';
}

/** The bound DSN, if any. `SENTRY_DSN` wins over `NEXT_PUBLIC_SENTRY_DSN`. */
function boundDsn(env: Env): string | null {
  return env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN || null;
}

/** `scheme://<key>@<host>[/<prefix>]/<project>` → the project's envelope endpoint. */
export function parseDsn(dsn: string): SentryTarget | null {
  let url: URL;
  try {
    url = new URL(dsn);
  } catch {
    return null;
  }
  const path = url.pathname.replace(/\/+$/, '');
  const project = path.slice(path.lastIndexOf('/') + 1);
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.username || !/^\d+$/.test(project)) return null;
  const prefix = path.slice(0, path.lastIndexOf('/'));
  return { endpoint: `${url.protocol}//${url.host}${prefix}/api/${project}/envelope/`, key: url.username };
}

function target(env: Env): SentryTarget | null {
  const dsn = boundDsn(env);
  if (!dsn) return null;
  const parsed = parseDsn(dsn);
  if (!parsed) console.error(JSON.stringify({ app: 'linejam', event: 'sentry_dsn_invalid' }));
  return parsed;
}

/** True when a valid DSN is bound. Never the DSN itself. */
export function sentryConfigured(env: Env): boolean {
  const dsn = boundDsn(env);
  return dsn !== null && parseDsn(dsn) !== null;
}

// ───────────────────────── scrubbing ─────────────────────────

const ROOM_CODE = new RegExp(`(?<![A-Za-z0-9])[${CODE_ALPHABET}]{${CODE_LENGTH}}(?![A-Za-z0-9])`, 'g');

/**
 * Removes everything [L1-8.6] forbids from free text: query strings and
 * fragments (share slugs), path identifiers, room codes, guest cookies and
 * bearer tokens, token-shaped strings and email addresses. Bounded length.
 */
export function scrub(text: string, max = 500): string {
  return text
    .replace(/linejam_guest_token=[^;\s"'`]*/gi, 'linejam_guest_token=[token]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [token]')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
    .replace(/[?#][^\s"'`<>)]*/g, '')
    .replace(/\/(rooms?|poems?|recaps?)\/[^/\s"'`<>)]+/gi, '/$1/:id')
    .replace(/[A-Za-z0-9_-]{24,}(?:\.[A-Za-z0-9_-]{16,})?/g, '[token]')
    .replace(ROOM_CODE, '[code]')
    .slice(0, max);
}

/** A page or API path as a route template: identifiers and the query never leave. */
export function route(pathname: string): string {
  return scrub(pathname.split(/[?#]/)[0] ?? '', 120);
}

/** V8 stack text → Sentry frames, oldest call first. */
function frames(stack: string): { function?: string; filename: string; lineno?: number; colno?: number }[] {
  const out = [];
  for (const line of stack.split('\n').slice(0, 40)) {
    const match = /^\s*at (?:(.+?) \()?(.+?)(?::(\d+))?(?::(\d+))?\)?$/.exec(line);
    if (!match) continue;
    const [, fn, file, lineno, colno] = match;
    out.push({
      ...(fn ? { function: scrub(fn, 120) } : {}),
      filename: scrub(file!, 200),
      ...(lineno ? { lineno: Number(lineno) } : {}),
      ...(colno ? { colno: Number(colno) } : {}),
    });
  }
  return out.reverse();
}

function eventId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

/** The Sentry event for one capture: tagged, scrubbed, and nothing else. */
export function sentryEvent(env: Env, capture: Capture): Record<string, unknown> {
  const tags: Record<string, string> = {
    kind: capture.kind,
    environment: environment(env),
    release: RELEASE,
  };
  const path = capture.route ? route(capture.route) : undefined;
  if (path) tags.route = path;
  if (capture.method) tags.method = capture.method.slice(0, 10).toUpperCase();
  if (capture.status) tags.status = String(capture.status);
  if (capture.directive) tags.directive = scrub(capture.directive, 60);
  if (capture.blocked) tags.blocked = scrub(capture.blocked, 120);
  const stack = capture.stack ? frames(capture.stack) : [];
  return {
    event_id: eventId(),
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    logger: capture.kind === 'worker_exception' ? 'worker' : 'browser',
    environment: tags.environment,
    release: RELEASE,
    ...(path ? { transaction: path } : {}),
    tags,
    exception: {
      values: [
        {
          type: scrub(capture.type, 80) || 'Error',
          value: scrub(capture.message),
          ...(stack.length ? { stacktrace: { frames: stack } } : {}),
        },
      ],
    },
  };
}

export function envelope(event: Record<string, unknown>): string {
  const header = { event_id: event.event_id, sent_at: new Date().toISOString() };
  return `${JSON.stringify(header)}\n${JSON.stringify({ type: 'event', content_type: 'application/json' })}\n${JSON.stringify(event)}\n`;
}

/**
 * Records one error: an anonymous structured log line always, and a Sentry
 * event when a DSN is bound. Never throws; an unavailable sink never blocks
 * play. Callers hand the promise to `waitUntil` (or await it in an alarm).
 */
export async function report(env: Env, capture: Capture): Promise<void> {
  console.error(
    JSON.stringify({
      app: 'linejam',
      event: 'error_captured',
      kind: capture.kind,
      type: scrub(capture.type, 80),
      ...(capture.status ? { status: capture.status } : {}),
    })
  );
  const sentry = target(env);
  if (!sentry) return;
  try {
    const response = await fetch(sentry.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-sentry-envelope',
        'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${sentry.key}, sentry_client=linejam-worker/1.0`,
      },
      body: envelope(sentryEvent(env, capture)),
    });
    if (!response.ok) {
      console.error(JSON.stringify({ app: 'linejam', event: 'sentry_forward_failed', status: response.status }));
    }
    await response.body?.cancel();
  } catch (error) {
    console.error(
      JSON.stringify({ app: 'linejam', event: 'sentry_forward_failed', name: (error as Error)?.name ?? 'Error' })
    );
  }
}

/** An exception thrown inside the Worker or a Durable Object, as a capture. */
export function exceptionCapture(error: unknown, at: { route?: string; method?: string; status: number }): Capture {
  const known = error instanceof Error ? error : null;
  return {
    kind: 'worker_exception',
    type: known?.name ?? typeof error,
    message: known?.message ?? String(error),
    ...(known?.stack ? { stack: known.stack } : {}),
    ...at,
  };
}

// ───────────────────────── browser beacons ─────────────────────────

export const BEACON_MAX_BYTES = 8192;
const BEACON_WINDOW_MS = 60_000;
const BEACON_LIMIT = 30;
let beaconWindow = { start: 0, count: 0 };

/** At most BEACON_LIMIT browser beacons per minute per isolate are forwarded. */
export function beaconAllowed(now: number): boolean {
  if (now - beaconWindow.start >= BEACON_WINDOW_MS) beaconWindow = { start: now, count: 0 };
  beaconWindow.count++;
  return beaconWindow.count <= BEACON_LIMIT;
}

export function resetBeaconWindow(): void {
  beaconWindow = { start: 0, count: 0 };
}

const text = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value ? value.slice(0, max) : undefined;

/** A browser beacon, validated against an allow-list of fields, or null. */
export function beaconCapture(input: Record<string, unknown>): Capture | null {
  const kind = input.kind;
  const message = text(input.message, 2000);
  if (typeof kind !== 'string' || !BROWSER_KINDS.has(kind) || !message) return null;
  const optional = {
    stack: text(input.stack, 4000),
    route: text(input.route, 300),
    directive: kind === 'csp_violation' ? text(input.directive, 100) : undefined,
    blocked: kind === 'csp_violation' ? text(input.blocked, 300) : undefined,
  };
  return {
    kind: kind as ErrorKind,
    type: text(input.type, 100) ?? 'Error',
    message,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
  };
}
