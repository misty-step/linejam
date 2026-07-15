/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/deployment/route';

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
      deployment: { id: 'release-abc123' },
    });
  });

  it('returns a null receipt when the build is unversioned', async () => {
    vi.stubEnv('NEXT_DEPLOYMENT_ID', '');

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      deployment: { id: null },
    });
  });
});
