import { ConvexError } from 'convex/values';
import { isAvatarId, type AvatarId } from './avatars';
import { captureError } from './error';
import { errorToFeedback } from './errorFeedback';
import { toErrorReportable } from './errorCore';
import {
  hashRoomId,
  trackGameJoined,
  trackJoinAttempted,
  trackJoinFailed,
} from './analytics';
import { playSound } from './audio';

export type JoinRoom = (args: {
  code: string;
  displayName: string;
  avatarId: AvatarId;
  guestToken?: string;
}) => Promise<
  | { ok: true; _id: string; currentCycle?: number }
  | { ok: false; code: string; message: string }
>;

// Existing service/telemetry boundary, not a second form state machine. Rust
// owns validation, pending/retry and presentation. Never return raw exceptions.
export async function admitToRoom(
  joinRoom: JoinRoom,
  input: { code: string; displayName: string; avatarId: string },
  guestToken: string | null,
  isCurrent: () => boolean,
  navigate: (href: string) => void
): Promise<string> {
  if (!isAvatarId(input.avatarId) || !isCurrent())
    return 'Your session changed. Please try again.';
  trackJoinAttempted();
  try {
    const room = await joinRoom({
      ...input,
      avatarId: input.avatarId,
      guestToken: guestToken || undefined,
    });
    if (!isCurrent()) return 'Your session changed. Please try again.';
    if (room.ok === false) {
      trackJoinFailed(room.code);
      playSound('error');
      return errorToFeedback(new ConvexError(room.message)).message;
    }
    trackGameJoined({
      roomIdHash: hashRoomId(room._id),
      cycle: room.currentCycle ?? 1,
    });
    playSound('sparkle');
    navigate(`/room/${input.code}`);
    return '';
  } catch (cause) {
    if (!isCurrent()) return 'Your session changed. Please try again.';
    trackJoinFailed('REQUEST_FAILED');
    playSound('error');
    const error = toErrorReportable(cause);
    captureError(error, { roomCode: input.code });
    return errorToFeedback(error).message;
  }
}
