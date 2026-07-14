/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import { probeSignedThrottleReady } from '@/scripts/convex/probe-signed-throttle-ready.mjs';

describe('probeSignedThrottleReady', () => {
  it('accepts the signed function rejecting a forged proof', async () => {
    const error = new ConvexError('Invalid guest session throttle proof');
    const mutate = vi.fn().mockRejectedValue(error);

    await expect(
      probeSignedThrottleReady('https://test.convex.cloud', mutate)
    ).resolves.toBe(true);
    expect(mutate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        key: 'guestSession:deployment-readiness',
        proof: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      })
    );
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
      probeSignedThrottleReady('https://test.convex.cloud', mutate)
    ).resolves.toBe(false);
  });

  it('surfaces transport failures', async () => {
    const failure = new Error('network unavailable');

    await expect(
      probeSignedThrottleReady(
        'https://test.convex.cloud',
        vi.fn().mockRejectedValue(failure)
      )
    ).rejects.toBe(failure);
  });

  it('requires an explicit deployment URL', async () => {
    await expect(probeSignedThrottleReady('', vi.fn())).rejects.toThrow(
      'NEXT_PUBLIC_CONVEX_URL is required'
    );
  });
});
