import { describe, it, expect } from 'vitest';
import {
  getUniqueColor,
  getUserColor,
  getStableId,
  type AvatarColor,
} from '@/lib/avatarColor';

describe('getUserColor', () => {
  it('returns consistent color for same input', () => {
    const color1 = getUserColor('user-123');
    const color2 = getUserColor('user-123');
    expect(color1).toBe(color2);
  });

  it('returns a valid hex color from palette', () => {
    const color = getUserColor('test-user');
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('returns different colors for different users', () => {
    const colors = new Set<AvatarColor>();
    // Generate colors for many users to check distribution
    for (let i = 0; i < 100; i++) {
      colors.add(getUserColor(`user-${i}`));
    }
    // Should use multiple colors from palette (12 colors available)
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe('getUniqueColor', () => {
  it('returns consistent color for same user in same room', () => {
    const allIds = ['user-1', 'user-2', 'user-3'];
    const color1 = getUniqueColor('user-2', allIds);
    const color2 = getUniqueColor('user-2', allIds);
    expect(color1).toBe(color2);
  });

  it('returns unique colors for all users in room', () => {
    const allIds = ['alice', 'bob', 'charlie', 'diana'];
    const colors = allIds.map((id) => getUniqueColor(id, allIds));

    // All colors should be unique
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(allIds.length);
  });

  it('resolves collision by shifting to next color', () => {
    // Create users that would hash to same index
    // We can't control hashing, but with enough users, collisions happen
    const manyUsers = Array.from({ length: 15 }, (_, i) => `player-${i}`);
    const colors = manyUsers.map((id) => getUniqueColor(id, manyUsers));

    // With 15 users and 12-color palette, collisions are guaranteed
    // All colors should still be unique (collision resolution works)
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(12); // Limited by palette size
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
