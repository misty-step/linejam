export type FunnelStage =
  | 'human_room'
  | 'game_started'
  | 'writing_completed'
  | 'all_revealed'
  | 'encore'
  | 'artifact_action';

export type FunnelSource = 'server-derived' | 'event-derived';

export type FunnelEvent = {
  event: string;
  occurredAt: number;
  roomIdHash: string;
  cycle: number;
  playerKind: 'human' | 'AI';
  round?: number;
  action?: 'share' | 'save';
};

export type RoomCycleSnapshot = {
  /** Internal join key. It is never returned by the report. */
  roomIdHash: string;
  createdAt: number;
  joins: Array<{
    joinedAt: number;
    playerKind: 'human' | 'AI';
    /** Stable server projection key; do not use a timestamp as identity. */
    participantKey?: string;
  }>;
  cycles: Array<{
    cycle: number;
    startedAt?: number;
    writingCompletedAt?: number;
    allRevealedAt?: number;
    completionKind?: 'normal' | 'abandoned';
  }>;
};

export type RoomCycleFunnelInput = {
  from: number;
  to: number;
  rooms: RoomCycleSnapshot[];
  events: FunnelEvent[];
};

type Metric = {
  count: number;
  rate: number;
  source: FunnelSource;
};

export type RoomCycleFunnelReport = {
  window: { from: string; to: string };
  cohort: { uniqueHumanRooms: number; source: 'server-derived' };
  metrics: {
    humanRoomsWithTwoPlusJoins: Metric;
    gameStarted: Metric;
    writingCompleted: Metric;
    allRevealed: Metric;
    encore: Metric;
    artifactAction: Metric;
  };
  timeToStartSeconds: {
    count: number;
    median: number | null;
    p90: number | null;
    source: 'server-derived';
  };
};

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function inWindow(timestamp: unknown, from: number, to: number) {
  return isFiniteTimestamp(timestamp) && timestamp >= from && timestamp < to;
}

function quantile(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil(percentile * sorted.length) - 1
  );
  return sorted[index];
}

function metric(
  count: number,
  denominator: number,
  source: FunnelSource
): Metric {
  return {
    count,
    rate: denominator === 0 ? 0 : Number((count / denominator).toFixed(4)),
    source,
  };
}

function earliestDefined(a?: number, b?: number) {
  if (isFiniteTimestamp(a) && isFiniteTimestamp(b)) return Math.min(a, b);
  return isFiniteTimestamp(a) ? a : b;
}

function mergeRooms(rooms: RoomCycleSnapshot[]) {
  const byRoom = new Map<string, RoomCycleSnapshot>();
  for (const room of rooms) {
    if (
      !room ||
      typeof room.roomIdHash !== 'string' ||
      room.roomIdHash.length === 0
    )
      continue;
    const previous = byRoom.get(room.roomIdHash);
    if (!previous) {
      byRoom.set(room.roomIdHash, {
        ...room,
        joins: [...(room.joins ?? [])],
        cycles: [...(room.cycles ?? [])],
      });
      continue;
    }
    previous.createdAt = Math.min(previous.createdAt, room.createdAt);
    previous.joins.push(...(room.joins ?? []));
    previous.cycles.push(...(room.cycles ?? []));
  }
  return [...byRoom.values()].map((room) => {
    const cyclesByNumber = new Map<
      number,
      RoomCycleSnapshot['cycles'][number]
    >();
    for (const cycle of room.cycles) {
      if (!Number.isInteger(cycle.cycle) || cycle.cycle < 1) continue;
      const previous = cyclesByNumber.get(cycle.cycle);
      if (!previous) {
        cyclesByNumber.set(cycle.cycle, { ...cycle });
        continue;
      }
      previous.startedAt = earliestDefined(previous.startedAt, cycle.startedAt);
      previous.writingCompletedAt = earliestDefined(
        previous.writingCompletedAt,
        cycle.writingCompletedAt
      );
      previous.allRevealedAt = earliestDefined(
        previous.allRevealedAt,
        cycle.allRevealedAt
      );
      if (previous.completionKind === undefined) {
        previous.completionKind = cycle.completionKind;
      }
    }
    return {
      ...room,
      cycles: [...cyclesByNumber.values()].sort((a, b) => a.cycle - b.cycle),
    };
  });
}

function uniqueHumanParticipants(room: RoomCycleSnapshot) {
  return new Set(
    room.joins
      .filter(
        (join) =>
          join.playerKind === 'human' &&
          typeof join.participantKey === 'string' &&
          join.participantKey.length > 0
      )
      .map((join) => join.participantKey as string)
  );
}

