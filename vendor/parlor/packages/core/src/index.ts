import * as Schema from "effect/Schema";

/** A serializable success-or-failure value used by all core policies. */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const MAX_SEATS = 12 as const;

function success<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function failure<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export interface InvalidInputError {
  readonly _tag: "InvalidInput";
  readonly field: string;
  readonly message: string;
}

export interface InvalidRandomBytesError {
  readonly _tag: "InvalidRandomBytes";
  readonly required: number;
  readonly received: number;
}

export interface RoomCodeExhaustedError {
  readonly _tag: "RoomCodeExhausted";
  readonly attempts: number;
}

export interface RoomFullError {
  readonly _tag: "RoomFull";
  readonly capacity: typeof MAX_SEATS;
}

export interface NoParticipantError {
  readonly _tag: "NoParticipant";
  readonly message: string;
}

export interface ActiveMatchError {
  readonly _tag: "ActiveMatch";
  readonly matchId: MatchId;
}

export interface RoomClosedError {
  readonly _tag: "RoomClosed";
}

export interface NotHostError {
  readonly _tag: "NotHost";
  readonly hostPlayerId: PlayerId;
}

export interface PlayerCountOutOfBoundsError {
  readonly _tag: "PlayerCountOutOfBounds";
  readonly minimum: number;
  readonly maximum: number;
  readonly actual: number;
  readonly direction: "below-minimum" | "above-maximum";
}

export interface NoEligibleHostError {
  readonly _tag: "NoEligibleHost";
  readonly message: string;
}

export interface MatchNotActiveError {
  readonly _tag: "MatchNotActive";
  readonly matchId: MatchId;
  readonly status: "completed" | "abandoned";
}

export interface MatchDeadlineElapsedError {
  readonly _tag: "MatchDeadlineElapsed";
  readonly matchId: MatchId;
}

export type CoreError =
  | InvalidInputError
  | InvalidRandomBytesError
  | RoomCodeExhaustedError
  | RoomFullError
  | NoParticipantError
  | ActiveMatchError
  | RoomClosedError
  | NotHostError
  | PlayerCountOutOfBoundsError
  | NoEligibleHostError
  | MatchNotActiveError
  | MatchDeadlineElapsedError;

const nonEmptyString = Schema.String.pipe(
  Schema.filter((value) => value.length > 0 || "must not be empty"),
);

/** Nominal identifier schemas. Their runtime representation is still a string. */
export const RoomId = nonEmptyString.pipe(Schema.brand("RoomId"));
export type RoomId = typeof RoomId.Type;

export const PlayerId = nonEmptyString.pipe(Schema.brand("PlayerId"));
export type PlayerId = typeof PlayerId.Type;

export const MatchId = nonEmptyString.pipe(Schema.brand("MatchId"));
export type MatchId = typeof MatchId.Type;

export const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ" as const;
export const ROOM_CODE_LENGTH = 4;
export const DEFAULT_ROOM_CODE_ATTEMPTS = 32;

