/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const fetchMock = vi.fn();

describe('canaryServer helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports enabled state from server or public keys', async () => {
    vi.stubEnv('CANARY_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', '');
    let canary = await import('@/lib/canaryServer');
    expect(canary.isCanaryEnabled()).toBe(false);

    vi.stubEnv('CANARY_API_KEY', 'sk_server');
    canary = await import('@/lib/canaryServer');
    expect(canary.isCanaryEnabled()).toBe(true);

    vi.stubEnv('CANARY_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', 'sk_public');
    canary = await import('@/lib/canaryServer');
    expect(canary.isCanaryEnabled()).toBe(true);
  });
});

describe('captureCanaryException (server)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('prefers server-side Canary credentials when available', async () => {
    vi.stubEnv('CANARY_API_KEY', 'sk_server_canary');
    vi.stubEnv('CANARY_ENDPOINT', 'https://server-canary.test/');
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', 'sk_public_canary');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', 'https://public-canary.test/');
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    const { captureCanaryException } = await import('@/lib/canaryServer');
    await captureCanaryException(new Error('server preferred'));

    expect(fetchMock).toHaveBeenCalledWith(
      'https://server-canary.test/api/v1/errors',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk_server_canary',
        }),
      })
    );
  });

  it('falls back to public Canary credentials when server creds are absent', async () => {
    vi.stubEnv('CANARY_API_KEY', '');
    vi.stubEnv('CANARY_ENDPOINT', '');
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', 'sk_public_canary');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', 'https://public-canary.test/');
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    const { captureCanaryException } = await import('@/lib/canaryServer');
    await captureCanaryException(new Error('public fallback'));

    expect(fetchMock).toHaveBeenCalledWith(
      'https://public-canary.test/api/v1/errors',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk_public_canary',
        }),
      })
    );
  });

  it('uses CANARY_ENVIRONMENT when provided', async () => {
    vi.stubEnv('CANARY_API_KEY', 'sk_server_canary');
    vi.stubEnv('CANARY_ENDPOINT', 'https://server-canary.test/');
    vi.stubEnv('CANARY_ENVIRONMENT', 'staging');
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    const { captureCanaryException } = await import('@/lib/canaryServer');
    await captureCanaryException(new Error('environment precedence'));

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as { environment: string };
    expect(body.environment).toBe('staging');
  });
});
