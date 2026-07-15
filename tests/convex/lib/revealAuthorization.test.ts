import { describe, expect, it } from 'vitest';
import type { Id } from '../../../convex/_generated/dataModel';
import { PRESENCE_AWAY_MS } from '../../../convex/lib/gameRules';
import { selectRevealAuthority } from '../../../convex/lib/revealAuthorization';

const userId = (value: string) => value as Id<'users'>;
const now = 1_000_000;
const fresh = now;
const stale = now - PRESENCE_AWAY_MS - 1;

describe('selectRevealAuthority', () => {
  it('keeps a fresh assigned reader in control', () => {
    expect(
      selectRevealAuthority(
        [
          {
            userId: userId('host'),
            seatIndex: 0,
            lastSeenAt: fresh,
            isHuman: true,
          },
          {
            userId: userId('reader'),
            seatIndex: 1,
            lastSeenAt: fresh,
            isHuman: true,
          },
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
          {
            userId: userId('host'),
            seatIndex: 2,
            lastSeenAt: fresh,
            isHuman: true,
          },
          {
            userId: userId('reader'),
            seatIndex: 0,
            lastSeenAt: stale,
            isHuman: true,
          },
          {
            userId: userId('other'),
            seatIndex: 1,
            lastSeenAt: fresh,
            isHuman: true,
          },
        ],
        userId('reader'),
        userId('host'),
        now
      )
    ).toEqual({ userId: userId('host'), reason: 'host-fallback' });
  });

  it('chooses the lowest-seat fresh human when reader and host are stale', () => {
    expect(
      selectRevealAuthority(
        [
          {
            userId: userId('host'),
            seatIndex: 0,
            lastSeenAt: stale,
            isHuman: true,
          },
          {
            userId: userId('reader'),
            seatIndex: 1,
            lastSeenAt: stale,
            isHuman: true,
          },
          {
            userId: userId('later'),
            seatIndex: 3,
            lastSeenAt: fresh,
            isHuman: true,
          },
          {
            userId: userId('winner'),
            seatIndex: 2,
            lastSeenAt: fresh,
            isHuman: true,
          },
          {
            userId: userId('bot'),
            seatIndex: -1,
            lastSeenAt: fresh,
            isHuman: false,
          },
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

  it('waits when every human is stale', () => {
    expect(
      selectRevealAuthority(
        [
          {
            userId: userId('host'),
            seatIndex: 0,
            lastSeenAt: stale,
            isHuman: true,
          },
          {
            userId: userId('reader'),
            seatIndex: 1,
            lastSeenAt: stale,
            isHuman: true,
          },
        ],
        userId('reader'),
        userId('host'),
        now
      )
    ).toBeNull();
  });
});
