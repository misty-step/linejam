import { describe, expect, it } from 'vitest';
import { WORD_COUNTS } from '@/convex/lib/gameRules';
import {
  buildInProgressChromeCopy,
  buildLobbyChromeCopy,
  buildRevealChromeCopy,
} from '@/lib/roomChromeCopy';

describe('roomChromeCopy', () => {
  it('builds lobby copy while the room still needs players', () => {
    expect(buildLobbyChromeCopy({ code: 'ABCD', playerCount: 1 })).toEqual({
      statusLabel: 'Lobby',
      title: 'Room open',
      subtitle: 'Share AB CD and gather 1 more poet before the first line.',
    });
  });

  it('builds assignment-led in-progress copy using the shared round invariant', () => {
    expect(
      buildInProgressChromeCopy({
        assignment: {
          lineIndex: 4,
          targetWordCount: 5,
        },
      })
    ).toEqual({
      statusLabel: 'In Progress',
      title: `Round 5 / ${WORD_COUNTS.length}`,
      subtitle:
        'Write exactly 5 words. You can only see the line before yours.',
    });
  });

  it('builds progress-led in-progress copy when the writer is waiting on the room', () => {
    expect(
      buildInProgressChromeCopy({
        roundProgress: {
          round: 2,
          players: [
            { submitted: true },
            { submitted: false },
            { submitted: true },
          ],
        },
      })
    ).toEqual({
      statusLabel: 'In Progress',
      title: `Round 3 / ${WORD_COUNTS.length}`,
      subtitle:
        '2 of 3 poets are ready. Hold the cadence while the room catches up.',
    });
  });

  it('builds reveal copy for both active reading and completed sessions', () => {
    expect(buildRevealChromeCopy({ allRevealed: false })).toEqual({
      statusLabel: 'Reading Phase',
      title: 'Reveal each poem in turn',
      subtitle:
        'One reader at a time. Let the room hear the full poem before moving on.',
    });

    expect(buildRevealChromeCopy({ allRevealed: true })).toEqual({
      statusLabel: 'Session Complete',
      title: 'The poems are unsealed',
      subtitle:
        'Return to the lobby, revisit the session, or head to the archive.',
    });
  });
});
