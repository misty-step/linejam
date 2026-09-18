import { describe, expect, it } from "vitest";
import * as Schema from "effect/Schema";
import {
  AVATAR_DESCRIPTORS,
  DEFAULT_PRESENCE_POLICY,
  HARD_DEADLINE_MS,
  MAX_SEATS,
  RoomCode,
  RoomId,
  PlayerId,
  MatchId,
  Cycle,
  DisplayName,
  SeatIndex,
  TimestampMs,
  abandonMatchEnvelope,
  allocateRoomCode,
  allocateSeat,
  avatarForSeat,
  classifyPresence,
  completeMatchEnvelope,
  decideBeginMatch,
  eligibleMembersForCycle,
  nextCycle,
  normalizeDisplayName,
  parseRoomCode,
  roomCodeFromBytes,
  selectMatchParticipants,
  selectNextHost,
  snapshotParticipants,
  type ActiveMatchEnvelope,
  type MatchEnvelope,
  type MatchParticipant,
  type Room,
  type RoomMember,
} from "../src/index.js";

function make<A>(schema: Schema.Schema<A>, input: unknown): A {
  return Schema.decodeUnknownSync(schema)(input);
}

const roomId = (value: string): RoomId => make(RoomId, value);
const playerId = (value: string): PlayerId => make(PlayerId, value);
const matchId = (value: string): MatchId => make(MatchId, value);
const cycle = (value: number): Cycle => make(Cycle, value);
const seat = (value: number): SeatIndex => make(SeatIndex, value);
const timestamp = (value: number): TimestampMs => make(TimestampMs, value);
const displayName = (value: string): DisplayName => make(DisplayName, value);

function member(
  id: string,
  seatIndex: number,
  joinedAt = 0,
  eligibleFromCycle = 1,
  lastSeenAt?: number,
): RoomMember {
  const base = {
    roomId: roomId("room"),
    playerId: playerId(id),
    displayName: displayName(id),
    seatIndex: seat(seatIndex),
    joinedAt: timestamp(joinedAt),
    eligibleFromCycle: cycle(eligibleFromCycle),
  };
  return lastSeenAt === undefined ? base : { ...base, lastSeenAt: timestamp(lastSeenAt) };
}

function room(host = "host"): Room {
  return {
    id: roomId("room"),
    code: make(RoomCode, "ABCD"),
    hostPlayerId: playerId(host),
    createdAt: timestamp(0),
  };
}

function activeMatch(id = "match", cycleNumber = 1): ActiveMatchEnvelope {
  return {
    status: "active",
    id: matchId(id),
    roomId: roomId("room"),
    cycle: cycle(cycleNumber),
    startedAt: timestamp(100),
  };
}

describe("core boundaries", () => {
  it("normalizes room codes and display names", () => {
    const code = parseRoomCode("  abcd ");
    expect(code).toEqual({ ok: true, value: make(RoomCode, "ABCD") });

    const name = normalizeDisplayName("  Ａda   Lovelace  ");
    expect(name).toEqual({ ok: true, value: make(DisplayName, "Ada Lovelace") });
    expect(normalizeDisplayName("   ").ok).toBe(false);
    expect(parseRoomCode("AB10").ok).toBe(false);
  });

  it("uses unbiased byte conversion and reports exhausted allocation", async () => {
    const code = roomCodeFromBytes(new Uint8Array([0, 31, 32, 63]));
    expect(code.ok && code.value).toBe("2Z2Z");

    const unavailable = await allocateRoomCode({
      maxAttempts: 2,
      randomBytes: () => new Uint8Array([0, 1, 2, 3]),
      isAvailable: () => false,
    });
    expect(unavailable).toEqual({
      ok: false,
      error: { _tag: "RoomCodeExhausted", attempts: 2 },
    });

    let checks = 0;
    const allocated = await allocateRoomCode({
      maxAttempts: 3,
      randomBytes: () => new Uint8Array([0, 1, 2, 3]),
      isAvailable: () => (checks += 1) === 2,
    });
    expect(allocated.ok).toBe(true);
    expect(checks).toBe(2);
  });
});

