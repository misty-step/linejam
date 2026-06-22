import type { Doc, Id } from '../../convex/_generated/dataModel';
import { setupConvexTest } from './convexTest';

/**
 * Shared seeding + auth primitives for the convex-test suites (backlog 018).
 *
 * Every `tests/convex/*` suite runs on the real in-memory engine via
 * `setupConvexTest()`. These are the genuinely-common building blocks — a typed
 * tester handle, Clerk-identity auth, user/line inserts, and a line reader — so
 * suites stop re-deriving them. Suite-specific game seeding (assignment
 * matrices, mode-specific rosters) stays local to each suite, where the shape
 * is part of the test's intent.
 */

/** The convex-test tester handle returned by `setupConvexTest()`. */
export type T = ReturnType<typeof setupConvexTest>;

/**
 * Scope subsequent calls to a Clerk-authenticated identity. The seeded user
 * must carry `clerkUserId: ` + `clerk_${name}` (see `seedClerkUser`), which is
 * how `getUser` resolves identity → user row via the `by_clerk` index.
 */
export const asUser = (t: T, name: string) =>
  t.withIdentity({ subject: `clerk_${name}` });

/**
 * Insert a `users` row with an explicit shape. The general form: any mix of
 * `clerkUserId` / `guestId` / `kind`, for suites that need users without a
 * Clerk identity (AI authors, guest-token paths, "unknown author" fallbacks).
 * Prefer `seedClerkUser` for the common Clerk-authenticated case.
 */
export function seedUser(
  t: T,
  opts: {
    displayName: string;
    clerkUserId?: string;
    guestId?: string;
    kind?: 'human' | 'AI';
    createdAt?: number;
  }
): Promise<Id<'users'>> {
  return t.run((ctx) =>
    ctx.db.insert('users', {
      displayName: opts.displayName,
      kind: opts.kind ?? 'human',
      ...(opts.clerkUserId ? { clerkUserId: opts.clerkUserId } : {}),
      ...(opts.guestId ? { guestId: opts.guestId } : {}),
      createdAt: opts.createdAt ?? 0,
    })
  );
}

/**
 * Insert a Clerk-authenticated user named `clerk_${name}`, ready to act via
 * `asUser(t, name)`. `displayName` defaults to `name`.
 */
export function seedClerkUser(
  t: T,
  name: string,
  opts: { displayName?: string; kind?: 'human' | 'AI' } = {}
): Promise<Id<'users'>> {
  return seedUser(t, {
    displayName: opts.displayName ?? name,
    clerkUserId: `clerk_${name}`,
    kind: opts.kind,
  });
}

/** Insert one `lines` row for a poem. */
export function seedLine(
  t: T,
  opts: {
    poemId: Id<'poems'>;
    authorUserId: Id<'users'>;
    indexInPoem?: number;
    text?: string;
    wordCount?: number;
    authorDisplayName?: string;
  }
): Promise<Id<'lines'>> {
  return t.run((ctx) =>
    ctx.db.insert('lines', {
      poemId: opts.poemId,
      indexInPoem: opts.indexInPoem ?? 0,
      text: opts.text ?? 'sample text',
      wordCount: opts.wordCount ?? 1,
      authorUserId: opts.authorUserId,
      ...(opts.authorDisplayName !== undefined
        ? { authorDisplayName: opts.authorDisplayName }
        : {}),
      createdAt: 0,
    })
  );
}

/** All `lines` for a game's poems, flattened (order not guaranteed). */
export function getAllLines(
  t: T,
  gameId: Id<'games'>
): Promise<Doc<'lines'>[]> {
  return t.run(async (ctx) => {
    const poems = await ctx.db
      .query('poems')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .collect();
    const perPoem = await Promise.all(
      poems.map((poem) =>
        ctx.db
          .query('lines')
          .withIndex('by_poem', (q) => q.eq('poemId', poem._id))
          .collect()
      )
    );
    return perPoem.flat();
  });
}
