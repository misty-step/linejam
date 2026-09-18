import {
  ABANDON_AFTER_MS,
  AWAY_AFTER_MS,
  HEARTBEAT_INTERVAL_MS,
  HOST_STALE_AFTER_MS,
  MAX_SEATS,
  ROOM_CODE_ALPHABET as CORE_ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH as CORE_ROOM_CODE_LENGTH,
  roomCodeFromBytes,
  normalizeDisplayName as coreNormalizeDisplayName,
  parseRoomCode as coreParseRoomCode,
} from "@parlor/core";

import type { GenericId } from "convex/values";
import type { ParlorCtx, ParlorDoc, ParlorMutationCtx, ParlorQueryCtx } from "./dataModel.js";
interface WebCryptoRandomSource {
  readonly getRandomValues: (bytes: Uint8Array) => Uint8Array;
}

const globalScope = globalThis as typeof globalThis & {
  readonly crypto?: WebCryptoRandomSource;
};

export type PlayerId = GenericId<"players">;
export type RoomId = GenericId<"rooms">;
export type MatchId = GenericId<"matches">;

export type ConvexQueryCtx = ParlorQueryCtx;
export type ConvexMutationCtx = ParlorMutationCtx;
export type ConvexCtx = ParlorCtx;

export type ActorKind = PlayerDoc["kind"];

export interface PlayerActor {
  readonly playerId: PlayerId;
  readonly identityKey: string;
  readonly kind: ActorKind;
  readonly guestId?: string;
}

export type PlayerDoc = ParlorDoc<"players">;

export type RoomDoc = ParlorDoc<"rooms">;

export type RoomMemberDoc = ParlorDoc<"roomMembers">;

export type MatchStatus = MatchDoc["status"];
export type AbandonmentReason = AbandonedMatchDoc["reason"];

export type ActiveMatchDoc = Extract<MatchDoc, { status: "active" }>;

export type CompletedMatchDoc = Extract<MatchDoc, { status: "completed" }>;

export type AbandonedMatchDoc = Extract<MatchDoc, { status: "abandoned" }>;

export type MatchDoc = ParlorDoc<"matches">;

export type MatchParticipantDoc = ParlorDoc<"matchParticipants">;

export const ROOM_CODE_ALPHABET = CORE_ROOM_CODE_ALPHABET;
export const ROOM_CODE_LENGTH = CORE_ROOM_CODE_LENGTH;
export const MAX_ROOM_MEMBERS = MAX_SEATS;
export const MAX_ROOM_CODE_ATTEMPTS = 16;
export const MAX_OPEN_ROOMS_PER_PLAYER = 4;
export const MAX_OPEN_MEMBERSHIPS_PER_PLAYER = 16;
export const MAX_JOIN_ATTEMPTS_PER_WINDOW = 10;
export const JOIN_ATTEMPT_WINDOW_MS = 60_000;
export const MAX_GUEST_TOKEN_LENGTH = 4096;
export const MAX_DISPLAY_NAME_CODE_POINTS = 24;
export const MIN_DISPLAY_NAME_CODE_POINTS = 1;
export const DEFAULT_HEARTBEAT_INTERVAL_MS = HEARTBEAT_INTERVAL_MS;
export const DEFAULT_AWAY_AFTER_MS = AWAY_AFTER_MS;
export const DEFAULT_HOST_STALE_AFTER_MS = HOST_STALE_AFTER_MS;
export const DEFAULT_ABANDON_AFTER_MS = ABANDON_AFTER_MS;
export const DEFAULT_MIN_ELIGIBLE_PLAYERS = 2;
export const DEFAULT_MAX_ELIGIBLE_PLAYERS = MAX_ROOM_MEMBERS;
export const MAX_SWEEP_BATCH = 100;

export const safeNow = (): number => {
  const now = Date.now();
  return Number.isFinite(now) && now >= 0 ? now : 0;
};

export const normalizeRoomCode = (input: string): string | null => {
  const result = coreParseRoomCode(input);
  return result.ok ? String(result.value) : null;
};

export const normalizeDisplayName = (input: string): string | null => {
  const result = coreNormalizeDisplayName(input);
  return result.ok ? String(result.value) : null;
};

export const generateRoomCode = (): string => {
  const cryptoObject = globalScope.crypto;
  if (!cryptoObject?.getRandomValues) {
    throw new Error("Web Crypto is required to generate room codes");
  }
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  cryptoObject.getRandomValues(bytes);
  const result = roomCodeFromBytes(bytes);
  if (!result.ok) throw new Error("Web Crypto returned invalid room bytes");
  return String(result.value);
};
