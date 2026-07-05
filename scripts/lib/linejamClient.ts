#!/usr/bin/env npx tsx
/**
 * Thin, typed client over Linejam's Convex core — the one shared module the
 * CLI and MCP faces both wrap. Neither face reimplements game logic; they
 * only translate their own input format (argv / JSON-RPC) into a call here
 * and format the result back out.
 *
 * Auth: every mutation/query that touches user state accepts an optional
 * `guestToken` (see convex/rooms.ts, convex/game.ts, etc.) — the same
 * mechanism the web app uses for anonymous play, no Clerk OAuth required.
 * `mintGuestToken` signs a fresh one locally with the real production
 * signing code (`lib/guestToken.ts`), so an agent identity is
 * indistinguishable from a real guest player and no new auth surface is
 * introduced.
 */

import { ConvexHttpClient } from 'convex/browser';
import { randomUUID } from 'crypto';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { signGuestToken } from '@/lib/guestToken';

export interface GuestIdentity {
  guestId: string;
  guestToken: string;
}

/** Mints a fresh guest identity, signed the same way the web app's
 * `/api/guest/session` route signs one for a browser session. */
export async function mintGuestToken(): Promise<GuestIdentity> {
  const guestId = randomUUID();
  const guestToken = await signGuestToken(guestId, {
    sessionId: randomUUID(),
    rateLimitKey: `agent:${guestId}`,
  });
  return { guestId, guestToken };
}

/** Resolves the Convex deployment URL the same way the Next.js app does:
 * `NEXT_PUBLIC_CONVEX_URL` from the environment (populated by `.env.local`
 * for dev, `.env.production.local` for prod — never hardcoded here). */
export function resolveConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_CONVEX_URL is not set — source .env.local (dev) or the deployment env (prod) before running this'
    );
  }
  return url;
}

export function createLinejamClient(convexUrl = resolveConvexUrl()) {
  const client = new ConvexHttpClient(convexUrl);

  return {
    /** Create a room and join it as its host. Returns the room code an
     * agent shares with other players (human or agent). */
    createRoom(args: { displayName: string; guestToken?: string }) {
      return client.mutation(api.rooms.createRoom, args);
    },

    /** Join an existing room by its 4-letter code. */
    joinRoom(args: { code: string; displayName: string; guestToken?: string }) {
      return client.mutation(api.rooms.joinRoom, args);
    },

    /** Full room + player-list + host-status snapshot. Requires the
     * caller to already be a participant. */
    getRoomState(args: { code: string; guestToken?: string }) {
      return client.query(api.rooms.getRoomState, args);
    },

    /** Host-only (or any participant on a rematch): starts the game once
     * >=2 players are in the lobby. */
    startGame(args: { code: string; guestToken?: string }) {
      return client.mutation(api.game.startGame, args);
    },

    /** What this player is assigned to do right now: which poem, which
     * line, the target word count, and the previous line to build on. */
    getCurrentAssignment(args: { roomCode: string; guestToken?: string }) {
      return client.query(api.game.getCurrentAssignment, args);
    },

    /** Submit this player's line for the current round. The core creative
     * verb of the game. */
    submitLine(args: {
      poemId: Id<'poems'>;
      lineIndex: number;
      text: string;
      guestToken?: string;
    }) {
      return client.mutation(api.game.submitLine, args);
    },

    /** All poems for the room's current (active or most recently
     * completed) game, with a one-line preview each. */
    getPoemsForRoom(args: { roomCode: string; guestToken?: string }) {
      return client.query(api.poems.getPoemsForRoom, args);
    },

    /** A single poem's full text, line-by-line, with authors resolved. */
    getPoemDetail(args: { poemId: Id<'poems'>; guestToken?: string }) {
      return client.query(api.poems.getPoemDetail, args);
    },

    /** Toggle whether the calling player has favorited a poem. */
    toggleFavorite(args: { poemId: Id<'poems'>; guestToken?: string }) {
      return client.mutation(api.favorites.toggleFavorite, args);
    },

    /** Every poem the calling player has favorited, newest first. */
    getMyFavorites(args: { guestToken?: string }) {
      return client.query(api.favorites.getMyFavorites, args);
    },
  };
}

export type LinejamClient = ReturnType<typeof createLinejamClient>;
