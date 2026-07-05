/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { deriveClerkFrontendOrigin } from '@/scripts/lib/clerk-domain.mjs';

function keyFor(host: string, prefix = 'pk_test_'): string {
  return `${prefix}${Buffer.from(`${host}$`).toString('base64url')}`;
}

describe('deriveClerkFrontendOrigin', () => {
  it('decodes a dev key to its accounts.dev host', () => {
    expect(
      deriveClerkFrontendOrigin(keyFor('great-moose-1.clerk.accounts.dev'))
    ).toBe('https://great-moose-1.clerk.accounts.dev');
  });

  it('decodes a live key to a custom domain', () => {
    expect(
      deriveClerkFrontendOrigin(keyFor('clerk.linejam.app', 'pk_live_'))
    ).toBe('https://clerk.linejam.app');
  });

  it('returns empty string for an unset key', () => {
    expect(deriveClerkFrontendOrigin(undefined)).toBe('');
    expect(deriveClerkFrontendOrigin('')).toBe('');
  });

  it('returns empty string rather than a garbage origin for a non-Clerk-shaped string', () => {
    // base64url decoding rarely throws on arbitrary input -- this must not
    // silently "succeed" into control-character garbage (found via
    // linejam-909's doctor tests).
    expect(deriveClerkFrontendOrigin('not-a-real-key')).toBe('');
    expect(deriveClerkFrontendOrigin('totally bogus input !!!')).toBe('');
  });
});
