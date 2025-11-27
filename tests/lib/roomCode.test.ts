import { describe, it, expect } from 'vitest';
import { formatRoomCode } from '@/lib/roomCode';

describe('formatRoomCode', () => {
  it('formats 4-letter code with space', () => {
    // Arrange & Act
    const result = formatRoomCode('ABCD');

    // Assert
    expect(result).toBe('AB CD');
  });

  it('formats 6-letter code with spaces', () => {
    // Arrange & Act
    const result = formatRoomCode('ABCDEF');

    // Assert
    expect(result).toBe('AB CD EF');
  });

  it('handles odd-length codes', () => {
    // Arrange & Act
    const result = formatRoomCode('ABC');

    // Assert
    expect(result).toBe('AB C');
  });

  it('returns original code when match fails (empty string)', () => {
    // Arrange & Act
    const result = formatRoomCode('');

    // Assert
    expect(result).toBe('');
  });

  it('handles single character', () => {
    // Arrange & Act
    const result = formatRoomCode('A');

    // Assert
    expect(result).toBe('A');
  });
});
