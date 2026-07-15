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

  migrations: defineTable({
    guestUserId: v.id('users'),
    clerkUserId: v.string(),
    migratedAt: v.number(),
  }).index('by_clerk', ['clerkUserId']),

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
    .index('by_host', ['hostUserId'])
    .index('by_status_created', ['status', 'createdAt']),

  roomPlayers: defineTable({
    roomId: v.id('rooms'),
    userId: v.id('users'),
    displayName: v.string(),
    seatIndex: v.optional(v.number()),
    joinedAt: v.number(),
    /** Last client heartbeat timestamp (ms). Missing on legacy rows; treated as stale. */
    lastSeenAt: v.optional(v.number()),
  })
    .index('by_room', ['roomId'])
    .index('by_user', ['userId'])
    .index('by_room_user', ['roomId', 'userId']),

  games: defineTable({
    roomId: v.id('rooms'),
    status: v.union(v.literal('IN_PROGRESS'), v.literal('COMPLETED')),
    /** Game session count for this room. First game = 1. */
    cycle: v.number(),
    /** Round index within current game. Shape comes from convex/lib/gameRules.ts. */
    currentRound: v.number(),
    /** When the current round opened. Drives the soft clock and ghostwriter overtime gate. */
    roundStartedAt: v.optional(v.number()),
    assignmentMatrix: v.array(v.array(v.id('users'))),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    publicRecapEnabled: v.optional(v.boolean()),
    publicRecapEnabledAt: v.optional(v.number()),
    publicRecapDisabledAt: v.optional(v.number()),
  })
    .index('by_room', ['roomId'])
    .index('by_room_cycle', ['roomId', 'cycle'])
    .index('by_room_status', ['roomId', 'status'])
    // Idle-age-ordered scan for the abandonment sweep cron (convex/abandonment.ts):
    // status === IN_PROGRESS ordered by roundStartedAt, so the sweep reads only
    // games already idle past the threshold, oldest first — bounded, no starvation.
    .index('by_status_round', ['status', 'roundStartedAt']),

  poems: defineTable({
    roomId: v.id('rooms'),
    gameId: v.id('games'),
    /** Poem ordinal within game (0-based). One poem per player. */
    indexInRoom: v.number(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    // Reveal phase
    assignedReaderId: v.optional(v.id('users')),
    revealedAt: v.optional(v.number()),
    publicShareEnabled: v.optional(v.boolean()),
    publicShareEnabledAt: v.optional(v.number()),
    publicShareDisabledAt: v.optional(v.number()),
  })
    .index('by_room', ['roomId'])
    .index('by_room_index', ['roomId', 'indexInRoom'])
    .index('by_reader', ['assignedReaderId'])
    .index('by_game', ['gameId'])
    .index('by_room_public_created', [
      'roomId',
      'publicShareEnabled',
      'createdAt',
    ])
    .index('by_public_created', ['publicShareEnabled', 'createdAt'])
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
    .index('by_author', ['authorUserId'])
    .index('by_author_created', ['authorUserId', 'createdAt']),

  aiTurns: defineTable({
    roomId: v.id('rooms'),
    gameId: v.id('games'),
    poemId: v.id('poems'),
    round: v.number(),
    aiUserId: v.id('users'),
    day: v.string(),
    status: v.union(
      v.literal('authorized'),
      v.literal('budget_fallback'),
      v.literal('deterministic_fallback')
    ),
    claimedAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_cell', ['poemId', 'round'])
    .index('by_game_round', ['gameId', 'round'])
    .index('by_day', ['day']),

  aiUsage: defineTable({
    day: v.string(),
    // Total bot + ghostwriter generation claims for the day. This is the
    // production-readable spend counter and the source for the threshold alert.
    generationClaims: v.number(),
    httpAttempts: v.number(),
    fallbacks: v.number(),
    estimatedCostMicros: v.optional(v.number()),
    updatedAt: v.number(),
  }).index('by_day', ['day']),

  // One aggregate row per UTC hour. This keeps fallback-rate observability
  // bounded regardless of room or generation volume and stores no content or
  // player identifiers.
  aiGenerationMetrics: defineTable({
    bucketStart: v.number(),
    totalGenerations: v.number(),
    fallbackGenerations: v.number(),
    budgetExhaustion: v.number(),
    providerError: v.number(),
    invalidOutput: v.number(),
    missingConfiguration: v.number(),
    updatedAt: v.number(),
  }).index('by_bucket', ['bucketStart']),

  aiRoundLocks: defineTable({
    roomId: v.id('rooms'),
    gameId: v.id('games'),
    round: v.number(),
    owner: v.string(),
    status: v.union(v.literal('running'), v.literal('finished')),
    claimedAt: v.number(),
    updatedAt: v.number(),
  }).index('by_game_round', ['gameId', 'round']),

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
