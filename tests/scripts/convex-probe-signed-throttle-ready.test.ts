/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import {
  assertSelectedDeploymentMatches,
  parseFunctionSpecDeploymentUrl,
  probeSignedThrottleReady,
} from '@/scripts/convex/probe-signed-throttle-ready.mjs';
import { signGuestSessionThrottleProof } from '@/lib/guestSessionThrottleProof';

const TEST_SECRET = 'test-guest-token-secret-with-enough-entropy';

describe('probeSignedThrottleReady', () => {
  it('accepts the signed function validating the real secret without writing', async () => {
    const mutate = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      probeSignedThrottleReady('https://test.convex.cloud', TEST_SECRET, mutate)
    ).resolves.toBe(true);

    const expectedProof = await signGuestSessionThrottleProof(
      'guestSession:deployment-readiness',
      TEST_SECRET
    );
    expect(mutate).toHaveBeenCalledWith(expect.anything(), {
      key: 'guestSession:deployment-readiness',
      proof: expectedProof,
      dryRun: true,
    });
  });

  it('surfaces a web and Convex secret mismatch', async () => {
    const mismatch = new ConvexError('Invalid guest session throttle proof');

    await expect(
      probeSignedThrottleReady(
        'https://test.convex.cloud',
        TEST_SECRET,
        vi.fn().mockRejectedValue(mismatch)
      )
    ).rejects.toBe(mismatch);
  });

  it('reports a stale deployment without swallowing the missing export', async () => {
    const mutate = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "Could not find public function for 'guestSessions:checkSignedGuestSessionThrottle'"
        )
      );

    await expect(
      probeSignedThrottleReady('https://test.convex.cloud', TEST_SECRET, mutate)
    ).resolves.toBe(false);
  });

  it('surfaces transport failures', async () => {
    const failure = new Error('network unavailable');

    await expect(
      probeSignedThrottleReady(
        'https://test.convex.cloud',
        TEST_SECRET,
        vi.fn().mockRejectedValue(failure)
      )
    ).rejects.toBe(failure);
  });

  it('requires an explicit deployment URL', async () => {
    await expect(
      probeSignedThrottleReady('', TEST_SECRET, vi.fn())
    ).rejects.toThrow('NEXT_PUBLIC_CONVEX_URL is required');
  });

  it('requires the web signing secret', async () => {
    await expect(
      probeSignedThrottleReady('https://test.convex.cloud', '', vi.fn())
    ).rejects.toThrow('GUEST_TOKEN_SECRET is required');
  });
});

describe('deployment identity verification', () => {
  it('accepts the production selector only when its public URL matches the web target', () => {
    const runner = vi.fn().mockReturnValue({
      status: 0,
      stdout: JSON.stringify({
        url: 'https://test.convex.cloud/',
        functions: [],
      }),
      stderr: '',
    });

    expect(
      assertSelectedDeploymentMatches(
        'https://test.convex.cloud',
        { ...process.env, CONVEX_DEPLOY_KEY: 'prod:test' },
        runner
      )
    ).toBe('https://test.convex.cloud');
    expect(runner).toHaveBeenCalledWith(
      'pnpm',
      ['exec', 'convex', 'function-spec', '--prod'],
      expect.objectContaining({ encoding: 'utf8' })
    );
  });

  it('fails closed when the selected production deployment is a sibling', () => {
    const runner = vi.fn().mockReturnValue({
      status: 0,
      stdout: JSON.stringify({
        url: 'https://sibling.convex.cloud',
        functions: [],
      }),
      stderr: 'must not be replayed',
    });

    expect(() =>
      assertSelectedDeploymentMatches(
        'https://test.convex.cloud',
        { ...process.env },
        runner
      )
    ).toThrow('does not match the production deployment');
  });

  it('parses only the public deployment URL from function-spec', () => {
    expect(
      parseFunctionSpecDeploymentUrl(
        JSON.stringify({ url: 'https://test.convex.cloud', functions: [] })
      )
    ).toBe('https://test.convex.cloud');
  });
});
