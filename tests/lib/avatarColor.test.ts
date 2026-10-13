import { describe, it, expect } from 'vitest';
import { getUniqueColor, getStableId } from '@/lib/avatarColor';

describe('getUniqueColor', () => {
  it('returns unique colors for all users in room', () => {
    const allIds = ['alice', 'bob', 'charlie', 'diana'];
    const colors = allIds.map((id) => getUniqueColor(id, allIds));

    // All colors should be unique
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(allIds.length);
  });

  it('handles sorted order correctly', () => {
    // Order of allIds shouldn't affect result - internal sorting ensures consistency
    const ids1 = ['zebra', 'apple', 'mango'];
    const ids2 = ['mango', 'zebra', 'apple'];

    const color1 = getUniqueColor('apple', ids1);
    const color2 = getUniqueColor('apple', ids2);
    expect(color1).toBe(color2);
  });

  it('returns fallback when stableId not in list', () => {
    const allIds = ['user-1', 'user-2'];
    // Query for user not in the list
    const color = getUniqueColor('unknown-user', allIds);

    // Should still return a valid color (fallback branch)
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

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
