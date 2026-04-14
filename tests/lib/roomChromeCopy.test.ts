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
      title: 'Need 1 more player',
      subtitle: 'Share AB CD to start.',
    });
  });

  it('builds lobby copy when enough players are ready', () => {
    expect(buildLobbyChromeCopy({ code: 'ABCD', playerCount: 3 })).toEqual({
      statusLabel: 'Lobby',
      title: '3 players ready',
      subtitle: 'Start when you are ready.',
    });
  });

  it('pluralizes the lobby prompt when the room is empty', () => {
    expect(buildLobbyChromeCopy({ code: 'ABCD', playerCount: 0 })).toEqual({
      statusLabel: 'Lobby',
      title: 'Need 2 more players',
      subtitle: 'Share AB CD to start.',
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
      statusLabel: 'Writing',
      title: `Round 5 of ${WORD_COUNTS.length}`,
      subtitle: 'Write exactly 5 words. You only see the previous line.',
    });
  });

  it('uses the singular word copy for the opening round assignment', () => {
    const copy = buildInProgressChromeCopy({
      assignment: {
        lineIndex: 0,
        targetWordCount: 1,
      },
    });

    expect(copy.subtitle).toBe(
      'Write exactly 1 word. You only see the previous line.'
    );
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
      statusLabel: 'Waiting',
      title: `Round 3 of ${WORD_COUNTS.length}`,
      subtitle: '2 of 3 ready.',
    });
  });

  it('falls back to a loading state when neither assignment nor progress exists', () => {
    expect(buildInProgressChromeCopy({})).toEqual({
      statusLabel: 'Writing',
      title: 'Writing',
      subtitle: 'Loading the next step.',
    });
  });

  it('builds reveal copy for both active reading and completed sessions', () => {
    expect(buildRevealChromeCopy({ allRevealed: false })).toEqual({
      statusLabel: 'Reveal',
      title: 'Reveal poems',
      subtitle: 'Read one poem at a time.',
    });

    expect(buildRevealChromeCopy({ allRevealed: true })).toEqual({
      statusLabel: 'Done',
      title: 'All poems revealed',
      subtitle: 'Start again, open the archive, or leave the room.',
    });
  });
});
