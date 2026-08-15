import { describe, expect, it } from 'vitest';
import type { Id } from '../../convex/_generated/dataModel';
import { assignPoemReaders } from '../../convex/lib/assignPoemReaders';

const poemId = (value: string) => value as Id<'poems'>;
const userId = (value: string) => value as Id<'users'>;

describe('assignPoemReaders', () => {
  it('deterministically rotates round-zero assignments by one seat', () => {
    const poems = [
      { _id: poemId('poem-2'), indexInRoom: 2 },
      { _id: poemId('poem-0'), indexInRoom: 0 },
      { _id: poemId('poem-1'), indexInRoom: 1 },
    ];
    const roundZero = [userId('alice'), userId('bob'), userId('carol')];

    const first = assignPoemReaders(poems, roundZero);
    const second = assignPoemReaders([...poems].reverse(), roundZero);

    expect(first.get(poemId('poem-0'))).toBe(userId('bob'));
    expect(first.get(poemId('poem-1'))).toBe(userId('carol'));
    expect(first.get(poemId('poem-2'))).toBe(userId('alice'));
    expect(second).toEqual(first);
  });

  it('assigns neither player their own round-zero poem', () => {
    const assignments = assignPoemReaders(
      [
        { _id: poemId('left'), indexInRoom: 0 },
        { _id: poemId('right'), indexInRoom: 1 },
      ],
      [userId('left-author'), userId('right-author')]
    );

    expect(assignments.get(poemId('left'))).toBe(userId('right-author'));
    expect(assignments.get(poemId('right'))).toBe(userId('left-author'));
  });

  it('rejects fewer than two seats and poems outside the assignment row', () => {
    expect(() =>
      assignPoemReaders(
        [{ _id: poemId('only'), indexInRoom: 0 }],
        [userId('only')]
      )
    ).toThrow('Cannot assign readers with fewer than two players');

    expect(() =>
      assignPoemReaders(
        [{ _id: poemId('bad'), indexInRoom: 2 }],
        [userId('left'), userId('right')]
      )
    ).toThrow('Cannot assign reader for poem outside game seats');
  });
});
