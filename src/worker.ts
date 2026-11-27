import { CODE_ALPHABET, CODE_LENGTH, isRoomCode, normalizeCode } from '../shared/rules.ts';
import type { ShareKind } from './archive.ts';
import { guestCookie, presentedToken, requireGuest, requireSecret, shouldRenew, signGuestToken, verifyGuestToken } from './auth.ts';
import type { Env } from './env.ts';
import { Reject, failure, json, randomInt, unwrap, type Result } from './http.ts';

export { ArchiveDO } from './archive.ts';
export { LinejamBackend } from './legacy-vault.ts';
export { RoomDO } from './room.ts';

const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

/** Client-rendered pages. Anything else that is not an asset or an API route is a 404. */
const PAGES = [/^\/$/, /^\/join$/, /^\/room\/[^/]+$/, /^\/poems$/, /^\/poem\/[^/]+$/, /^\/recap\/[^/]+$/, /^\/account$/];

function secured(response: Response): Response {
  if (response.status === 101) return response;
  const out = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) out.headers.set(name, value);
  return out;
}

function randomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

function roomCode(raw: string): string {
  const code = normalizeCode(decodeURIComponent(raw));
  if (!isRoomCode(code)) throw new Reject(404, 'room_not_found', 'Room code not found');
  return code;
}

async function body(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    throw new Reject(415, 'bad_request', 'Expected application/json');
  }
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new Reject(400, 'bad_request', 'Malformed JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Reject(400, 'bad_request', 'Expected a JSON object');
  }
  return parsed as Record<string, unknown>;
}

function send<T>(result: Result<T>, status = 200): Response {
  return json(unwrap(result), status);
}

async function api(request: Request, env: Env, url: URL): Promise<Response> {
  const now = Date.now();
  const method = request.method;
  const path = url.pathname.slice('/api'.length);
  const segments = path.split('/').filter(Boolean);
  const is = (m: string, ...shape: (string | null)[]) =>
    method === m && segments.length === shape.length && shape.every((part, i) => part === null || part === segments[i]);

  if (is('GET', 'health')) {
    requireSecret(env.GUEST_TOKEN_SECRET);
    return json({ status: 'ok', environment: env.LINEJAM_ENVIRONMENT ?? 'unknown' });
  }

  // A cross-site page cannot drive a player's session.
  if (method !== 'GET') {
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) throw new Reject(403, 'cross_origin', 'Cross-origin request refused');
  }

  const archive = () => env.ARCHIVE.get(env.ARCHIVE.idFromName('archive'));
  const room = (code: string) => env.ROOM.get(env.ROOM.idFromName(code));

  // ── guest identity ──
  if (is('POST', 'guest')) {
    const secret = requireSecret(env.GUEST_TOKEN_SECRET);
    const input = await body(request);
    const presented = presentedToken(request);
    if (presented && input.fresh !== true) {
      // A presented credential is either honored or refused. It is never
      // silently replaced by a different writer.
      const identity = await verifyGuestToken(secret, presented, now);
      const token = shouldRenew(identity, now) ? await signGuestToken(secret, identity.guestId, now) : presented;
      return json({ guestId: identity.guestId, token }, 200, { 'set-cookie': guestCookie(request, token) });
    }
    const guestId = crypto.randomUUID();
    const token = await signGuestToken(secret, guestId, now);
    return json({ guestId, token }, 201, { 'set-cookie': guestCookie(request, token) });
  }
  if (is('GET', 'guest')) {
    // Asking "who am I" is not an error for a first-time visitor: the answer is
    // a 200 that says none, ready, or invalid (so the browser can show recovery).
    if (!presentedToken(request)) return json({ status: 'none', guestId: null });
    let identity;
    try {
      identity = await requireGuest(request, env.GUEST_TOKEN_SECRET, now);
    } catch (error) {
      if (error instanceof Reject && error.code === 'guest_invalid') return json({ status: 'invalid', guestId: null });
      throw error;
    }
    const headers: Record<string, string> = {};
    if (shouldRenew(identity, now) && !request.headers.get('authorization')) {
      headers['set-cookie'] = guestCookie(request, await signGuestToken(requireSecret(env.GUEST_TOKEN_SECRET), identity.guestId, now));
    }
    return json({ status: 'ready', guestId: identity.guestId }, 200, headers);
  }

  // ── public reads through a share link (no identity needed) ──
  const shareToken = url.searchParams.get('share');
  if (is('GET', 'poems', null) || is('GET', 'recaps', null)) {
    // A reader with no credential, or a lapsed one, is simply not a participant.
    const guestId = await requireGuest(request, env.GUEST_TOKEN_SECRET, now).then(
      (identity) => identity.guestId,
      (error: unknown) => {
        if (error instanceof Reject && error.status === 401) return null;
        throw error;
      }
    );
    const id = decodeURIComponent(segments[1]!);
    return segments[0] === 'poems'
      ? send(await archive().poem({ guestId, poemId: id, shareToken }))
      : send(await archive().recap({ guestId, gameId: id, shareToken }));
  }

  // ── operator import of pre-recompile data ──
  if (is('POST', 'admin', 'import')) {
    const key = env.LINEJAM_ADMIN_KEY;
    const given = request.headers.get('authorization');
    if (!key || key.length < 32 || given !== `Bearer ${key}`) throw new Reject(401, 'unauthorized', 'Unauthorized');
    return json(await archive().importLegacy(await body(request)));
  }

  const { guestId } = await requireGuest(request, env.GUEST_TOKEN_SECRET, now);

  // ── rooms ──
  if (is('POST', 'rooms')) {
    const input = await body(request);
    for (let tries = 0; tries < 12; tries++) {
      const code = randomCode();
      const result = await room(code).create({ code, guestId, penName: input.penName, emblem: input.emblem });
      if (!result.ok && result.code === 'code_taken') continue;
      return send(result, 201);
    }
    throw new Reject(503, 'no_code_available', 'Try again');
  }
  if (segments[0] === 'rooms' && segments[1]) {
    const code = roomCode(segments[1]);
    const stub = room(code);
    if (is('GET', 'rooms', null)) {
      const since = url.searchParams.get('v');
      const view = unwrap(await stub.state({ guestId, since: since === null ? null : Number(since) }));
      return view === null ? new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } }) : json(view);
    }
    if (is('GET', 'rooms', null, 'ws')) {
      if (request.headers.get('upgrade') !== 'websocket') throw new Reject(426, 'bad_request', 'Expected a WebSocket');
      const headers = new Headers(request.headers);
      headers.set('x-linejam-guest', guestId);
      return stub.fetch(new Request(request, { headers }));
    }
    if (is('GET', 'rooms', null, 'assignment')) return send(await stub.assignment({ guestId }));
    if (method === 'POST' && segments.length === 3) {
      const input = await body(request);
      switch (segments[2]) {
        case 'join':
          return send(await stub.join({ guestId, penName: input.penName, emblem: input.emblem }));
        case 'start':
          return send(await stub.start({ guestId }));
        case 'lines':
          return send(await stub.submit({ guestId, poemId: input.poemId, lineIndex: input.lineIndex, text: input.text }));
        case 'reveal':
          return send(await stub.reveal({ guestId, poemId: input.poemId }));
        case 'end':
          return send(await stub.endGame({ guestId }));
        case 'lobby':
          return send(await stub.toLobby({ guestId }));
        case 'close':
          return send(await stub.close({ guestId }));
        case 'leave':
          return send(await stub.leave({ guestId }));
      }
    }
  }

  // ── archive, favorites, sharing ──
  if (is('GET', 'poems')) return send(await archive().list({ guestId }));
  if (is('GET', 'favorites')) return send(await archive().favorites({ guestId }));
  const kind: ShareKind | null = segments[0] === 'poems' ? 'poem' : segments[0] === 'recaps' ? 'recap' : null;
  if (kind && segments[1] && method !== 'GET') {
    const id = decodeURIComponent(segments[1]);
    if (kind === 'poem' && is('POST', 'poems', null, 'favorite')) {
      const input = await body(request);
      const on = typeof input.on === 'boolean' ? input.on : null;
      const token = typeof input.share === 'string' ? input.share : null;
      return send(await archive().setFavorite({ guestId, poemId: id, on, shareToken: token }));
    }
    if (is('POST', segments[0]!, null, 'share')) {
      await body(request);
      return send(await archive().beginShare({ guestId, kind, id }), 201);
    }
    if (is('POST', segments[0]!, null, 'share', 'confirm')) {
      const input = await body(request);
      return send(await archive().confirmShare({ guestId, kind, id, token: input.token }));
    }
    if (is('POST', segments[0]!, null, 'share', 'cancel')) {
      const input = await body(request);
      return send(await archive().cancelShare({ guestId, token: input.token }));
    }
    if (is('DELETE', segments[0]!, null, 'share')) return send(await archive().revokeShare({ guestId, kind, id }));
  }

  throw new Reject(404, 'not_found', 'Not found');
}

