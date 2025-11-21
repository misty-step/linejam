import { describe, it, expect } from 'vitest';
import { formatRoomCode } from '../lib/roomCode';

describe('formatRoomCode', () => {
  it('formats 4-char legacy codes with space', () => {
    expect(formatRoomCode('ABCD')).toBe('AB CD');
  });

  it('formats 6-char codes with spaces', () => {
    expect(formatRoomCode('ABCDEF')).toBe('AB CD EF');
  });

  it('preserves alphanumeric characters', () => {
    expect(formatRoomCode('AB12CD')).toBe('AB 12 CD');
    expect(formatRoomCode('XY99')).toBe('XY 99');
  });
});
