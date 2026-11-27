import { Reject } from './http.ts';

// Guest credentials keep the format the pre-recompile app issued
// (`base64url(JSON{guestId, issuedAt}) . base64url(HMAC-SHA256)`), the same
// secret name and the same cookie name, so a browser holding a valid legacy
// credential keeps its identity, seats and archive after the recompile.

export const GUEST_COOKIE = 'linejam_guest_token';
export const GUEST_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

export interface GuestIdentity {
  guestId: string;
  issuedAt: number;
}

function b64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromB64url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function requireSecret(secret: string | undefined): string {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Reject(503, 'service_unconfigured', 'Guest credentials are not configured');
  }
  return secret;
}

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function signGuestToken(secret: string, guestId: string, issuedAt: number): Promise<string> {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ guestId, issuedAt })));
  const signature = await crypto.subtle.sign('HMAC', await key(secret), new TextEncoder().encode(payload));
  return `${payload}.${b64url(new Uint8Array(signature))}`;
}

export async function verifyGuestToken(secret: string, token: string, now: number): Promise<GuestIdentity> {
  const invalid = new Reject(401, 'guest_invalid', 'Session expired');
  const parts = token.split('.');
  if (parts.length !== 2) throw invalid;
  const [payload, signature] = parts as [string, string];
  let sigBytes: Uint8Array<ArrayBuffer>;
  let parsed: unknown;
  try {
    sigBytes = fromB64url(signature);
    const ok = await crypto.subtle.verify('HMAC', await key(secret), sigBytes, new TextEncoder().encode(payload));
    if (!ok) throw invalid;
    parsed = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
  } catch {
    throw invalid;
  }
  const { guestId, issuedAt } = (parsed ?? {}) as Partial<GuestIdentity>;
  if (typeof guestId !== 'string' || !guestId || typeof issuedAt !== 'number') throw invalid;
  if (now - issuedAt > GUEST_TOKEN_TTL_MS) throw invalid;
  return { guestId, issuedAt };
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export function guestCookie(request: Request, token: string): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${GUEST_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${GUEST_TOKEN_TTL_MS / 1000}${secure}`;
}

/** The credential a request presents: `Authorization: Bearer` (CLI, MCP) or the browser cookie. */
export function presentedToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;
  return readCookie(request, GUEST_COOKIE);
}

export async function requireGuest(request: Request, secret: string | undefined, now: number): Promise<GuestIdentity> {
  const token = presentedToken(request);
  if (!token) throw new Reject(401, 'guest_required', 'Guest session required');
  return verifyGuestToken(requireSecret(secret), token, now);
}

export function shouldRenew(identity: GuestIdentity, now: number): boolean {
  return now - identity.issuedAt > RENEW_AFTER_MS;
}
