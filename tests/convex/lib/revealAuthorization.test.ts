import { describe, expect, it } from 'vitest';
import type { Id } from '../../../convex/_generated/dataModel';
import {
  getRevealAuthorityForParticipant,
  selectRevealAuthority,
} from '../../../convex/lib/revealAuthorization';

// SAFETY: Branded ID fixture for pure unit test of in-memory reveal authority resolution.
const userId = (value: string) => value as Id<'users'>;
const now = 100_000;
const fresh = now - 1;
const stale = 1;

describe('selectRevealAuthority', () => {
  it('keeps a fresh assigned reader in control', () => {
    expect(
      selectRevealAuthority(
        [
          { userId: userId('host'), seatIndex: 0, lastSeenAt: fresh },
          { userId: userId('reader'), seatIndex: 1, lastSeenAt: fresh },
        ],
        userId('reader'),
        userId('host'),
        now
      )
    ).toEqual({ userId: userId('reader'), reason: 'assigned-reader' });
  });

  it('gives a fresh host first fallback when the reader is stale', () => {
    expect(
      selectRevealAuthority(
        [
          { userId: userId('host'), seatIndex: 2, lastSeenAt: fresh },
          { userId: userId('reader'), seatIndex: 0, lastSeenAt: stale },
        ],
        userId('reader'),
        userId('host'),
        now
      )
    ).toEqual({ userId: userId('host'), reason: 'host-fallback' });
  });

  it('chooses the lowest-seat fresh participant when reader and host are stale', () => {
    expect(
      selectRevealAuthority(
        [
          { userId: userId('host'), seatIndex: 0, lastSeenAt: stale },
          { userId: userId('reader'), seatIndex: 1, lastSeenAt: stale },
          { userId: userId('later'), seatIndex: 3, lastSeenAt: fresh },
          { userId: userId('winner'), seatIndex: 2, lastSeenAt: fresh },
        ],
        userId('reader'),
        userId('host'),
        now
      )
    ).toEqual({
      userId: userId('winner'),
      reason: 'participant-fallback',
    });
  });

  it('waits when every participant is stale', () => {
    expect(
      selectRevealAuthority(
        [
          { userId: userId('host'), seatIndex: 0, lastSeenAt: stale },
          { userId: userId('reader'), seatIndex: 1, lastSeenAt: stale },
        ],
        userId('reader'),
        userId('host'),
        now
      )
    ).toBeNull();
  });
});

describe('getRevealAuthorityForParticipant', () => {
  it('allows only a verified participant to advance an archive without live presence', () => {
    const archive = {
      participants: [
        { userId: userId('reader'), seatIndex: 0 },
        { userId: userId('author'), seatIndex: 1 },
      ],
      assignedReaderId: userId('reader'),
      hostUserId: userId('reader'),
      roomClosedAt: 0,
      now,
    };

    expect(
      getRevealAuthorityForParticipant({
        ...archive,
        participantUserId: userId('author'),
      })
    ).toEqual({ userId: userId('author'), reason: 'archive-participant' });
    expect(
      getRevealAuthorityForParticipant({
        ...archive,
        participantUserId: null,
      })
    ).toBeNull();
  });
});
