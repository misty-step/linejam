import { classifyPresence, hasMatchDeadlineElapsed } from "@parlor/core";

import { abandonMatch } from "./matches.js";
import {
  DEFAULT_ABANDON_AFTER_MS,
  findMember,
  listMatchParticipants,
  parlorError,
  type ConvexMutationCtx,
  type MatchDoc,
  type MatchEnvelope,
  MAX_ROOM_MEMBERS,
  MAX_SWEEP_BATCH,
  safeNow,
} from "./runtime.js";

const abandonmentPresencePolicy = { heartbeatMs: DEFAULT_ABANDON_AFTER_MS };

export interface SweepResult {
  readonly scanned: number;
  readonly abandoned: number;
  readonly hasMore: boolean;
  readonly continueCursor: string | null;
}

const sweepLimit = (limit: number | undefined): number => {
  if (limit === undefined) return MAX_SWEEP_BATCH;
  if (!Number.isSafeInteger(limit) || limit < 1) {
    parlorError("SWEEP_LIMIT_INVALID");
  }
  return Math.min(limit, MAX_SWEEP_BATCH);
};

const everyParticipantAway = async (
  ctx: ConvexMutationCtx,
  match: MatchDoc,
  now: number,
): Promise<boolean> => {
  const participants = await listMatchParticipants(ctx, match._id);
  if (participants.length > MAX_ROOM_MEMBERS) return false;
  for (const participant of participants) {
    const member = await findMember(ctx, match.roomId, participant.playerId);
    if (member && classifyPresence(member, now, abandonmentPresencePolicy) === "present") {
      return false;
    }
  }
  return true;
};

/**
 * Abandon a bounded page of active envelopes. The caller owns scheduling and
 * must continue from continueCursor until hasMore is false. The optional callback
 * composes game cleanup in this mutation; a thrown error rolls back the whole page.
 */
export const sweepAbandonedMatches = async (
  ctx: ConvexMutationCtx,
  input: {
    readonly limit?: number;
    readonly cursor?: string;
    readonly nowMs?: number;
    readonly onAbandoned?: (envelope: MatchEnvelope) => void | PromiseLike<void>;
  } = {},
): Promise<SweepResult> => {
  const limit = sweepLimit(input.limit);
  const now = input.nowMs ?? safeNow();
  const page = await ctx.db
    .query("matches")
    .withIndex("by_status_started_at", (q) => q.eq("status", "active"))
    .paginate({
      numItems: limit,
      cursor: input.cursor ?? null,
    });
  const selected = page.page;
  let abandoned = 0;
  for (const match of selected) {
    const hardExpired = hasMatchDeadlineElapsed(match, now);
    const everyoneAway = hardExpired ? false : await everyParticipantAway(ctx, match, now);
    if (!hardExpired && !everyoneAway) continue;
    const envelope = await abandonMatch(ctx, {
      matchId: match._id,
      reason: hardExpired ? "hard-deadline" : "everyone-away",
      nowMs: now,
    });
    if (input.onAbandoned) await input.onAbandoned(envelope);
    abandoned += 1;
  }
  return {
    scanned: selected.length,
    abandoned,
    hasMore: !page.isDone,
    continueCursor: page.isDone ? null : page.continueCursor,
  };
};
