import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import { admitToRoom, type JoinRoom } from '@/lib/joinAdmission';
import { setErrorReporterForTests } from '@/lib/error';
import { sanitizeSentryReporterContext } from '@/lib/sentryPrivacy';
import {
  hashRoomId,
  resetCapturedAnalyticsForTests,
  setPostHogClientForTests,
  type PostHogCaptureClient,
} from '@/lib/analytics';
import {
  markPostHogReady,
  resetPostHogReady,
} from '@/lib/posthog/posthogReady';

const captured: Array<Parameters<PostHogCaptureClient['capture']>> = [];

const input = { code: 'ABCD', displayName: 'Ada', avatarId: 'quill' };
const joinRoom = vi.fn<JoinRoom>();
const navigate = vi.fn();
const captureException = vi.fn();
const current = () => true;

beforeEach(() => {
  vi.clearAllMocks();
  captured.length = 0;
  resetCapturedAnalyticsForTests();
  setPostHogClientForTests({
    capture: (event, properties) => {
      captured.push([event, properties]);
    },
  });
  markPostHogReady();
  joinRoom.mockResolvedValue({ ok: true, _id: 'room-1', currentCycle: 3 });
  setErrorReporterForTests({
    captureException,
    isEnabled: () => true,
    sanitizeContext: sanitizeSentryReporterContext,
  });
});
afterEach(() => {
  setErrorReporterForTests(null);
  resetPostHogReady();
  resetCapturedAnalyticsForTests();
});

describe('existing join service boundary', () => {
  it.each(['guest-token', null])(
    'keeps guest and account admission with token %s',
    async (token) => {
      expect(await admitToRoom(joinRoom, input, token, current, navigate)).toBe(
        ''
      );
      expect(joinRoom).toHaveBeenCalledExactlyOnceWith({
        ...input,
        guestToken: token || undefined,
      });
      expect(navigate).toHaveBeenCalledExactlyOnceWith('/room/ABCD');
      expect(captured).toEqual([
        ['join_attempted', undefined],
        ['game_joined', { roomIdHash: hashRoomId('room-1'), cycle: 3 }],
      ]);
      expect(captureException).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['ROOM_FULL', 'Room is full', /full.*8 players.*new room/i],
    ['ROOM_NOT_OPEN', 'Room is closed', /closed.*new room code/i],
    ['ROOM_NOT_OPEN', 'Room not found', /not found.*check the code/i],
    [
      'ROOM_NOT_OPEN',
      'Cannot join this game state',
      /already started.*next session/i,
    ],
  ])(
    'preserves expected %s recovery without reporting an incident',
    async (code, message, feedback) => {
      joinRoom.mockResolvedValueOnce({ ok: false, code, message });
      expect(
        await admitToRoom(joinRoom, input, 'guest-token', current, navigate)
      ).toMatch(feedback);
      expect(captured).toEqual([
        ['join_attempted', undefined],
        ['join_failed', { failureCode: code }],
      ]);
      expect(navigate).not.toHaveBeenCalled();
      expect(captureException).not.toHaveBeenCalled();
      expect(
        await admitToRoom(joinRoom, input, 'guest-token', current, navigate)
      ).toBe('');
      expect(navigate).toHaveBeenCalledOnce();
    }
  );

  it.each([
    [new ConvexError('Room is full'), /full.*new room/i],
    [
      new Error('Private database failure: write transaction 317'),
      /try again.*refresh/i,
    ],
  ])(
    'returns friendly feedback for thrown failure %s',
    async (cause, expected) => {
      joinRoom.mockRejectedValueOnce(cause);
      const feedback = await admitToRoom(
        joinRoom,
        input,
        'guest-token',
        current,
        navigate
      );
      expect(feedback).toMatch(expected);
      expect(feedback).not.toMatch(/private database|transaction 317/i);
      expect(captured).toEqual([
        ['join_attempted', undefined],
        ['join_failed', { failureCode: 'REQUEST_FAILED' }],
      ]);
      expect(navigate).not.toHaveBeenCalled();
      expect(captureException).toHaveBeenCalledTimes(
        cause instanceof ConvexError ? 0 : 1
      );
    }
  );

  it('does not navigate or count success for a detached or replaced identity', async () => {
    let active = true;
    const result = Promise.withResolvers<Awaited<ReturnType<JoinRoom>>>();
    joinRoom.mockReturnValueOnce(result.promise);
    const feedback = admitToRoom(
      joinRoom,
      input,
      'guest-token',
      () => active,
      navigate
    );
    active = false;
    result.resolve({ ok: true, _id: 'room-1' });
    expect(await feedback).toMatch(/session changed/i);
    expect(navigate).not.toHaveBeenCalled();
    expect(captured).toEqual([['join_attempted', undefined]]);
  });

  it('does not issue an unverified or invalid-avatar request', async () => {
    await admitToRoom(joinRoom, input, null, () => false, navigate);
    await admitToRoom(
      joinRoom,
      { ...input, avatarId: 'unknown' },
      null,
      current,
      navigate
    );
    expect(joinRoom).not.toHaveBeenCalled();
    expect(captured).toEqual([]);
  });
});