const roomCodePattern = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`, "u");

export const RoomCode = Schema.String.pipe(
  Schema.pattern(roomCodePattern),
  Schema.brand("RoomCode"),
);
export type RoomCode = typeof RoomCode.Type;

const normalizeDisplayNameText = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/gu, " ");

const displayNameFilter = (value: string): string | undefined => {
  if (normalizeDisplayNameText(value) !== value) {
    return "must be normalized";
  }
  const codePointCount = Array.from(value).length;
  return codePointCount >= 1 && codePointCount <= 24
    ? undefined
    : "must contain 1 to 24 Unicode code points";
};

export const DisplayName = Schema.String.pipe(
  Schema.filter(displayNameFilter),
  Schema.brand("DisplayName"),
);
export type DisplayName = typeof DisplayName.Type;

export const SeatIndex = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(11),
  Schema.brand("SeatIndex"),
);
export type SeatIndex = typeof SeatIndex.Type;

export const Cycle = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(1),
  Schema.brand("Cycle"),
);
export type Cycle = typeof Cycle.Type;

export const TimestampMs = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.brand("TimestampMs"),
);
export type TimestampMs = typeof TimestampMs.Type;

function invalid(field: string, message: string): InvalidInputError {
  return { _tag: "InvalidInput", field, message };
}

function decodeSchema<S extends Schema.Schema.AnyNoContext>(
  schema: S,
  input: unknown,
  field: string,
): Result<Schema.Schema.Type<S>, InvalidInputError> {
  const decoded = Schema.decodeUnknownEither(schema)(input);
  return decoded._tag === "Right"
    ? success(decoded.right)
    : failure(invalid(field, "does not satisfy the schema"));
}

/** Parse an opaque identifier at an untrusted boundary. */
export function parseRoomId(input: unknown): Result<RoomId, InvalidInputError> {
  return decodeSchema(RoomId, input, "roomId");
}

/** Parse an opaque identifier at an untrusted boundary. */
export function parsePlayerId(input: unknown): Result<PlayerId, InvalidInputError> {
  return decodeSchema(PlayerId, input, "playerId");
}

/** Parse an opaque identifier at an untrusted boundary. */
export function parseMatchId(input: unknown): Result<MatchId, InvalidInputError> {
  return decodeSchema(MatchId, input, "matchId");
}

export function parseSeatIndex(input: unknown): Result<SeatIndex, InvalidInputError> {
  return decodeSchema(SeatIndex, input, "seatIndex");
}

export function parseCycle(input: unknown): Result<Cycle, InvalidInputError> {
  return decodeSchema(Cycle, input, "cycle");
}

export function parseTimestampMs(input: unknown): Result<TimestampMs, InvalidInputError> {
  return decodeSchema(TimestampMs, input, "timestampMs");
}

/** Normalize user-entered display text, then validate the canonical form. */
export function normalizeDisplayName(input: unknown): Result<DisplayName, InvalidInputError> {
  if (typeof input !== "string") {
    return failure(invalid("displayName", "must be a string"));
  }
  const normalized = normalizeDisplayNameText(input);
  const codePointCount = Array.from(normalized).length;
  if (codePointCount < 1 || codePointCount > 24) {
    return failure(invalid("displayName", "must contain 1 to 24 Unicode code points"));
  }
  return decodeSchema(DisplayName, normalized, "displayName");
}

/** Normalize a room code to the uppercase canonical representation. */
export function parseRoomCode(input: unknown): Result<RoomCode, InvalidInputError> {
  if (typeof input !== "string") {
    return failure(invalid("roomCode", "must be a string"));
  }
  const normalized = input.trim().toUpperCase();
  return decodeSchema(RoomCode, normalized, "roomCode");
}

export interface Room {
  readonly id: RoomId;
  readonly code: RoomCode;
  readonly hostPlayerId: PlayerId;
  readonly createdAt: TimestampMs;
  readonly closedAt?: TimestampMs;
}

export interface RoomMember {
  readonly roomId: RoomId;
  readonly playerId: PlayerId;
  readonly displayName: DisplayName;
  readonly seatIndex: SeatIndex;
  readonly joinedAt: TimestampMs;
  readonly eligibleFromCycle: Cycle;
  readonly lastSeenAt?: TimestampMs;
}

export interface ActiveMatchEnvelope {
  readonly status: "active";
  readonly id: MatchId;
  readonly roomId: RoomId;
  readonly cycle: Cycle;
  readonly startedAt: TimestampMs;
  /** Defaults to the standard cap; false opts this match into untimed play. */
  readonly hardDeadline?: boolean;
}

export interface CompletedMatchEnvelope {
  readonly status: "completed";
  readonly id: MatchId;
  readonly roomId: RoomId;
  readonly cycle: Cycle;
  readonly startedAt: TimestampMs;
  readonly hardDeadline?: boolean;
  readonly completedAt: TimestampMs;
}

export type AbandonmentReason = "everyone-away" | "hard-deadline" | "host-ended";

export interface AbandonedMatchEnvelope {
  readonly status: "abandoned";
  readonly id: MatchId;
  readonly roomId: RoomId;
  readonly cycle: Cycle;
  readonly startedAt: TimestampMs;
  readonly hardDeadline?: boolean;
  readonly abandonedAt: TimestampMs;
  readonly reason: AbandonmentReason;
}

export type MatchEnvelope = ActiveMatchEnvelope | CompletedMatchEnvelope | AbandonedMatchEnvelope;

export interface MatchParticipant {
  readonly matchId: MatchId;
  readonly playerId: PlayerId;
  readonly seatIndex: SeatIndex;
}

/** The shape names are intentionally stable: CSS and persisted projections may refer to them. */
export type AvatarShape =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "hexagon"
  | "star"
  | "pill"
  | "ring"
  | "burst"
  | "leaf"
  | "arch"
  | "zigzag";

export interface AvatarDescriptor {
  readonly key: string;
  readonly background: string;
  readonly foreground: string;
  readonly shape: AvatarShape;
}

export const AVATAR_DESCRIPTORS: readonly [
  AvatarDescriptor,
  AvatarDescriptor,
  AvatarDescriptor,
  AvatarDescriptor,
  AvatarDescriptor,
  AvatarDescriptor,
  AvatarDescriptor,
  AvatarDescriptor,
  AvatarDescriptor,
  AvatarDescriptor,
  AvatarDescriptor,
  AvatarDescriptor,
] = [
  { key: "ember", background: "#DF6258", foreground: "#102A2A", shape: "circle" },
  { key: "brass", background: "#F0B43C", foreground: "#102A2A", shape: "square" },
  { key: "sky", background: "#4868D9", foreground: "#F2F7F4", shape: "triangle" },
  { key: "mint", background: "#67C9B5", foreground: "#102A2A", shape: "diamond" },
  { key: "plum", background: "#8A5BA8", foreground: "#F2F7F4", shape: "hexagon" },
  { key: "tangerine", background: "#E98D43", foreground: "#102A2A", shape: "star" },
  { key: "teal", background: "#168A86", foreground: "#F2F7F4", shape: "pill" },
  { key: "lavender", background: "#A99BE8", foreground: "#102A2A", shape: "ring" },
  { key: "moss", background: "#6F8F48", foreground: "#F2F7F4", shape: "burst" },
  { key: "coral", background: "#DF8278", foreground: "#102A2A", shape: "leaf" },
  { key: "indigo", background: "#3948A8", foreground: "#F2F7F4", shape: "arch" },
  { key: "sand", background: "#D8C184", foreground: "#102A2A", shape: "zigzag" },
];

export function avatarForSeat(seatIndex: SeatIndex): AvatarDescriptor {
  const normalizedSeat = ((seatIndex % MAX_SEATS) + MAX_SEATS) % MAX_SEATS;
  return AVATAR_DESCRIPTORS[normalizedSeat] as AvatarDescriptor;
}

export interface RandomBytes {
  (length: number): Uint8Array;
}

export type RoomCodeAvailability = (candidate: RoomCode) => boolean | PromiseLike<boolean>;

export interface RoomCodeAllocationOptions {
  readonly isAvailable: RoomCodeAvailability;
  readonly randomBytes?: RandomBytes;
  readonly maxAttempts?: number;
}

export type RoomCodeAllocationError =
  | InvalidInputError
  | InvalidRandomBytesError
  | RoomCodeExhaustedError;

const cryptoRandomBytes: RandomBytes = (length) => {
  const cryptoSource = (
    globalThis as typeof globalThis & {
      crypto?: { getRandomValues: (bytes: Uint8Array) => Uint8Array };
    }
  ).crypto;
  if (cryptoSource === undefined) {
    throw new Error("Web Crypto is unavailable; inject randomBytes");
  }
  return cryptoSource.getRandomValues(new Uint8Array(length));
};

/**
 * Convert four random bytes to a room code. The 32-character alphabet is a
 * power-of-two partition of one byte, so modulo reduction is unbiased.
 */
export function roomCodeFromBytes(bytes: Uint8Array): Result<RoomCode, InvalidRandomBytesError> {
  if (!(bytes instanceof Uint8Array) || bytes.length < ROOM_CODE_LENGTH) {
    return failure({
      _tag: "InvalidRandomBytes",
      required: ROOM_CODE_LENGTH,
      received: bytes instanceof Uint8Array ? bytes.length : 0,
    });
  }
  const alphabetLength = ROOM_CODE_ALPHABET.length;
  let code = "";
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    const byte = bytes[index];
    if (byte === undefined) {
      return failure({
        _tag: "InvalidRandomBytes",
        required: ROOM_CODE_LENGTH,
        received: bytes.length,
      });
    }
    code += ROOM_CODE_ALPHABET[byte % alphabetLength];
  }
  const parsed = decodeSchema(RoomCode, code, "roomCode");
  return parsed.ok
    ? parsed
    : failure({
        _tag: "InvalidRandomBytes",
        required: ROOM_CODE_LENGTH,
        received: bytes.length,
      });
}

export type RoomCodeAllocationResult = Promise<Result<RoomCode, RoomCodeAllocationError>>;

/**
 * Allocate a generated code. The availability check may be asynchronous so
 * database-backed callers do not need a second allocation policy.
 */
export async function allocateRoomCode(
  options: RoomCodeAllocationOptions,
): RoomCodeAllocationResult {
  if (
    options === null ||
    typeof options !== "object" ||
    typeof options.isAvailable !== "function" ||
    (options.randomBytes !== undefined && typeof options.randomBytes !== "function")
  ) {
    return failure(invalid("allocation", "requires an availability function"));
  }
  const maxAttempts = options.maxAttempts ?? DEFAULT_ROOM_CODE_ATTEMPTS;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    return failure(invalid("maxAttempts", "must be a positive safe integer"));
  }
  const randomBytes = options.randomBytes ?? cryptoRandomBytes;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = roomCodeFromBytes(randomBytes(ROOM_CODE_LENGTH));
    if (!candidate.ok) {
      return candidate;
    }
    if (await options.isAvailable(candidate.value)) {
      return success(candidate.value);
    }
  }
  return failure({ _tag: "RoomCodeExhausted", attempts: maxAttempts });
}

export function allocateSeat(
  occupiedSeats: readonly number[],
): Result<SeatIndex, RoomFullError | InvalidInputError> {
  if (!Array.isArray(occupiedSeats)) {
    return failure(invalid("occupiedSeats", "must be an array"));
  }
  const occupied = new Set<number>();
  for (const seat of occupiedSeats) {
    if (!Number.isSafeInteger(seat) || seat < 0 || seat >= MAX_SEATS) {
      return failure(invalid("occupiedSeats", "contains an invalid seat index"));
    }
    if (occupied.has(seat)) {
      return failure(invalid("occupiedSeats", "contains a duplicate seat index"));
    }
    occupied.add(seat);
  }
  for (let seat = 0; seat < MAX_SEATS; seat += 1) {
    if (!occupied.has(seat)) {
      return success(seat as SeatIndex);
    }
  }
  return failure({ _tag: "RoomFull", capacity: MAX_SEATS });
}

export interface NextCycleInput {
  readonly matches: readonly ({ readonly cycle: number } | number)[];
}

export function nextCycle(input: NextCycleInput): Result<Cycle, InvalidInputError> {
  if (input === null || typeof input !== "object" || !Array.isArray(input.matches)) {
    return failure(invalid("matches", "must be an array"));
  }
  let maximum = 0;
  for (const entry of input.matches) {
    const cycle =
      typeof entry === "number"
        ? entry
        : entry !== null && typeof entry === "object"
          ? entry.cycle
          : undefined;
    if (typeof cycle !== "number" || !Number.isSafeInteger(cycle) || cycle < 1) {
      return failure(invalid("matches", "contains an invalid cycle"));
    }
    if (cycle > maximum) {
      maximum = cycle;
    }
  }
  if (maximum >= Number.MAX_SAFE_INTEGER) {
    return failure(invalid("matches", "next cycle exceeds safe integer range"));
  }
  return success((maximum + 1) as Cycle);
}

export interface EligibleMembersForCycleInput<
  Member extends { readonly eligibleFromCycle: number } = RoomMember,
> {
  readonly members: readonly Member[];
  readonly cycle: number;
}

export function eligibleMembersForCycle<Member extends { readonly eligibleFromCycle: number }>(
  input: EligibleMembersForCycleInput<Member>,
): readonly Member[] {
  return input.members.filter((member) => member.eligibleFromCycle <= input.cycle);
}

export const HEARTBEAT_INTERVAL_MS = 15_000;
export const AWAY_AFTER_MS = 45_000;
export const HOST_STALE_AFTER_MS = 60_000;
export const ABANDON_AFTER_MS = 10 * 60_000;
export const HARD_DEADLINE_MS = 30 * 60_000;

export interface PresencePolicy {
  readonly heartbeatMs: number;
  readonly awayMs: number;
  readonly hostStaleMs: number;
  readonly abandonMs: number;
  readonly hardDeadlineMs: number;
}

export const DEFAULT_PRESENCE_POLICY: PresencePolicy = Object.freeze({
  heartbeatMs: HEARTBEAT_INTERVAL_MS,
  awayMs: AWAY_AFTER_MS,
  hostStaleMs: HOST_STALE_AFTER_MS,
  abandonMs: ABANDON_AFTER_MS,
  hardDeadlineMs: HARD_DEADLINE_MS,
});

function presenceThreshold(candidate: number | undefined, fallback: number): number {
  return candidate !== undefined && Number.isFinite(candidate) && candidate >= 0
    ? candidate
    : fallback;
}

/** Time facts are structural so database projections need no nominal casts. */
export interface PresenceMember {
  readonly joinedAt: number;
  readonly lastSeenAt?: number;
}

export type PresenceStatus = "present" | "away" | "stale";

function presenceAge(member: PresenceMember, now: number): number {
  // A member without a heartbeat gets a first-heartbeat grace period from
  // joinedAt. Once that grace expires, joinedAt remains the conservative last
  // evidence until the member sends a heartbeat.
  const evidenceAt = member.lastSeenAt ?? member.joinedAt;
  return Math.max(0, now - evidenceAt);
}

export function classifyPresence(
  member: PresenceMember,
  now: number,
  policy?: Partial<PresencePolicy>,
): PresenceStatus {
  const age = presenceAge(member, now);
  if (age <= presenceThreshold(policy?.heartbeatMs, HEARTBEAT_INTERVAL_MS)) {
    return "present";
  }
  if (age <= presenceThreshold(policy?.awayMs, AWAY_AFTER_MS)) {
    return "away";
  }
  return "stale";
}

export function isHostStale(
  member: PresenceMember,
  now: number,
  policy?: Partial<PresencePolicy>,
): boolean {
  return presenceAge(member, now) > presenceThreshold(policy?.hostStaleMs, HOST_STALE_AFTER_MS);
}

/** The default cap is authoritative unless this match explicitly opts out. */
export function hasMatchDeadlineElapsed(
  match: { readonly startedAt: number; readonly hardDeadline?: boolean },
  now: number,
): boolean {
  return match.hardDeadline !== false && now - match.startedAt >= HARD_DEADLINE_MS;
}

export function validateMatchEndTime(
  startedAt: number,
  endedAt: number,
  field = "endedAt",
): Result<TimestampMs, InvalidInputError> {
  if (
    !Number.isSafeInteger(startedAt) ||
    startedAt < 0 ||
    !Number.isSafeInteger(endedAt) ||
    endedAt < startedAt
  ) {
    return failure(invalid(field, "must be a timestamp at or after startedAt"));
  }
  return success(endedAt as TimestampMs);
}

export interface ParticipantCandidate extends PresenceMember {
  readonly playerId: string;
  readonly seatIndex: number;
  readonly eligibleFromCycle: number;
}

export type ParticipantSelectionError =
  | InvalidInputError
  | NoParticipantError
  | PlayerCountOutOfBoundsError;

/** Validate a bounded roster and select a stable eligible snapshot, present-only by default. */
export function selectMatchParticipants<Member extends ParticipantCandidate>(input: {
  readonly members: readonly Member[];
  readonly cycle: number;
  readonly now: number;
  readonly minPlayers?: number;
  readonly maxPlayers?: number;
  readonly policy?: Partial<PresencePolicy>;
  readonly participation?: "present" | "eligible";
}): Result<readonly Member[], ParticipantSelectionError> {
  const minimum = input.minPlayers ?? 1;
  const maximum = input.maxPlayers ?? MAX_SEATS;
  if (
    !Number.isSafeInteger(minimum) ||
    !Number.isSafeInteger(maximum) ||
    minimum < 1 ||
    maximum < minimum ||
    maximum > MAX_SEATS
  ) {
    return failure(
      invalid("playerBounds", `must satisfy 1 <= minPlayers <= maxPlayers <= ${MAX_SEATS}`),
    );
  }
  if (!Number.isSafeInteger(input.cycle) || input.cycle < 1) {
    return failure(invalid("cycle", "must be a positive safe integer"));
  }
  if (!Number.isSafeInteger(input.now) || input.now < 0) {
    return failure(invalid("now", "must be a nonnegative safe integer"));
  }
  const participation = input.participation ?? "present";
  if (participation !== "present" && participation !== "eligible") {
    return failure(invalid("participation", "must be present or eligible"));
  }
  if (input.members.length > MAX_SEATS) {
    return failure(invalid("members", "exceeds room capacity"));
  }
  const seats = new Set<number>();
  const players = new Set<string>();
  const selected: Member[] = [];
  for (const member of input.members) {
    if (
      !Number.isSafeInteger(member.seatIndex) ||
      member.seatIndex < 0 ||
      member.seatIndex >= MAX_SEATS ||
      member.playerId.length === 0 ||
      !Number.isSafeInteger(member.eligibleFromCycle) ||
      member.eligibleFromCycle < 1 ||
      !Number.isSafeInteger(member.joinedAt) ||
      member.joinedAt < 0 ||
      (member.lastSeenAt !== undefined &&
        (!Number.isSafeInteger(member.lastSeenAt) || member.lastSeenAt < member.joinedAt))
    ) {
      return failure(invalid("members", "contains invalid participant facts"));
    }
    if (seats.has(member.seatIndex) || players.has(member.playerId)) {
      return failure(invalid("members", "contains duplicate participant identity"));
    }
    seats.add(member.seatIndex);
    players.add(member.playerId);
    if (
      member.eligibleFromCycle <= input.cycle &&
      (participation === "eligible" ||
        classifyPresence(member, input.now, input.policy) === "present")
    ) {
      selected.push(member);
    }
  }
  if (selected.length === 0) {
    return failure({
      _tag: "NoParticipant",
      message:
        participation === "eligible"
          ? "no eligible members are available"
          : "no eligible present members are available",
    });
  }
  if (selected.length < minimum || selected.length > maximum) {
    return failure({
      _tag: "PlayerCountOutOfBounds",
      minimum,
      maximum,
      actual: selected.length,
      direction: selected.length < minimum ? "below-minimum" : "above-maximum",
    });
  }
  selected.sort((left, right) => left.seatIndex - right.seatIndex);
  return success(selected);
}

export interface SnapshotParticipantsInput {
  readonly matchId: MatchId;
  readonly cycle: Cycle;
  readonly members: readonly RoomMember[];
  readonly now: TimestampMs;
  readonly policy?: Partial<PresencePolicy>;
  readonly minPlayers?: number;
  readonly maxPlayers?: number;
}

export function snapshotParticipants(
  input: SnapshotParticipantsInput,
): Result<readonly MatchParticipant[], ParticipantSelectionError> {
  const selected = selectMatchParticipants(input);
  if (!selected.ok) return selected;
  return success(
    selected.value.map((member) => ({
      matchId: input.matchId,
      playerId: member.playerId,
      seatIndex: member.seatIndex,
    })),
  );
}

export interface SelectNextHostInput<
  Member extends PresenceMember & { readonly playerId: string; readonly seatIndex: number } =
    RoomMember,
> {
  readonly members: readonly Member[];
  /** Presence of this property restricts candidates to active-match participants. */
  readonly participants?: readonly { readonly playerId: string }[];
  readonly now: number;
  readonly policy?: Partial<PresencePolicy>;
}

export function selectNextHost<
  Member extends PresenceMember & { readonly playerId: string; readonly seatIndex: number },
>(
  input: SelectNextHostInput<Member>,
): Result<Member, NoParticipantError | NoEligibleHostError | InvalidInputError> {
  if (input.members.length === 0) {
    return failure({
      _tag: "NoParticipant",
      message: "no room members are available for host selection",
    });
  }
  if (input.participants?.length === 0) {
    return failure({
      _tag: "NoParticipant",
      message: "the active match has no participants",
    });
  }
  const participantIds =
    input.participants === undefined
      ? undefined
      : new Set(input.participants.map((participant) => participant.playerId));
  let hasCandidate = false;
  let host: Member | undefined;
  for (const member of input.members) {
    if (participantIds !== undefined && !participantIds.has(member.playerId)) continue;
    hasCandidate = true;
    if (isHostStale(member, input.now, input.policy)) continue;
    if (
      host === undefined ||
      member.seatIndex < host.seatIndex ||
      (member.seatIndex === host.seatIndex && member.playerId < host.playerId)
    ) {
      host = member;
    }
  }
  if (!hasCandidate) {
    return failure({
      _tag: "NoParticipant",
      message: "active-match participants are not present in the room",
    });
  }
  return host === undefined
    ? failure({ _tag: "NoEligibleHost", message: "all host candidates are stale" })
    : success(host);
}

export interface BeginMatchInput {
  readonly room: Room;
  readonly actorPlayerId: PlayerId;
  readonly matchId: MatchId;
  readonly members: readonly RoomMember[];
  readonly matches: readonly MatchEnvelope[];
  readonly now: TimestampMs;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly policy?: Partial<PresencePolicy>;
  readonly hardDeadline?: boolean;
}

export interface BeginMatchDecision {
  readonly envelope: ActiveMatchEnvelope;
  readonly participants: readonly MatchParticipant[];
}

export type BeginMatchError =
  | InvalidInputError
  | RoomClosedError
  | NotHostError
  | ActiveMatchError
  | NoParticipantError
  | PlayerCountOutOfBoundsError
  | MatchDeadlineElapsedError;

export function decideBeginMatch(
  input: BeginMatchInput,
): Result<BeginMatchDecision, BeginMatchError> {
  if (input.room.closedAt !== undefined) {
    return failure({ _tag: "RoomClosed" });
  }
  if (input.actorPlayerId !== input.room.hostPlayerId) {
    return failure({
      _tag: "NotHost",
      hostPlayerId: input.room.hostPlayerId,
    });
  }
  const roomMatches = input.matches.filter((match) => match.roomId === input.room.id);
  const active = roomMatches.find((match) => match.status === "active");
  if (active?.status === "active") {
    if (hasMatchDeadlineElapsed(active, input.now)) {
      return failure({ _tag: "MatchDeadlineElapsed", matchId: active.id });
    }
    return failure({ _tag: "ActiveMatch", matchId: active.id });
  }
  const cycleResult = nextCycle({ matches: roomMatches });
  if (!cycleResult.ok) {
    return cycleResult;
  }
  const cycle = cycleResult.value;
  const participantResult = snapshotParticipants({
    matchId: input.matchId,
    cycle,
    members: input.members.filter((member) => member.roomId === input.room.id),
    now: input.now,
    minPlayers: input.minPlayers,
    maxPlayers: input.maxPlayers,
    ...(input.policy === undefined ? {} : { policy: input.policy }),
  });
  if (!participantResult.ok) {
    return participantResult;
  }
  return success({
    envelope: {
      status: "active",
      id: input.matchId,
      roomId: input.room.id,
      cycle,
      startedAt: input.now,
      ...(input.hardDeadline === false ? { hardDeadline: false } : {}),
    },
    participants: participantResult.value,
  });
}

export type MatchTransitionError =
  | InvalidInputError
  | MatchNotActiveError
  | MatchDeadlineElapsedError;

export interface CompleteMatchEnvelopeInput {
  readonly match: MatchEnvelope;
  readonly completedAt: TimestampMs;
}

function completeMatch(
  match: MatchEnvelope,
  completedAt: TimestampMs,
): Result<CompletedMatchEnvelope, MatchTransitionError> {
  if (match.status !== "active") {
    return failure({
      _tag: "MatchNotActive",
      matchId: match.id,
      status: match.status,
    });
  }
  const time = validateMatchEndTime(match.startedAt, completedAt, "completedAt");
  if (!time.ok) return time;
  if (hasMatchDeadlineElapsed(match, completedAt)) {
    return failure({ _tag: "MatchDeadlineElapsed", matchId: match.id });
  }
  return success({
    status: "completed",
    id: match.id,
    roomId: match.roomId,
    cycle: match.cycle,
    startedAt: match.startedAt,
    ...(match.hardDeadline === false ? { hardDeadline: false } : {}),
    completedAt,
  });
}

export function completeMatchEnvelope(
  input: CompleteMatchEnvelopeInput,
): Result<CompletedMatchEnvelope, MatchTransitionError> {
  return completeMatch(input.match, input.completedAt);
}

export interface AbandonMatchEnvelopeInput {
  readonly match: MatchEnvelope;
  readonly abandonedAt: TimestampMs;
  readonly reason: AbandonmentReason;
}

const abandonmentReasons: readonly AbandonmentReason[] = [
  "everyone-away",
  "hard-deadline",
  "host-ended",
];

function abandonMatch(
  match: MatchEnvelope,
  abandonedAt: TimestampMs,
  reason: AbandonmentReason,
): Result<AbandonedMatchEnvelope, MatchTransitionError> {
  if (match.status !== "active") {
    return failure({
      _tag: "MatchNotActive",
      matchId: match.id,
      status: match.status,
    });
  }
  if (!abandonmentReasons.includes(reason)) {
    return failure(invalid("reason", "must be a supported abandonment reason"));
  }
  const time = validateMatchEndTime(match.startedAt, abandonedAt, "abandonedAt");
  if (!time.ok) return time;
  return success({
    status: "abandoned",
    id: match.id,
    roomId: match.roomId,
    cycle: match.cycle,
    startedAt: match.startedAt,
    ...(match.hardDeadline === false ? { hardDeadline: false } : {}),
    abandonedAt,
    reason,
  });
}

export function abandonMatchEnvelope(
  input: AbandonMatchEnvelopeInput,
): Result<AbandonedMatchEnvelope, MatchTransitionError> {
  return abandonMatch(input.match, input.abandonedAt, input.reason);
}
