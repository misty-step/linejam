import { makeFunctionReference } from 'convex/server';
import { describe, expect, it } from 'vitest';
import type { Id } from '../../convex/_generated/dataModel';
import type { LinejamConvexTest } from '../helpers/convexTest';
import { setupConvexTest } from '../helpers/convexTest';

const RELEASE = 'a'.repeat(40);
const LEASE_ONE = '11111111-1111-4111-8111-111111111111';
const LEASE_TWO = '22222222-2222-4222-8222-222222222222';

const claimAgentReceipt = makeFunctionReference<
  'mutation',
  { leaseId: string; now: number },
  {
    _id: Id<'sentryGithubReceipts'>;
    githubIssueNumber: number;
    agentAttempts: number;
    agentLeaseExpiresAt: number;
  } | null
>('sentryGithub:claimAgentReceipt');
const completeAgentReceipt = makeFunctionReference<
  'mutation',
  {
    receiptId: Id<'sentryGithubReceipts'>;
    leaseId: string;
    outcome: 'completed' | 'retry' | 'issue_closed' | 'issue_invalid';
    now: number;
  },
  boolean
>('sentryGithub:completeAgentReceipt');
const enqueueLinkedAgentReceipts = makeFunctionReference<
  'mutation',
  { cursor?: string; limit?: number; now?: number },
  { enqueued: number; continueCursor: string; isDone: boolean }
>('sentryGithub:enqueueLinkedAgentReceipts');

async function insertLinkedReceipt(
  t: LinejamConvexTest,
  overrides: Record<string, unknown> = {}
) {
  return t.run((ctx) =>
    ctx.db.insert('sentryGithubReceipts', {
      dedupKey: 'v1:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee:42:123456',
      installationUuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      projectId: '42',
      sentryIssueId: '123456',
      sentryEventId: '0123456789abcdef0123456789abcdef',
      state: 'linked',
      attempts: 1,
      createdAt: 100,
      updatedAt: 100,
      nextAttemptAt: 100,
      runtime: 'convex',
      environment: 'production',
      release: RELEASE,
      level: 'error',
      operation: 'finishAbandonedGame',
      failureCode: 'unexpected_error',
      githubIssueNumber: 426,
      linkedAt: 100,
      agentState: 'pending',
      agentAttempts: 0,
      agentNextAttemptAt: 100,
      ...overrides,
    })
  );
}

describe('atomic Sentry agent dispatch state', () => {
  it('grants one lease and rejects overlapping claims', async () => {
    const t = setupConvexTest();
    const receiptId = await insertLinkedReceipt(t);

    const first = await t.mutation(claimAgentReceipt, {
      leaseId: LEASE_ONE,
      now: 1_000,
    });
    const overlapping = await t.mutation(claimAgentReceipt, {
      leaseId: LEASE_TWO,
      now: 1_001,
    });

    expect(first).toMatchObject({
      _id: receiptId,
      githubIssueNumber: 426,
      agentAttempts: 1,
    });
    expect(overlapping).toBeNull();
  });

  it('accepts completion only from the active lease', async () => {
    const t = setupConvexTest();
    const receiptId = await insertLinkedReceipt(t);
    await t.mutation(claimAgentReceipt, { leaseId: LEASE_ONE, now: 1_000 });

    await expect(
      t.mutation(completeAgentReceipt, {
        receiptId,
        leaseId: LEASE_TWO,
        outcome: 'completed',
        now: 2_000,
      })
    ).resolves.toBe(false);
    await expect(
      t.mutation(completeAgentReceipt, {
        receiptId,
        leaseId: LEASE_ONE,
        outcome: 'completed',
        now: 2_000,
      })
    ).resolves.toBe(true);
    expect(await t.run((ctx) => ctx.db.get(receiptId))).toMatchObject({
      agentState: 'completed',
      agentCompletedAt: 2_000,
    });
  });

  it('reclaims an expired lease without a second active owner', async () => {
    const t = setupConvexTest();
    await insertLinkedReceipt(t);
    const first = await t.mutation(claimAgentReceipt, {
      leaseId: LEASE_ONE,
      now: 1_000,
    });
    const reclaimed = await t.mutation(claimAgentReceipt, {
      leaseId: LEASE_TWO,
      now: first!.agentLeaseExpiresAt + 1,
    });

    expect(reclaimed).toMatchObject({ agentAttempts: 2 });
    expect(reclaimed!.agentLeaseExpiresAt).toBeGreaterThan(
      first!.agentLeaseExpiresAt
    );
  });

  it('blocks a receipt after three failed agent attempts', async () => {
    const t = setupConvexTest();
    const receiptId = await insertLinkedReceipt(t, { agentAttempts: 2 });
    await t.mutation(claimAgentReceipt, { leaseId: LEASE_ONE, now: 1_000 });
    await t.mutation(completeAgentReceipt, {
      receiptId,
      leaseId: LEASE_ONE,
      outcome: 'retry',
      now: 2_000,
    });

    expect(await t.run((ctx) => ctx.db.get(receiptId))).toMatchObject({
      agentState: 'blocked',
      agentBlockedCode: 'attempts_exhausted',
    });
  });

  it('backfills already-linked receipts without changing completed work', async () => {
    const t = setupConvexTest();
    const legacyId = await insertLinkedReceipt(t, {
      agentState: undefined,
      agentAttempts: undefined,
      agentNextAttemptAt: undefined,
    });
    const completedId = await insertLinkedReceipt(t, {
      dedupKey: 'v1:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee:42:654321',
      sentryIssueId: '654321',
      githubIssueNumber: 427,
      agentState: 'completed',
      agentCompletedAt: 500,
    });

    const result = await t.mutation(enqueueLinkedAgentReceipts, {
      now: 1_000,
      limit: 10,
    });
    expect(result.enqueued).toBe(1);
    expect(await t.run((ctx) => ctx.db.get(legacyId))).toMatchObject({
      agentState: 'pending',
      agentAttempts: 0,
      agentNextAttemptAt: 1_000,
    });
    expect(await t.run((ctx) => ctx.db.get(completedId))).toMatchObject({
      agentState: 'completed',
      agentCompletedAt: 500,
    });
  });
});