describe("seating and cycles", () => {
  it("allocates the lowest gap and reports a full room", () => {
    const gap = allocateSeat([seat(0), seat(2), seat(3)]);
    expect(gap.ok && gap.value).toBe(1);

    const full = allocateSeat(Array.from({ length: MAX_SEATS }, (_, index) => seat(index)));
    expect(full).toEqual({ ok: false, error: { _tag: "RoomFull", capacity: 12 } });
  });

  it("calculates the next cycle and leaves eligibility presence-independent", () => {
    const matches: MatchEnvelope[] = [
      { ...activeMatch("one", 2) },
      {
        status: "completed",
        id: matchId("two"),
        roomId: roomId("room"),
        cycle: cycle(5),
        startedAt: timestamp(0),
        completedAt: timestamp(10),
      },
    ];
    const next = nextCycle({ matches });
    expect(next.ok && next.value).toBe(6);
    expect(nextCycle({ matches: [{ cycle: Number.MAX_SAFE_INTEGER }] })).toMatchObject({
      ok: false,
      error: { _tag: "InvalidInput", field: "matches" },
    });
    const members = [member("eligible", 0, 0, 3), member("queued", 1, 0, 7)];
    expect(
      eligibleMembersForCycle({ members, cycle: cycle(3) }).map((item) => item.playerId),
    ).toEqual([playerId("eligible")]);
  });

  it("snapshots eligible present players in stable seat order", () => {
    const snapshot = snapshotParticipants({
      matchId: matchId("match"),
      cycle: cycle(1),
      members: [member("zulu", 3, 0, 1), member("alpha", 1, 0, 1)],
      now: timestamp(1_000),
    });
    expect(snapshot.ok && snapshot.value).toEqual([
      { matchId: matchId("match"), playerId: playerId("alpha"), seatIndex: seat(1) },
      { matchId: matchId("match"), playerId: playerId("zulu"), seatIndex: seat(3) },
    ]);
    expect(
      snapshotParticipants({
        matchId: matchId("match"),
        cycle: cycle(1),
        members: [member("away", 0, 0, 1)],
        now: timestamp(DEFAULT_PRESENCE_POLICY.awayMs + 1),
      }),
    ).toMatchObject({ ok: false, error: { _tag: "NoParticipant" } });
  });

  it("rejects duplicate and invalid roster facts instead of persisting ambiguous participants", () => {
    const base = { matchId: matchId("match"), cycle: cycle(1), now: timestamp(1_000) };
    expect(
      snapshotParticipants({
        ...base,
        members: [member("one", 0), member("two", 0)],
      }),
    ).toMatchObject({ ok: false, error: { _tag: "InvalidInput", field: "members" } });
    expect(
      snapshotParticipants({
        ...base,
        members: [member("one", 0), member("one", 1)],
      }),
    ).toMatchObject({ ok: false, error: { _tag: "InvalidInput", field: "members" } });
    expect(
      snapshotParticipants({
        ...base,
        members: [{ ...member("one", 0), seatIndex: 0.5 as SeatIndex }],
      }),
    ).toMatchObject({ ok: false, error: { _tag: "InvalidInput", field: "members" } });
  });

  it("validates the whole roster and player bounds even when participation ignores presence", () => {
    const base = {
      cycle: 1,
      now: DEFAULT_PRESENCE_POLICY.awayMs + 1,
      participation: "eligible",
    } as const;
    expect(
      selectMatchParticipants({
        ...base,
        members: [member("one", 0), member("one", 1, 0, 2)],
      }),
    ).toMatchObject({ ok: false, error: { _tag: "InvalidInput", field: "members" } });
    expect(
      selectMatchParticipants({
        ...base,
        members: [member("one", 0), { ...member("queued", 1, 1, 2), lastSeenAt: 0 }],
      }),
    ).toMatchObject({ ok: false, error: { _tag: "InvalidInput", field: "members" } });
    expect(
      selectMatchParticipants({
        ...base,
        members: [member("one", 0), member("two", 1)],
        maxPlayers: 1,
      }),
    ).toMatchObject({
      ok: false,
      error: { _tag: "PlayerCountOutOfBounds", actual: 2, direction: "above-maximum" },
    });
  });
});

