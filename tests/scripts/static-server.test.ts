/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { buildStaticEvidenceEnv } from '@/scripts/evidence/static-server.mjs';
const testEnv: NodeJS.ProcessEnv = { NODE_ENV: 'test' };

describe('static evidence server env', () => {
  it('bypasses the Convex guest-session throttle check', () => {
    const env = buildStaticEvidenceEnv(testEnv);

    expect(env.LINEJAM_ALLOW_UNSYNCED_CONVEX_THROTTLE).toBe('1');
  });

  it('defaults PORT to 3340 without clobbering an explicit PORT', () => {
    expect(buildStaticEvidenceEnv(testEnv).PORT).toBe('3340');
    expect(buildStaticEvidenceEnv({ ...testEnv, PORT: '4001' }).PORT).toBe(
      '4001'
    );
  });

  it('strips ambient Sentry credentials so no ingest call can fire', () => {
    const env = buildStaticEvidenceEnv({
      ...testEnv,
      LINEJAM_SENTRY_ENABLED: 'true',
      NEXT_PUBLIC_SENTRY_DSN: ['https://public', 'example.test/42'].join('@'),
      NEXT_PUBLIC_SENTRY_ENABLED: '1',
    });

    expect(env.LINEJAM_SENTRY_ENABLED).toBeUndefined();
    expect(env.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
    expect(env.NEXT_PUBLIC_SENTRY_ENABLED).toBeUndefined();
  });

  it('leaves unrelated env untouched', () => {
    const env = buildStaticEvidenceEnv({
      NODE_ENV: 'production',
      PATH: '/usr/bin',
    });

    expect(env.NODE_ENV).toBe('production');
    expect(env.PATH).toBe('/usr/bin');
  });
});