function validArtifactEvent(
  event: FunnelEvent,
  room: RoomCycleSnapshot,
  from: number,
  to: number
) {
  if (
    event.event !== 'artifact_action' ||
    event.playerKind !== 'human' ||
    (event.action !== 'share' && event.action !== 'save') ||
    !inWindow(event.occurredAt, from, to) ||
    !Number.isInteger(event.cycle) ||
    event.cycle < 1
  ) {
    return false;
  }
  if (
    event.round !== undefined &&
    (!Number.isInteger(event.round) || event.round < 0 || event.round > 8)
  ) {
    return false;
  }
  return room.cycles.some((cycle) => cycle.cycle === event.cycle);
}

/**
 * Build a counts-only room-cycle report from a bounded server projection and
 * PostHog events. Room keys, participant keys, poem text, and guest data are
 * used only in memory; none can appear in the returned report.
 *
 * The first cycle is the conversion journey. Later started cycles count only as
 * encore, so an abandoned rematch cannot retroactively make the first journey
 * look complete. Artifact actions remain event-derived and are joined to a
 * known room/cycle after strict validation and retry deduplication.
 */
export function buildRoomCycleFunnelReport(
  input: RoomCycleFunnelInput
): RoomCycleFunnelReport {
  if (!isFiniteTimestamp(input.from) || !isFiniteTimestamp(input.to)) {
    throw new Error('Funnel window bounds must be finite timestamps');
  }
  if (input.to <= input.from) {
    throw new Error('Funnel window end must be after its start');
  }

  const cohort = mergeRooms(input.rooms ?? []).filter((room) =>
    inWindow(room.createdAt, input.from, input.to)
  );
  const humanRooms = cohort.filter(
    (room) => uniqueHumanParticipants(room).size >= 2
  );
  const humanRoomKeys = new Set(humanRooms.map((room) => room.roomIdHash));
  const firstCycles = humanRooms.map((room) => room.cycles[0]);

  const started = firstCycles.filter((cycle) =>
    inWindow(cycle?.startedAt, input.from, input.to)
  );
  const writingCompleted = firstCycles.filter(
    (cycle) =>
      cycle?.completionKind !== 'abandoned' &&
      inWindow(cycle?.writingCompletedAt, input.from, input.to)
  );
  const allRevealed = firstCycles.filter(
    (cycle) =>
      cycle?.completionKind !== 'abandoned' &&
      inWindow(cycle?.allRevealedAt, input.from, input.to)
  );
  const encore = humanRooms.filter((room) =>
    room.cycles
      .slice(1)
      .some((cycle) => inWindow(cycle.startedAt, input.from, input.to))
  );
  const startDurations = started
    .map(
      (cycle, index) =>
        ((cycle!.startedAt as number) - humanRooms[index].createdAt) / 1000
    )
    .filter((seconds) => seconds >= 0 && Number.isFinite(seconds));

  const seenEvents = new Set<string>();
  const artifactRooms = new Set<string>();
  const roomsByKey = new Map(humanRooms.map((room) => [room.roomIdHash, room]));
  for (const event of input.events ?? []) {
    const room = roomsByKey.get(event.roomIdHash);
    if (!room || !validArtifactEvent(event, room, input.from, input.to))
      continue;
    const key = [
      event.event,
      event.roomIdHash,
      event.cycle,
      event.round ?? '',
      event.playerKind,
      event.action,
    ].join(':');
    if (seenEvents.has(key)) continue;
    seenEvents.add(key);
    artifactRooms.add(event.roomIdHash);
  }

  const denominator = humanRooms.length;
  return {
    window: {
      from: new Date(input.from).toISOString(),
      to: new Date(input.to).toISOString(),
    },
    cohort: { uniqueHumanRooms: denominator, source: 'server-derived' },
    metrics: {
      humanRoomsWithTwoPlusJoins: metric(
        denominator,
        denominator,
        'server-derived'
      ),
      gameStarted: metric(started.length, denominator, 'server-derived'),
      writingCompleted: metric(
        writingCompleted.length,
        denominator,
        'server-derived'
      ),
      allRevealed: metric(allRevealed.length, denominator, 'server-derived'),
      encore: metric(encore.length, denominator, 'server-derived'),
      artifactAction: metric(artifactRooms.size, denominator, 'event-derived'),
    },
    timeToStartSeconds: {
      count: startDurations.length,
      median: quantile(startDurations, 0.5),
      p90: quantile(startDurations, 0.9),
      source: 'server-derived',
    },
  };
}