describe("presence and host choice", () => {
  it("uses joinedAt as the first-heartbeat grace", () => {
    const neverHeartbeat = member("new", 0, 1_000);
    expect(classifyPresence(neverHeartbeat, timestamp(1_000 + 15_000))).toBe("present");
    expect(classifyPresence(neverHeartbeat, timestamp(1_000 + 15_001))).toBe("away");
    expect(classifyPresence(neverHeartbeat, timestamp(1_000 + 45_001))).toBe("stale");
  });

  it("selects the lowest live seat and restricts active candidates", () => {
    const members = [
      member("later", 4, 0, 1, 100),
      member("zulu", 2, 0, 1, 100),
      member("alpha", 2, 0, 1, 100),
      member("spectator", 0, 0, 1, 100),
    ];
    const participants: MatchParticipant[] = [
      { matchId: matchId("match"), playerId: playerId("later"), seatIndex: seat(4) },
      { matchId: matchId("match"), playerId: playerId("zulu"), seatIndex: seat(2) },
      { matchId: matchId("match"), playerId: playerId("alpha"), seatIndex: seat(2) },
    ];
    const host = selectNextHost({ members, participants, now: timestamp(101) });
    expect(host.ok && host.value.playerId).toBe(playerId("alpha"));
    const lobbyHost = selectNextHost({ members, now: timestamp(101) });
    expect(lobbyHost.ok && lobbyHost.value.playerId).toBe(playerId("spectator"));
  });

  it("uses the dedicated host-stale threshold", () => {
    const candidate = member("host", 0, 0, 1, 0);
    expect(selectNextHost({ members: [candidate], now: timestamp(60_000) }).ok).toBe(true);
    expect(selectNextHost({ members: [candidate], now: timestamp(60_001) })).toMatchObject({
      ok: false,
      error: { _tag: "NoEligibleHost" },
    });
  });
});

