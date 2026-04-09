/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import {
  CONVEX_JWT_TEMPLATE_CLAIMS,
  CONVEX_JWT_TEMPLATE_NAME,
  ensureClerkConvexTemplate,
  isLiveClerkKey,
} from '@/scripts/ci/ensure-clerk-convex-template.mjs';

describe('isLiveClerkKey', () => {
  it('detects live Clerk publishable keys', () => {
    expect(isLiveClerkKey('pk_live_123')).toBe(true);
    expect(isLiveClerkKey(' pk_live_123 ')).toBe(true);
    expect(isLiveClerkKey('pk_test_123')).toBe(false);
    expect(isLiveClerkKey('')).toBe(false);
  });
});

describe('ensureClerkConvexTemplate', () => {
  it('skips when Clerk environment is missing', async () => {
    const fetchImpl = vi.fn();

    await expect(
      ensureClerkConvexTemplate({
        secretKey: '',
        publishableKey: '',
        fetchImpl,
      })
    ).resolves.toEqual({
      status: 'skipped',
      reason: 'missing-clerk-env',
    });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns present when the convex template already exists', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify([
            { id: 'jtmp_existing', name: CONVEX_JWT_TEMPLATE_NAME },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    await expect(
      ensureClerkConvexTemplate({
        secretKey: 'sk_test_123',
        publishableKey: 'pk_test_123',
        fetchImpl,
      })
    ).resolves.toEqual({
      status: 'present',
      templateId: 'jtmp_existing',
    });
  });

  it('creates the convex template for non-live keys when missing', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'jtmp_created' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    const logger: Pick<Console, 'log'> = { log: vi.fn() };

    await expect(
      ensureClerkConvexTemplate({
        secretKey: 'sk_test_123',
        publishableKey: 'pk_test_123',
        fetchImpl,
        logger,
      })
    ).resolves.toEqual({
      status: 'created',
      templateId: 'jtmp_created',
    });

    expect(fetchImpl).toHaveBeenLastCalledWith(
      'https://api.clerk.com/v1/jwt_templates',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk_test_123',
        }),
        body: JSON.stringify({
          name: CONVEX_JWT_TEMPLATE_NAME,
          claims: CONVEX_JWT_TEMPLATE_CLAIMS,
        }),
      })
    );
    expect(logger.log).toHaveBeenCalledWith(
      'Created Clerk JWT template "convex" for Convex auth.'
    );
  });

  it('fails fast in check-only mode when the template is missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(
      ensureClerkConvexTemplate({
        secretKey: 'sk_test_123',
        publishableKey: 'pk_test_123',
        checkOnly: true,
        fetchImpl,
      })
    ).rejects.toThrow('Clerk JWT template "convex" is missing.');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('treats identifier-exists conflicts as present after a retry', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [{ code: 'form_identifier_exists', message: 'taken' }],
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: 'jtmp_existing', name: CONVEX_JWT_TEMPLATE_NAME },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    await expect(
      ensureClerkConvexTemplate({
        secretKey: 'sk_test_123',
        publishableKey: 'pk_test_123',
        fetchImpl,
      })
    ).resolves.toEqual({
      status: 'present',
      templateId: 'jtmp_existing',
    });
  });

  it('refuses to mutate live Clerk instances without an explicit opt-in', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(
      ensureClerkConvexTemplate({
        secretKey: 'sk_live_123',
        publishableKey: 'pk_live_123',
        fetchImpl,
      })
    ).rejects.toThrow('Clerk JWT template "convex" is missing for a live key.');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
