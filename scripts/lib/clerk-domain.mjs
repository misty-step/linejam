/**
 * Derive the Clerk Frontend API origin encoded in a publishable key.
 *
 * Clerk publishable keys are `pk_(test|live)_<base64url(frontendApiHost + "$")>`.
 * Decoding the trailing segment recovers the exact host Clerk serves clerk-js
 * and its Frontend API from. For a custom domain (e.g. `clerk.linejam.app`)
 * this is the only source of truth for that host — nothing else in env
 * encodes it.
 *
 * This is the canonical implementation. `next.config.ts` (CSP allowlist) and
 * `scripts/ci/bootstrap-convex-env.mjs` (Convex JWT issuer domain) both
 * derive from it, so a Clerk domain change can never silently diverge
 * between the two again (2026-07-04 outage: CSP hand-listed domains and
 * missed the production custom domain, blocking auth site-wide for ~16h
 * while preview smoke stayed green on the dev Clerk domain).
 *
 * @param {string | undefined | null} publishableKey
 * @returns {string} the origin (e.g. "https://clerk.linejam.app"), or '' if
 *   it cannot be derived (missing/malformed key).
 */
export function deriveClerkFrontendOrigin(publishableKey) {
  const key = publishableKey?.trim() ?? '';
  if (!key) return '';

  const encodedDomain = key.split('_').at(-1);
  if (!encodedDomain) return '';

  try {
    const decoded = Buffer.from(encodedDomain, 'base64url')
      .toString('utf8')
      .replace(/\$+$/, '');

    if (!decoded) return '';

    return decoded.startsWith('https://') ? decoded : `https://${decoded}`;
  } catch {
    return '';
  }
}
