import { describe, expect, it } from 'vitest';
import { api } from '@/convex/_generated/api';
import { setupConvexTest } from '@/tests/helpers/convexTest';

describe('untrusted poem links', () => {
  it('treats malformed and wrong-table identifiers as unavailable without disclosing another document', async () => {
    const t = setupConvexTest();
    const userId = await t.run((ctx) =>
      ctx.db.insert('users', {
        clerkUserId: 'poem-link-reader',
        displayName: 'Reader',
        createdAt: 1,
      })
    );
    const reader = t.withIdentity({ subject: 'poem-link-reader' });
    for (const poemId of ['not-a-document-id', userId]) {
      const outcomes = await Promise.all([
        reader.query(api.poems.getPoemDetail, { poemId }),
        t.query(api.poems.getPublicPoemFull, { poemId }),
        t.query(api.poems.getPublicPoemPreview, { poemId }),
      ]);
      expect(outcomes).toEqual([null, null, null]);
    }
  });
});
