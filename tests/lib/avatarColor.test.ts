import { describe, it, expect } from 'vitest';
import { getStableId } from '@/lib/avatarColor';

describe('getStableId', () => {
  it('prefers clerkUserId over guestId', () => {
    const result = getStableId('clerk-123', 'guest-456');
    expect(result).toBe('clerk-123');
  });

  it('uses guestId when clerkUserId is null', () => {
    const result = getStableId(null, 'guest-789');
    expect(result).toBe('guest-789');
  });

  it('uses guestId when clerkUserId is undefined', () => {
    const result = getStableId(undefined, 'guest-abc');
    expect(result).toBe('guest-abc');
  });

  it('returns "unknown" when both are null', () => {
    const result = getStableId(null, null);
    expect(result).toBe('unknown');
  });

  it('returns "unknown" when both are undefined', () => {
    const result = getStableId(undefined, undefined);
    expect(result).toBe('unknown');
  });
});