async function page(request: Request, env: Env, url: URL): Promise<Response> {
  const shell = async (status: number) => {
    const asset = await env.ASSETS.fetch(new Request(new URL('/index.html', url), { headers: request.headers }));
    // A conditional request may answer 304; a page with a non-200 status always carries the body.
    if (status === 200 && asset.status === 304) return asset;
    const full = asset.status === 200 ? asset : await env.ASSETS.fetch(new URL('/index.html', url));
    const headers = new Headers(full.headers);
    headers.set('cache-control', 'no-cache');
    if (status !== 200) {
      headers.delete('etag');
      headers.set('x-robots-tag', 'noindex');
    }
    return new Response(full.body, { status, headers });
  };

  if (!PAGES.some((pattern) => pattern.test(url.pathname))) {
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;
    // Includes the retired /changelog, /releases and /releases.xml.
    return request.method === 'GET' && (request.headers.get('accept') ?? '').includes('text/html')
      ? shell(404)
      : new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  // A page reached through a share link gets the same access decision as the
  // poem: an inactive link is a not-found page, decided before any HTML leaves.
  const share = url.searchParams.get('share');
  const shared = /^\/(poem|recap)\/([^/]+)$/.exec(url.pathname);
  if (shared && share !== null) {
    const active = await env.ARCHIVE.get(env.ARCHIVE.idFromName('archive')).shareIsActive({
      kind: shared[1] as ShareKind,
      id: decodeURIComponent(shared[2]!),
      token: share,
    });
    if (!active) return shell(404);
  }
  return shell(200);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        return secured(await api(request, env, url));
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return secured(new Response('Method not allowed', { status: 405 }));
      }
      return secured(await page(request, env, url));
    } catch (error) {
      if (error instanceof Reject) {
        const response = failure(error);
        // A refused credential is cleared so the browser can recover on purpose.
        if (error.code === 'guest_invalid' && !request.headers.get('authorization')) {
          response.headers.set('x-linejam-guest', 'invalid');
        }
        return secured(response);
      }
      console.error(JSON.stringify({ app: 'linejam', event: 'unhandled_error', name: (error as Error)?.name ?? 'Error' }));
      return secured(json({ error: { code: 'internal', message: 'Something went wrong. Try again' } }, 500));
    }
  },
} satisfies ExportedHandler<Env>;

