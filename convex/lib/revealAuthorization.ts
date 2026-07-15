import type { Doc, Id } from '../_generated/dataModel';
import { PRESENCE_AWAY_MS, isPresenceStale } from './gameRules';
import { selectNextHostId } from './room';

export type RevealAuthorityReason =
  'assigned-reader' | 'host-fallback' | 'participant-fallback';

export interface RevealParticipant {
  userId: Id<'users'>;
  seatIndex?: number;
  lastSeenAt?: number;
  isHuman: boolean;
}

export interface RevealAuthority {
  userId: Id<'users'>;
  reason: RevealAuthorityReason;
}

export function buildRevealParticipants(
  players: readonly Pick<
    Doc<'roomPlayers'>,
    'userId' | 'seatIndex' | 'lastSeenAt'
  >[],
  users: readonly (Pick<Doc<'users'>, 'kind'> | null)[]
): RevealParticipant[] {
  return players.map((player, index) => ({
    userId: player.userId,
    seatIndex: player.seatIndex,
    lastSeenAt: player.lastSeenAt,
    isHuman: users[index]?.kind !== 'AI',
  }));
}

/**
 * Select the one participant whose device may take over an unrevealed poem.
 * A fresh assigned reader always wins. Once that reader is away, a fresh host
 * wins; otherwise the lowest-seat fresh human is the deterministic fallback.
 * No fresh humans means no authority until somebody returns and heartbeats.
 */
export function selectRevealAuthority(
  participants: readonly RevealParticipant[],
  assignedReaderId: Id<'users'> | undefined,
  hostUserId: Id<'users'>,
  now: number,
  staleMs = PRESENCE_AWAY_MS
): RevealAuthority | null {
  const humans = participants.filter((participant) => participant.isHuman);
  const assignedReader = humans.find(
    (participant) => participant.userId === assignedReaderId
  );

  if (
    assignedReader &&
    !isPresenceStale(assignedReader.lastSeenAt, now, staleMs)
  ) {
    return { userId: assignedReader.userId, reason: 'assigned-reader' };
  }

  const host = humans.find((participant) => participant.userId === hostUserId);
  if (host && !isPresenceStale(host.lastSeenAt, now, staleMs)) {
    return { userId: host.userId, reason: 'host-fallback' };
  }

  const fallbackId = selectNextHostId(humans, now, staleMs);
  return fallbackId
    ? { userId: fallbackId, reason: 'participant-fallback' }
    : null;
}
