import { afterEach, describe, expect, it, vi } from 'vitest';
import { GUEST_COOKIE, GUEST_TOKEN_TTL_MS, signGuestToken, verifyGuestToken } from '../../src/auth.ts';
import { measurement } from '../../src/measure.ts';
import { call, guest, party, state } from './helpers.ts';

afterEach(() => {
  vi.useRealTimers();
});

const SECRET = 'local-test-guest-secret-0123456789abcdef';

describe('[L1-2.3] signed guest credentials', () => {
  it('mints a signed credential as an HttpOnly cookie that survives refresh', async () => {
    const minted = await call('POST', '/api/guest');
    expect(minted.status).toBe(201);
    const cookie = minted.headers.get('set-cookie')!;
    expect(cookie).toContain(`${GUEST_COOKIE}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    const pair = cookie.split(';')[0]!;
    // "Refresh": the same cookie yields the same identity, not a new writer.
    const again = await call('POST', '/api/guest', { headers: { cookie: pair } });
    expect(again.status).toBe(200);
    expect(again.body.guestId).toBe(minted.body.guestId);
    const me = await call('GET', '/api/guest', { headers: { cookie: pair } });
    expect(me.body).toEqual({ status: 'ready', guestId: minted.body.guestId });
    // A first-time visitor is not an error.
    expect((await call('GET', '/api/guest')).body).toEqual({ status: 'none', guestId: null });
  });

  it('refuses a tampered, foreign-signed or expired credential instead of silently creating a writer', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const player = await guest();
    const [payload, signature] = player.token.split('.') as [string, string];
    const forgedPayload = btoa(JSON.stringify({ guestId: 'someone-else', issuedAt: Date.now() })).replace(/=/g, '');
    const foreign = await signGuestToken('another-secret-another-secret-another', player.guestId, Date.now());
    for (const bad of [`${forgedPayload}.${signature}`, `${payload}.AAAA`, foreign, 'garbage', `${payload}`]) {
      const reply = await call('GET', '/api/guest', { token: bad });
      expect(reply.body).toEqual({ status: 'invalid', guestId: null });
      const refused = await call('GET', '/api/poems', { token: bad });
      expect(refused.status).toBe(401);
      expect(refused.body.error.code).toBe('guest_invalid');
      // Bootstrap with a refused credential shows recovery; it does not mint.
      const boot = await call('POST', '/api/guest', { token: bad });
      expect(boot.status).toBe(401);
      expect(boot.headers.get('set-cookie')).toBeNull();
    }
    // Recovery is an explicit choice.
    const fresh = await call('POST', '/api/guest', { token: 'garbage', body: { fresh: true } });
    expect(fresh.status).toBe(201);
    expect(fresh.body.guestId).not.toBe(player.guestId);

    vi.setSystemTime(Date.now() + GUEST_TOKEN_TTL_MS + 1000);
    expect((await call('GET', '/api/guest', { token: player.token })).body.status).toBe('invalid');
  });

  it('renews a credential in use and keeps the identity', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const player = await guest();
    vi.setSystemTime(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const renewed = await call('POST', '/api/guest', { token: player.token });
    expect(renewed.status).toBe(200);
    expect(renewed.body.guestId).toBe(player.guestId);
    expect(renewed.body.token).not.toBe(player.token);
    vi.setSystemTime(Date.now() + 6 * 24 * 60 * 60 * 1000);
    expect((await call('GET', '/api/guest', { token: player.token })).body.status).toBe('invalid');
    expect((await call('GET', '/api/guest', { token: renewed.body.token })).body.status).toBe('ready');
  });

  it('honors a credential in the pre-recompile format and cookie name', async () => {
    // The legacy app issued base64url(JSON{guestId, issuedAt}).base64url(HMAC-SHA256) in `linejam_guest_token`.
    const issuedAt = Date.now() - 60_000;
    const payload = btoa(JSON.stringify({ guestId: 'legacy-guest-1', issuedAt })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
    const signature = btoa(String.fromCharCode(...mac)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const legacy = `${payload}.${signature}`;
    expect(await verifyGuestToken(SECRET, legacy, Date.now())).toEqual({ guestId: 'legacy-guest-1', issuedAt });
    const me = await call('GET', '/api/guest', { headers: { cookie: `linejam_guest_token=${legacy}` } });
    expect(me.body).toEqual({ status: 'ready', guestId: 'legacy-guest-1' });
  });

  it('refuses cross-origin writes and non-JSON bodies', async () => {
    const { code, players } = await party(2);
    const cross = await call('POST', `/api/rooms/${code}/start`, { token: players[0]!.token, headers: { origin: 'https://evil.example' } });
    expect(cross.status).toBe(403);
    const form = await call('POST', `/api/rooms/${code}/start`, { token: players[0]!.token, headers: { 'content-type': 'text/plain' } });
    expect(form.status).toBe(415);
    expect((await state(code, players[0]!)).body.phase).toBe('lobby');
  });
});

describe('[L1-4.10] anonymous measurement', () => {
  it('emits only bounded fields: no names, ids, codes, text or URLs', () => {
    expect(measurement('game_started', { writers: 4 })).toEqual({ app: 'linejam', event: 'game_started', writers: 4 });
    expect(measurement('join_rejected', { reason: 'room_full' })).toEqual({ app: 'linejam', event: 'join_rejected', reason: 'room_full' });
    // An unexpected reason is bucketed, never passed through.
    expect(measurement('join_rejected', { reason: 'ABCD is full for Ada' }).reason).toBe('other');
    const leaked = { penName: 'Ada', code: 'ABCD', guestId: 'g', text: 'poem' } as never;
    expect(Object.keys(measurement('line_submitted', leaked)).sort()).toEqual(['app', 'event']);
  });
});
