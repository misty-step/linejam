import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    clerkUserId: v.optional(v.string()),
    guestId: v.optional(v.string()),
    displayName: v.string(),
    createdAt: v.number(),
    // AI player fields
    kind: v.optional(v.union(v.literal('human'), v.literal('AI'))),
    aiPersonaId: v.optional(v.string()),
  })
    .index('by_clerk', ['clerkUserId'])
    .index('by_guest', ['guestId']),

  rooms: defineTable({
    code: v.string(),
    hostUserId: v.id('users'),
    status: v.union(
      v.literal('LOBBY'),
      v.literal('IN_PROGRESS'),
      v.literal('COMPLETED')
    ),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    currentGameId: v.optional(v.id('games')),
    currentCycle: v.optional(v.number()),
  })
    .index('by_code', ['code'])
    .index('by_host', ['hostUserId']),

  roomPlayers: defineTable({
    roomId: v.id('rooms'),
    userId: v.id('users'),
    displayName: v.string(),
    seatIndex: v.optional(v.number()),
    joinedAt: v.number(),
  })
    .index('by_room', ['roomId'])
    .index('by_user', ['userId'])
    .index('by_room_user', ['roomId', 'userId']),

  games: defineTable({
    roomId: v.id('rooms'),
    status: v.union(
      v.literal('LOBBY'),
      v.literal('IN_PROGRESS'),
      v.literal('COMPLETED')
    ),
    cycle: v.number(),
    currentRound: v.number(),
    assignmentMatrix: v.array(v.array(v.id('users'))),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index('by_room', ['roomId'])
    .index('by_room_cycle', ['roomId', 'cycle']),

  poems: defineTable({
    roomId: v.id('rooms'),
    gameId: v.id('games'),
    indexInRoom: v.number(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    // Reveal phase
    assignedReaderId: v.optional(v.id('users')),
    revealedAt: v.optional(v.number()),
  })
    .index('by_room', ['roomId'])
    .index('by_room_index', ['roomId', 'indexInRoom'])
    .index('by_reader', ['assignedReaderId'])
    .index('by_game', ['gameId'])
    .index('by_room_game_index', ['roomId', 'gameId', 'indexInRoom']),

  lines: defineTable({
    poemId: v.id('poems'),
    indexInPoem: v.number(),
    text: v.string(),
    wordCount: v.number(),
    authorUserId: v.id('users'),
    authorDisplayName: v.optional(v.string()), // Captured at write-time for pen name support
    createdAt: v.number(),
  })
    .index('by_poem', ['poemId'])
    .index('by_poem_index', ['poemId', 'indexInPoem'])
    .index('by_author', ['authorUserId']),

  favorites: defineTable({
    userId: v.id('users'),
    poemId: v.id('poems'),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_poem', ['poemId'])
    .index('by_user_poem', ['userId', 'poemId']),

  shares: defineTable({
    poemId: v.id('poems'),
    createdAt: v.number(),
  })
    .index('by_poem', ['poemId'])
    .index('by_created', ['createdAt']),

  rateLimits: defineTable({
    key: v.string(),
    hits: v.number(),
    resetTime: v.number(),
  })
    .index('by_key', ['key'])
    .index('by_reset_time', ['resetTime']), // For cleanup if needed
});
