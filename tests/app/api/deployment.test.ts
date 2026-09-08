/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/deployment/route';
import { APP_VERSION } from '@/lib/appVersion';

describe('/api/deployment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns only the current values-free deployment receipt', async () => {
    vi.stubEnv('NEXT_DEPLOYMENT_ID', '  release-abc123  ');

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      version: APP_VERSION,
      deployment: { id: 'release-abc123' },
    });
  });

  it('retains the semantic version when no deployment identifier is configured', async () => {
    vi.stubEnv('NEXT_DEPLOYMENT_ID', '');

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      version: APP_VERSION,
      deployment: { id: null },
    });
  });
});
