import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { ensureUserHelper } from './users';
import { getUser } from './lib/auth';

const generateRoomCode = (): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

export const createRoom = mutation({
  args: {
    displayName: v.string(),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, { displayName, guestId }) => {
    const user = await ensureUserHelper(ctx, {
      displayName,
      guestId,
    });

    let roomCode: string;
    let existingRoom;
    do {
      roomCode = generateRoomCode();
      existingRoom = await ctx.db
        .query('rooms')
        .withIndex('by_code', (q) => q.eq('code', roomCode))
        .first();
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
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, { code, displayName, guestId }) => {
    const user = await ensureUserHelper(ctx, {
      displayName,
      guestId,
    });

    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code.toUpperCase()))
      .first();

    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'LOBBY') {
      throw new Error('Cannot join a room that is not in LOBBY status');
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
    return await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code.toUpperCase()))
      .first();
  },
});

export const getRoomState = query({
  args: {
    code: v.string(),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, { code, guestId }) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code.toUpperCase()))
      .first();

    if (!room) {
      return null;
    }

    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    const user = await getUser(ctx, guestId);
    const isHost = !!user && user._id === room.hostUserId;

    return { room, players, isHost };
  },
});
