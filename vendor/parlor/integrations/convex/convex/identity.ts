import { Effect } from "effect";
import { ConvexError } from "convex/values";
import type { ConvexCtx, ConvexMutationCtx, PlayerActor, PlayerDoc } from "./policy.js";

import type { GuestTokenClaims, GuestTokenKeyRing } from "@parlor/auth";
import { verifyGuestToken } from "@parlor/auth/server";

import { MAX_GUEST_TOKEN_LENGTH, parlorError } from "./runtime.js";

export type IdentityCtx = ConvexCtx;

export interface IdentityDescriptor {
  readonly identityKey: string;
  readonly kind: "authenticated" | "guest";
  readonly guestId?: string;
}

const env = (): Record<string, string | undefined> => {
  const processLike = (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process;
  return processLike?.env ?? {};
};

const decodeBase64Url = (value: string): Uint8Array | null => {
  if (value.length === 0 || !/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  const atobLike = (
    globalThis as unknown as {
      atob?: (input: string) => string;
    }
  ).atob;
  if (!atobLike) return null;
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`
    .replace(/-/gu, "+")
    .replace(/_/gu, "/");
  try {
    const binary = atobLike(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
};

const decodeSecret = (value: unknown): Uint8Array | null => {
  if (typeof value === "string") return decodeBase64Url(value);
  if (!Array.isArray(value)) return null;
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (typeof item !== "number" || !Number.isInteger(item) || item < 0 || item > 255) {
      return null;
    }
    bytes[index] = item;
  }
  return bytes;
};

/**
 * Read the trusted key ring from Convex's server environment.
 *
 * The supported environment value is JSON like
 * `{ "key-id": "base64url-secret" }`; a `{ "keys": ... }` wrapper is also
 * accepted so deployments can carry activeKeyId metadata. This parser never
 * returns raw configuration errors to clients.
 */
export const guestKeyRingFromEnv = (): GuestTokenKeyRing | null => {
  const values = env();
  const raw = values["PARLOR_GUEST_TOKEN_KEYS"];
  if (!raw || raw.length > 16 * 1024) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const object = parsed as Record<string, unknown>;
    const candidate =
      object["keys"] !== null &&
      typeof object["keys"] === "object" &&
      !Array.isArray(object["keys"])
        ? (object["keys"] as Record<string, unknown>)
        : object;
    const keys: Record<string, Uint8Array> = {};
    for (const [keyId, encoded] of Object.entries(candidate)) {
      if (keyId === "activeKeyId" || keyId === "keys") continue;
      const secret = decodeSecret(encoded);
      if (!secret) return null;
      keys[keyId] = secret;
    }
    if (Object.keys(keys).length === 0) return null;
    const activeKeyId =
      typeof object["activeKeyId"] === "string" ? object["activeKeyId"] : undefined;
    return activeKeyId === undefined ? { keys } : { keys, activeKeyId };
  } catch {
    return null;
  }
};

const guestAudience = (): string => env()["PARLOR_GUEST_TOKEN_AUDIENCE"] ?? "parlor";

const verifyGuestCredential = async (token: string): Promise<GuestTokenClaims> => {
  if (token.length === 0 || token.length > MAX_GUEST_TOKEN_LENGTH) {
    throw new ConvexError({ code: "UNAUTHENTICATED" });
  }
  const keyRing = guestKeyRingFromEnv();
  if (!keyRing) throw new ConvexError({ code: "UNAUTHENTICATED" });
  try {
    return await Effect.runPromise(
      verifyGuestToken(token, {
        keyRing,
        audience: guestAudience(),
      }),
    );
  } catch {
    throw new ConvexError({ code: "UNAUTHENTICATED" });
  }
};

const authenticatedDescriptor = async (ctx: IdentityCtx): Promise<IdentityDescriptor | null> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const { issuer, subject } = identity;
  if (
    typeof issuer !== "string" ||
    issuer.length === 0 ||
    typeof subject !== "string" ||
    subject.length === 0
  ) {
    return null;
  }
  return {
    identityKey: `auth:${JSON.stringify([issuer, subject])}`,
    kind: "authenticated",
  };
};

const resolveDescriptor = async (
  ctx: IdentityCtx,
  guestToken: string | undefined,
): Promise<IdentityDescriptor> => {
  if (guestToken !== undefined) {
    const claims = await verifyGuestCredential(guestToken);
    return {
      identityKey: `guest:${claims.guestId}`,
      kind: "guest",
      guestId: claims.guestId,
    };
  }
  const descriptor = await authenticatedDescriptor(ctx);
  if (!descriptor) throw new ConvexError({ code: "UNAUTHENTICATED" });
  return descriptor;
};

const findPlayerByIdentity = async (
  ctx: IdentityCtx,
  identityKey: string,
): Promise<PlayerDoc | null> => {
  const player = await ctx.db
    .query("players")
    .withIndex("by_identity", (q) => q.eq("identityKey", identityKey))
    .unique();
  return player;
};

/**
 * Resolve an identity already verified by the composing application.
 * This server-only helper must never receive a client-supplied descriptor.
 */
export const resolvePlayerForIdentity = async (
  ctx: IdentityCtx,
  descriptor: IdentityDescriptor,
  options: { readonly create?: boolean } = {},
): Promise<PlayerActor> => {
  if (
    descriptor === null ||
    typeof descriptor !== "object" ||
    typeof descriptor.identityKey !== "string" ||
    descriptor.identityKey.trim().length === 0 ||
    (descriptor.kind !== "authenticated" && descriptor.kind !== "guest") ||
    (descriptor.guestId !== undefined &&
      (typeof descriptor.guestId !== "string" || descriptor.guestId.trim().length === 0))
  ) {
    return parlorError("PLAYER_IDENTITY_INVALID");
  }
  const existing = await findPlayerByIdentity(ctx, descriptor.identityKey);
  if (existing) {
    return {
      playerId: existing._id,
      identityKey: existing.identityKey,
      kind: existing.kind,
      ...(existing.guestId === undefined ? {} : { guestId: existing.guestId }),
    };
  }
  if (!options.create) return parlorError("PLAYER_NOT_FOUND");
  if (!("insert" in ctx.db)) return parlorError("PLAYER_NOT_FOUND");
  const playerId = await ctx.db.insert("players", {
    identityKey: descriptor.identityKey,
    kind: descriptor.kind,
    ...(descriptor.guestId === undefined ? {} : { guestId: descriptor.guestId }),
    createdAt: Date.now(),
  });
  return {
    playerId,
    identityKey: descriptor.identityKey,
    kind: descriptor.kind,
    ...(descriptor.guestId === undefined ? {} : { guestId: descriptor.guestId }),
  };
};

/** Resolve the caller's verified credentials to a durable player record. */
export const resolvePlayer = async (
  ctx: IdentityCtx,
  guestToken?: string,
  options: { readonly create?: boolean } = {},
): Promise<PlayerActor> =>
  resolvePlayerForIdentity(ctx, await resolveDescriptor(ctx, guestToken), options);

export const ensurePlayer = async (
  ctx: ConvexMutationCtx,
  guestToken?: string,
): Promise<PlayerActor> => resolvePlayer(ctx, guestToken, { create: true });
