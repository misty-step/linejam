/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { buildStaticEvidenceEnv } from '@/scripts/evidence/static-server.mjs';

describe('static evidence server env', () => {
  it('bypasses the Convex guest-session throttle check', () => {
    const env = buildStaticEvidenceEnv({} as unknown as NodeJS.ProcessEnv);

    expect(env.LINEJAM_ALLOW_UNSYNCED_CONVEX_THROTTLE).toBe('1');
  });

  it('defaults PORT to 3340 without clobbering an explicit PORT', () => {
    expect(
      buildStaticEvidenceEnv({} as unknown as NodeJS.ProcessEnv).PORT
    ).toBe('3340');
    expect(
      buildStaticEvidenceEnv({ PORT: '4001' } as unknown as NodeJS.ProcessEnv)
        .PORT
    ).toBe('4001');
  });

  it('strips ambient Canary credentials so no ingest call can fire', () => {
    const env = buildStaticEvidenceEnv({
      CANARY_API_KEY: 'leaked-server-key',
      NEXT_PUBLIC_CANARY_API_KEY: 'leaked-public-key',
      CANARY_ENDPOINT: 'http://127.0.0.1:4000',
    } as unknown as NodeJS.ProcessEnv);

    expect(env.CANARY_API_KEY).toBeUndefined();
    expect(env.NEXT_PUBLIC_CANARY_API_KEY).toBeUndefined();
  });

  it('leaves unrelated env untouched', () => {
    const env = buildStaticEvidenceEnv({
      NODE_ENV: 'production',
      PATH: '/usr/bin',
    } as unknown as NodeJS.ProcessEnv);

    expect(env.NODE_ENV).toBe('production');
    expect(env.PATH).toBe('/usr/bin');
  });
});
