import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    clerkUserId: v.optional(v.string()),
    guestId: v.optional(v.string()),
    displayName: v.string(),
    createdAt: v.number(),
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
    status: v.union(v.literal('IN_PROGRESS'), v.literal('COMPLETED')),
    currentRound: v.number(),
    assignmentMatrix: v.array(v.array(v.id('users'))),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index('by_room', ['roomId']),

  poems: defineTable({
    roomId: v.id('rooms'),
    indexInRoom: v.number(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index('by_room', ['roomId'])
    .index('by_room_index', ['roomId', 'indexInRoom']),

  lines: defineTable({
    poemId: v.id('poems'),
    indexInPoem: v.number(),
    text: v.string(),
    wordCount: v.number(),
    authorUserId: v.id('users'),
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
});
