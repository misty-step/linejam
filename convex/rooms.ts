import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { ensureUserHelper } from './users';
import { getUser } from './lib/auth';
import { checkRateLimit } from './lib/rateLimit';
import { getRoomByCode, requireRoomByCode, getActiveGame } from './lib/room';

const generateRoomCode = (): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const codeLength = 4;

  // Use crypto-secure random number generation
  const randomValues = new Uint8Array(codeLength);
  crypto.getRandomValues(randomValues);

  let result = '';
  for (let i = 0; i < codeLength; i++) {
    result += characters.charAt(randomValues[i] % characters.length);
  }
  return result;
};

export const createRoom = mutation({
  args: {
    displayName: v.string(),
    guestToken: v.optional(v.string()),
    guestId: v.optional(v.string()), // Legacy fallback; prefer guestToken
  },
  handler: async (ctx, { displayName, guestToken, guestId }) => {
    const user = await ensureUserHelper(ctx, {
      displayName,
      guestToken,
      guestId,
    });

    // Rate limit: 3 rooms per 10 minutes per user
    await checkRateLimit(ctx, {
      key: `createRoom:${user._id}`,
      max: 3,
      windowMs: 10 * 60 * 1000,
    });

    let roomCode: string;
    let existingRoom;
    do {
      roomCode = generateRoomCode();
      existingRoom = await getRoomByCode(ctx, roomCode);
    } while (existingRoom); // Ensure uniqueness

    const roomId = await ctx.db.insert('rooms', {
      code: roomCode,
      hostUserId: user._id,
      status: 'LOBBY',
      createdAt: Date.now(),
    });

    await ctx.db.insert('roomPlayers', {
      roomId: roomId,
      userId: user._id,
      displayName: displayName,
      joinedAt: Date.now(),
    });

    return { code: roomCode, roomId };
  },
});

export const joinRoom = mutation({
  args: {
    code: v.string(),
    displayName: v.string(),
    guestToken: v.optional(v.string()),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, { code, displayName, guestToken, guestId }) => {
    const user = await ensureUserHelper(ctx, {
      displayName,
      guestToken,
      guestId,
    });

    // Rate limit: 10 joins per 10 minutes per user
    await checkRateLimit(ctx, {
      key: `joinRoom:${user._id}`,
      max: 10,
      windowMs: 10 * 60 * 1000,
    });

    const room = await requireRoomByCode(ctx, code);

    // Check no game is in progress (authoritative check)
    const activeGame = await getActiveGame(ctx, room._id);
    if (activeGame) {
      throw new Error('Cannot join a room with a game in progress');
    }

    const roomPlayers = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room_user', (q) =>
        q.eq('roomId', room._id).eq('userId', user._id)
      )
      .first();

    if (roomPlayers) {
      // User is already in the room, just return room state
      return room;
    }

    const currentPlayers = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    if (currentPlayers.length >= 8) {
      throw new Error('Room is full');
    }

    await ctx.db.insert('roomPlayers', {
      roomId: room._id,
      userId: user._id,
      displayName: displayName,
      joinedAt: Date.now(),
    });

    return room;
  },
});

export const getRoom = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, { code }) => {
    return await getRoomByCode(ctx, code);
  },
});

export const getRoomState = query({
  args: {
    code: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { code, guestToken }) => {
    const room = await getRoomByCode(ctx, code);
    if (!room) return null;

    const roomPlayers = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    // Fetch user records to get stable IDs for avatar colors and bot status
    const players = await Promise.all(
      roomPlayers.map(async (rp) => {
        const userRecord = await ctx.db.get(rp.userId);
        return {
          ...rp,
          stableId: userRecord?.clerkUserId || userRecord?.guestId || rp.userId,
          isBot: userRecord?.kind === 'AI',
          aiPersonaId: userRecord?.aiPersonaId,
        };
      })
    );

    const user = await getUser(ctx, guestToken);
    const isHost = !!user && user._id === room.hostUserId;

    return { room, players, isHost };
  },
});

export const leaveLobby = mutation({
  args: {
    roomCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { roomCode, guestToken }) => {
    const user = await getUser(ctx, guestToken);
    if (!user) return;

    const room = await getRoomByCode(ctx, roomCode);
    if (!room) return;

    // Can only leave during lobby (no active game)
    const activeGame = await getActiveGame(ctx, room._id);
    if (activeGame) return;

    // Don't let host leave (they should close the room instead)
    if (room.hostUserId === user._id) return;

    const roomPlayer = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room_user', (q) =>
        q.eq('roomId', room._id).eq('userId', user._id)
      )
      .first();

    if (roomPlayer) {
      await ctx.db.delete(roomPlayer._id);
    }
  },
});
