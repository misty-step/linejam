import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getUserList = vi.fn();
const createUser = vi.fn();
const createClerkClient = vi.fn(() => ({
  users: {
    getUserList,
    createUser,
  },
}));

vi.mock('@clerk/backend', () => ({
  createClerkClient,
}));

vi.mock('@clerk/testing/playwright', () => ({
  clerk: {
    signIn: vi.fn(),
  },
}));

describe('ensureClerkSmokeUser', () => {
  const originalSecretKey = process.env.CLERK_SECRET_KEY;
  const originalPublishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  const originalNextPublishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  beforeEach(() => {
    vi.resetModules();
    getUserList.mockReset();
    createUser.mockReset();
    createClerkClient.mockClear();
  });

  afterEach(() => {
    if (originalSecretKey === undefined) {
      delete process.env.CLERK_SECRET_KEY;
    } else {
      process.env.CLERK_SECRET_KEY = originalSecretKey;
    }

    if (originalPublishableKey === undefined) {
      delete process.env.CLERK_PUBLISHABLE_KEY;
    } else {
      process.env.CLERK_PUBLISHABLE_KEY = originalPublishableKey;
    }

    if (originalNextPublishableKey === undefined) {
      delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    } else {
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
        originalNextPublishableKey;
    }
  });

  it('auto-provisions the smoke user for non-live Clerk keys', async () => {
    getUserList.mockResolvedValueOnce({ data: [] });
    createUser.mockResolvedValueOnce({ id: 'user_123' });

    const { ensureClerkSmokeUser } = await import('@/tests/e2e/support/clerk');

    await expect(
      ensureClerkSmokeUser('sk_test_example', 'smoke@example.com')
    ).resolves.toBeUndefined();

    expect(createClerkClient).toHaveBeenCalledWith({
      secretKey: 'sk_test_example',
    });
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAddress: ['smoke@example.com'],
      })
    );
  }, 30000);

  it('refuses to auto-provision a missing live smoke user', async () => {
    getUserList.mockResolvedValueOnce({ data: [] });

    const { ensureClerkSmokeUser } = await import('@/tests/e2e/support/clerk');

    await expect(
      ensureClerkSmokeUser('sk_live_example', 'smoke@example.com')
    ).rejects.toThrow(/Refusing to auto-provision Clerk smoke user/);

    expect(createUser).not.toHaveBeenCalled();
  });

  it('allows an existing live smoke user without provisioning', async () => {
    getUserList.mockResolvedValueOnce({ data: [{ id: 'user_live' }] });

    const { ensureClerkSmokeUser } = await import('@/tests/e2e/support/clerk');

    await expect(
      ensureClerkSmokeUser('sk_live_example', 'smoke@example.com')
    ).resolves.toBeUndefined();

    expect(createUser).not.toHaveBeenCalled();
  });

  it('clears the cached provisioning promise after a failure so retries can recover', async () => {
    getUserList
      .mockRejectedValueOnce(new Error('temporary clerk failure'))
      .mockResolvedValueOnce({ data: [{ id: 'user_retry' }] });

    const { ensureClerkSmokeUser } = await import('@/tests/e2e/support/clerk');

    await expect(
      ensureClerkSmokeUser('sk_test_example', 'smoke@example.com')
    ).rejects.toThrow(/temporary clerk failure/);

    await expect(
      ensureClerkSmokeUser('sk_test_example', 'smoke@example.com')
    ).resolves.toBeUndefined();

    expect(getUserList).toHaveBeenCalledTimes(2);
  });
});
