import { describe, expect, it, vi } from 'vitest';
import {
  resolveSentryRelease,
  validateSmokeBaseUrl,
} from '../../scripts/ops/resolve-sentry-release.mjs';

const RELEASE = 'a'.repeat(40);
const PREVIEW_HOST_PATTERN = '^linejam(?:-[a-z0-9-]+)+\\.ondigitalocean\\.app$';

function response(deploymentId: unknown, status = 200) {
  return new Response(
    JSON.stringify({ status: 'ok', deployment: { id: deploymentId } }),
    { status }
  );
}

describe('resolveSentryRelease', () => {
  it('reads the deployed commit from the allowlisted preview health receipt', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(RELEASE));

    await expect(
      resolveSentryRelease({
        baseUrl: 'https://linejam-pr-415.ondigitalocean.app',
        allowedOrigins: [],
        allowedHosts: [],
        allowedHostPattern: PREVIEW_HOST_PATTERN,
        fetchImpl,
      })
    ).resolves.toBe(RELEASE);

    expect(fetchImpl).toHaveBeenCalledWith(
      new URL('https://linejam-pr-415.ondigitalocean.app/api/health'),
      expect.objectContaining({
        headers: { accept: 'application/json' },
        redirect: 'error',
      })
    );
  });

  it('fails closed when the deployed receipt is absent or not a commit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response('master'));

    await expect(
      resolveSentryRelease({
        baseUrl: 'https://www.linejam.app',
        allowedOrigins: ['https://www.linejam.app'],
        allowedHosts: [],
        fetchImpl,
      })
    ).rejects.toThrow('no 40-character deployment commit');
  });

  it('rejects untrusted hosts before making a request', async () => {
    const fetchImpl = vi.fn();

    await expect(
      resolveSentryRelease({
        baseUrl: 'https://attacker.example',
        allowedOrigins: ['https://www.linejam.app'],
        allowedHosts: [],
        fetchImpl,
      })
    ).rejects.toThrow('untrusted origin');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('validateSmokeBaseUrl', () => {
  it.each([
    'http://www.linejam.app',
    'https://secret@www.linejam.app',
    'https://www.linejam.app:8443',
  ])('rejects unsafe release source %s', (baseUrl) => {
    expect(() =>
      validateSmokeBaseUrl(baseUrl, {
        allowedOrigins: ['https://www.linejam.app'],
      })
    ).toThrow('HTTPS origin without credentials or a port');
  });
});
