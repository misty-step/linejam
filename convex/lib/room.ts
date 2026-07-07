import { ConvexError } from 'convex/values';
import { QueryCtx, MutationCtx } from '../_generated/server';
import { Doc, Id } from '../_generated/dataModel';
import { isPresenceStale } from './gameRules';

type RoomStatus = Doc<'rooms'>['status'];
type RoomActivityInput = Pick<Doc<'rooms'>, '_id' | 'status'>;
type HostCandidate = Pick<
  Doc<'roomPlayers'>,
  'userId' | 'seatIndex' | 'lastSeenAt'
>;

/**
 * Look up a room by its code (case-insensitive).
 * Returns null if not found.
 */
export async function getRoomByCode(
  ctx: QueryCtx | MutationCtx,
  code: string
): Promise<Doc<'rooms'> | null> {
  return await ctx.db
    .query('rooms')
    .withIndex('by_code', (q) => q.eq('code', code.toUpperCase()))
    .first();
}

/**
 * Get the active (IN_PROGRESS) game for a room.
 * Returns null if no active game (room is in lobby or between games).
 *
 * This is the authoritative source for "which game is active" -
 * avoids race conditions from mutable currentGameId pointer.
 */
export async function getActiveGame(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<'rooms'>
): Promise<Doc<'games'> | null> {
  return await ctx.db
    .query('games')
    .withIndex('by_room_status', (q) =>
      q.eq('roomId', roomId).eq('status', 'IN_PROGRESS')
    )
    .first();
}

/**
 * Get the most recently completed game for a room.
 * Used for reveal phase after game completion.
 */
export async function getCompletedGame(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<'rooms'>
): Promise<Doc<'games'> | null> {
  return await ctx.db
    .query('games')
    .withIndex('by_room_status', (q) =>
      q.eq('roomId', roomId).eq('status', 'COMPLETED')
    )
    .order('desc')
    .first();
}

function deriveIdleRoomStatus(room: Pick<Doc<'rooms'>, 'status'>): RoomStatus {
  return room.status === 'COMPLETED' ? 'COMPLETED' : 'LOBBY';
}

/**
 * Resolve the authoritative room activity view.
 * The room document owns idle state (`LOBBY` vs `COMPLETED`);
 * an active game is the only source that can override it.
 */
export async function getRoomActivity(
  ctx: QueryCtx | MutationCtx,
  room: RoomActivityInput
): Promise<{ activeGame: Doc<'games'> | null; status: RoomStatus }> {
  const activeGame = await getActiveGame(ctx, room._id);
  return {
    activeGame,
    status: activeGame ? 'IN_PROGRESS' : deriveIdleRoomStatus(room),
  };
}

export async function deriveRoomStatus(
  ctx: QueryCtx | MutationCtx,
  room: RoomActivityInput
): Promise<RoomStatus> {
  const { status } = await getRoomActivity(ctx, room);
  return status;
}

/**
 * Look up a room by its code or throw if not found.
 */
export async function requireRoomByCode(
  ctx: QueryCtx | MutationCtx,
  code: string
): Promise<Doc<'rooms'>> {
  const room = await getRoomByCode(ctx, code);
  if (!room) {
    throw new ConvexError('Room not found');
  }
  return room;
}

/**
 * Deterministic next-host rule (backlog 017): the present (non-stale) human
 * with the lowest `seatIndex`. Undefined seats sort last; ties break by userId
 * for stability. Returns null when no human is present — the room is fully away
 * and the abandonment path (never-let-the-room-die) owns completion instead.
 *
 * Callers pass already-human-filtered rows; AI players must never be hosts.
 */
export function selectNextHostId(
  humanPlayers: HostCandidate[],
  now: number,
  staleMs: number
): Id<'users'> | null {
  const present = humanPlayers.filter(
    (p) => !isPresenceStale(p.lastSeenAt, now, staleMs)
  );
  if (present.length === 0) return null;

  present.sort((a, b) => {
    const sa = a.seatIndex ?? Number.MAX_SAFE_INTEGER;
    const sb = b.seatIndex ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
  });
  return present[0].userId;
}

/**
 * If the room's host has gone presence-stale, promote the deterministic next
 * host (`selectNextHostId`) so host-only actions are never stranded. Idempotent
 * and safe to call on every heartbeat: it no-ops when the host is still present
 * (so it never demotes an active host) and when no present human can take over.
 * Returns the new host id when a migration happened, else null.
 *
 * Scoped to rooms with an active game ("while the game continues" — the ticket's
 * trigger). A gathering lobby has no agency to strand, and migrating there would
 * let a guest seize a room from a host who merely stepped away before kickoff;
 * once a game is running, every player is seated (startGame), so the next-host
 * rule is well-defined.
 */
export async function migrateHostIfStale(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  now: number,
  staleMs: number
): Promise<Id<'users'> | null> {
  const activeGame = await getActiveGame(ctx, room._id);
  if (!activeGame) return null;

  const hostRow = await ctx.db
    .query('roomPlayers')
    .withIndex('by_room_user', (q) =>
      q.eq('roomId', room._id).eq('userId', room.hostUserId)
    )
    .first();

  // Only migrate away from a host we have positive evidence has left: a missing
  // row (they left entirely) or a heartbeat that has since gone stale. A host
  // who has never heartbeat (undefined lastSeenAt) is "present-unknown", not
  // gone — treating it as stale would let a guest steal host from a freshly
  // created room before the host's first heartbeat lands.
  const hostHasLeft =
    !hostRow ||
    (hostRow.lastSeenAt !== undefined &&
      isPresenceStale(hostRow.lastSeenAt, now, staleMs));
  if (!hostHasLeft) return null;

  const players = await ctx.db
    .query('roomPlayers')
    .withIndex('by_room', (q) => q.eq('roomId', room._id))
    .collect();
  const users = await Promise.all(players.map((p) => ctx.db.get(p.userId)));
  const humanPlayers = players.filter((_, i) => users[i]?.kind !== 'AI');

  const nextHostId = selectNextHostId(humanPlayers, now, staleMs);
  if (!nextHostId || nextHostId === room.hostUserId) return null;

  await ctx.db.patch(room._id, { hostUserId: nextHostId });
  return nextHostId;
}
