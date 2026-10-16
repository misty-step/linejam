import { expect, it, vi } from 'vitest';
import { signGuestToken, verifyGuestToken } from '@/lib/guestToken';

it('does not retain a failed key import across guest requests', async () => {
  const importKey = vi
    .spyOn(globalThis.crypto.subtle, 'importKey')
    .mockRejectedValueOnce(new Error('interrupted request'));
  try {
    await expect(signGuestToken('interrupted')).rejects.toThrow(
      'interrupted request'
    );
    const token = await signGuestToken('next-request');
    expect(await verifyGuestToken(token)).toBe('next-request');
  } finally {
    importKey.mockRestore();
  }
});