describe("match decisions", () => {
  it("authorizes the host, applies player bounds, and rejects active matches", () => {
    const members = [member("host", 0), member("guest", 2)];
    const base = {
      room: room("host"),
      actorPlayerId: playerId("host"),
      matchId: matchId("new"),
      members,
      matches: [],
      now: timestamp(100),
      minPlayers: 2,
      maxPlayers: 4,
    } as const;
    expect(decideBeginMatch({ ...base, actorPlayerId: playerId("guest") })).toEqual({
      ok: false,
      error: { _tag: "NotHost", hostPlayerId: playerId("host") },
    });
    expect(decideBeginMatch({ ...base, maxPlayers: 1 })).toMatchObject({
      ok: false,
      error: { _tag: "InvalidInput", field: "playerBounds" },
    });
    expect(decideBeginMatch({ ...base, matches: [activeMatch()] })).toEqual({
      ok: false,
      error: { _tag: "ActiveMatch", matchId: matchId("match") },
    });
    const begun = decideBeginMatch(base);
    expect(begun.ok && begun.value.envelope).toMatchObject({
      status: "active",
      cycle: cycle(1),
      startedAt: timestamp(100),
    });
    expect(begun.ok && begun.value.participants).toHaveLength(2);
  });

  it("allows only active envelopes to transition and requires terminal fields", () => {
    const active = activeMatch();
    const completed = completeMatchEnvelope({
      match: active,
      completedAt: timestamp(200),
    });
    expect(completed.ok && completed.value).toEqual({
      status: "completed",
      id: matchId("match"),
      roomId: roomId("room"),
      cycle: cycle(1),
      startedAt: timestamp(100),
      completedAt: timestamp(200),
    });
    const abandoned = abandonMatchEnvelope({
      match: active,
      abandonedAt: timestamp(300),
      reason: "host-ended",
    });
    expect(abandoned.ok && abandoned.value.reason).toBe("host-ended");
    expect(
      completeMatchEnvelope({
        match: completed.ok ? completed.value : active,
        completedAt: timestamp(400),
      }),
    ).toEqual({
      ok: false,
      error: {
        _tag: "MatchNotActive",
        matchId: matchId("match"),
        status: "completed",
      },
    });
    expect(
      abandonMatchEnvelope({
        match: abandoned.ok ? abandoned.value : active,
        abandonedAt: timestamp(400),
        reason: "everyone-away",
      }),
    ).toEqual({
      ok: false,
      error: {
        _tag: "MatchNotActive",
        matchId: matchId("match"),
        status: "abandoned",
      },
    });
  });

  it("rejects completion and a new cycle at the hard deadline before abandonment", () => {
    const active = activeMatch();
    const deadline = active.startedAt + HARD_DEADLINE_MS;
    expect(
      completeMatchEnvelope({ match: active, completedAt: timestamp(deadline - 1) }),
    ).toMatchObject({ ok: true, value: { status: "completed" } });
    expect(
      completeMatchEnvelope({ match: active, completedAt: timestamp(deadline) }),
    ).toMatchObject({ ok: false, error: { _tag: "MatchDeadlineElapsed" } });
    expect(
      decideBeginMatch({
        room: room(),
        actorPlayerId: playerId("host"),
        matchId: matchId("next"),
        members: [member("host", 0), member("guest", 1)],
        matches: [active],
        now: timestamp(deadline),
        minPlayers: 2,
        maxPlayers: 12,
      }),
    ).toMatchObject({ ok: false, error: { _tag: "MatchDeadlineElapsed" } });
    expect(
      abandonMatchEnvelope({
        match: active,
        abandonedAt: timestamp(deadline),
        reason: "hard-deadline",
      }),
    ).toMatchObject({ ok: true, value: { status: "abandoned", reason: "hard-deadline" } });
  });

  it("lets explicitly untimed matches complete after the default cap without opening a second cycle", () => {
    const input = {
      room: room("host"),
      actorPlayerId: playerId("host"),
      matchId: matchId("untimed"),
      members: [member("host", 0), member("guest", 1)],
      matches: [],
      now: timestamp(100),
      minPlayers: 2,
      maxPlayers: 4,
      hardDeadline: false,
    } as const;
    const begun = decideBeginMatch(input);
    if (!begun.ok) throw new Error("Expected an untimed match");
    const later = timestamp(100 + 2 * HARD_DEADLINE_MS);
    expect(
      decideBeginMatch({ ...input, matches: [begun.value.envelope], now: later }),
    ).toMatchObject({ ok: false, error: { _tag: "ActiveMatch" } });
    expect(
      completeMatchEnvelope({ match: begun.value.envelope, completedAt: later }),
    ).toMatchObject({ ok: true, value: { status: "completed", completedAt: later } });
  });

  it("keeps avatar descriptors stable and distinct across twelve seats", () => {
    expect(AVATAR_DESCRIPTORS).toHaveLength(MAX_SEATS);
    expect(new Set(AVATAR_DESCRIPTORS.map((descriptor) => descriptor.key)).size).toBe(MAX_SEATS);
    expect(new Set(AVATAR_DESCRIPTORS.map((descriptor) => descriptor.shape)).size).toBe(MAX_SEATS);
    expect(avatarForSeat(seat(0))).toBe(AVATAR_DESCRIPTORS[0]);
    expect(avatarForSeat(seat(11))).toBe(AVATAR_DESCRIPTORS[11]);
  });
});
