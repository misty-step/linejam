import { makeFunctionReference } from 'convex/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { signSentryAutomationProvenance } from '../../sentry.provenance.mjs';
import {
  githubDedupMarker,
  githubIssueContent,
  retryDelayMs,
  validateBridgeTags,
} from '../../convex/sentryGithub';
import { setupConvexTest } from '../helpers/convexTest';

const ORIGINAL_ENV = { ...process.env };
const INSTALLATION_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const SENTRY_EVENT_ID = '0123456789abcdef0123456789abcdef';
const CANONICAL_KEY = `v1:${INSTALLATION_UUID}:42:123456`;
const DEDUP_KEY = `v2:${INSTALLATION_UUID}:42:123456:${SENTRY_EVENT_ID}`;
const RELEASE = 'a'.repeat(40);
const PROVENANCE_SECRET = 'test-provenance-secret-with-at-least-32-bytes';

const acceptWebhook = makeFunctionReference<
  'mutation',
  {
    dedupKey: string;
    canonicalKey: string;
    installationUuid: string;
    projectId: string;
    sentryIssueId: string;
    sentryEventId: string;
    now?: number;
  },
  { receiptId: Id<'sentryGithubReceipts'>; inserted: boolean }
>('sentryGithub:acceptWebhook');

const processReceipt = makeFunctionReference<
  'action',
  { receiptId: Id<'sentryGithubReceipts'> },
  null
>('sentryGithub:processReceipt');
const claimReceipt = makeFunctionReference<
  'mutation',
  { receiptId: Id<'sentryGithubReceipts'>; leaseId: string; now: number },
  { _id: Id<'sentryGithubReceipts'>; attempts: number } | null
>('sentryGithub:claimReceipt');

const renewReceiptLease = makeFunctionReference<
  'mutation',
  { receiptId: Id<'sentryGithubReceipts'>; leaseId: string; now: number },
  boolean
>('sentryGithub:renewReceiptLease');
const replayReceipt = makeFunctionReference<
  'mutation',
  { receiptId: Id<'sentryGithubReceipts'> },
  boolean
>('sentryGithub:replayReceipt');

const getReceipt = makeFunctionReference<
  'query',
  { dedupKey: string },
  Doc<'sentryGithubReceipts'> | null
>('sentryGithub:getReceiptByDedupKey');

const TAGS = {
  runtime: 'convex' as const,
  environment: 'preview' as const,
  release: RELEASE,
  level: 'error' as const,
  operation: 'finishAbandonedGame' as const,
  failureCode: 'unexpected_error' as const,
};

const PREVIEW_TAGS = {
  runtime: 'github-actions' as const,
  environment: 'preview' as const,
  release: RELEASE,
  level: 'error' as const,
  operation: 'previewSmoke' as const,
  failureCode: 'unexpected_error' as const,
};
const PROVENANCE = await signSentryAutomationProvenance(PROVENANCE_SECRET, {
  eventId: SENTRY_EVENT_ID,
  ...TAGS,
});
const PREVIEW_PROVENANCE = await signSentryAutomationProvenance(
  PROVENANCE_SECRET,
  {
    eventId: SENTRY_EVENT_ID,
    ...PREVIEW_TAGS,
  }
);

function bridgeEnv() {
  process.env = {
    ...ORIGINAL_ENV,
    SENTRY_EVENT_WRITE_TOKEN: 'test-sentry-token',
    SENTRY_AUTOMATION_PROVENANCE_SECRET: PROVENANCE_SECRET,
    SENTRY_ORG: 'misty-step',
    GITHUB_ISSUES_TOKEN: 'test-github-token',
    SENTRY_GITHUB_INTEGRATION_ID: '338522',
    GITHUB_REPOSITORY_OWNER: 'misty-step',
    GITHUB_REPOSITORY_NAME: 'linejam',
  };
}

async function insertReceipt() {
  const t = setupConvexTest();
  const accepted = await t.mutation(acceptWebhook, {
    dedupKey: DEDUP_KEY,
    canonicalKey: CANONICAL_KEY,
    installationUuid: INSTALLATION_UUID,
    projectId: '42',
    sentryIssueId: '123456',
    sentryEventId: SENTRY_EVENT_ID,
    now: 1_000,
  });
  return { t, receiptId: accepted.receiptId };
}

function eventPayload(tags: Record<string, string> = TAGS) {
  const provenance =
    tags.runtime === 'github-actions' && tags.operation === 'previewSmoke'
      ? PREVIEW_PROVENANCE
      : PROVENANCE;
  return {
    eventID: SENTRY_EVENT_ID,
    groupID: '123456',
    tags: [
      { key: 'ignored', value: 'not-persisted' },
      ...Object.entries({ ...tags, provenance }).map(([field, value]) => ({
        key: field === 'failureCode' ? 'failure_code' : field,
        value,
      })),
    ],
  };
}

interface RecoveredIssueOverrides {
  body?: unknown;
  labels?: unknown;
  state?: unknown;
  title?: unknown;
  user?: unknown;
}

function recoveredIssue(
  number: number,
  tags: Record<string, string> = TAGS,
  overrides: RecoveredIssueOverrides = {}
) {
  const validatedTags = validateBridgeTags(tags);
  if (!validatedTags) throw new Error('recovery fixture tags must be valid');
  const content = githubIssueContent(
    {
      canonicalKey: CANONICAL_KEY,
      projectId: '42',
      sentryIssueId: '123456',
      sentryEventId: SENTRY_EVENT_ID,
    },
    validatedTags
  );
  return {
    number,
    title: content.title,
    body: content.body,
    state: 'open',
    repository_url: 'https://api.github.com/repos/misty-step/linejam',
    user: { login: 'bridge-bot' },
    labels: content.labels.map((name) => ({ name })),
    ...overrides,
  };
}

function tagResponse(
  url: string,
  tags: Record<string, string> = TAGS
): Response | null {
  if (url.endsWith('/user')) {
    return Response.json({ login: 'bridge-bot' });
  }
  if (
    !url.endsWith(
      `/organizations/misty-step/issues/123456/events/${SENTRY_EVENT_ID}/`
    )
  ) {
    return null;
  }
  return Response.json(eventPayload(tags));
}
function linkedConfig(issueNumber?: number) {
  return {
    linkIssueConfig: [
      {
        name: 'repo',
        choices: [['misty-step/linejam', 'misty-step/linejam']],
      },
      { name: 'externalIssue' },
    ],
    linkedIssues:
      issueNumber === undefined
        ? []
        : [{ key: `misty-step/linejam#${issueNumber}` }],
  };
}

describe('durable Sentry to GitHub bridge', () => {
  afterAll(() => {
    process.env = ORIGINAL_ENV;
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    bridgeEnv();
    vi.restoreAllMocks();
  });

  it('accepts only the exact closed tag vocabulary', () => {
    expect(validateBridgeTags(TAGS)).toEqual(TAGS);
    expect(
      validateBridgeTags({
        ...TAGS,
        runtime: 'github-actions',
        operation: 'productionSmoke',
      })
    ).toMatchObject({
      runtime: 'github-actions',
      operation: 'productionSmoke',
    });
    expect(
      validateBridgeTags({ ...TAGS, environment: 'production' })
    ).toMatchObject({ environment: 'production' });
    expect(validateBridgeTags({ ...TAGS, runtime: 'node' })).toBeNull();
    expect(validateBridgeTags({ ...TAGS, environment: 'stage' })).toBeNull();
    expect(validateBridgeTags({ ...TAGS, release: 'A'.repeat(40) })).toBeNull();
    expect(validateBridgeTags({ ...TAGS, level: 'warning' })).toBeNull();
    expect(validateBridgeTags({ ...TAGS, operation: 'arbitrary' })).toBeNull();
    expect(
      validateBridgeTags({ ...TAGS, failureCode: 'raw provider body' })
    ).toBeNull();
  });

  it('generates GitHub content only from closed tags and allowlisted IDs', () => {
    const content = githubIssueContent(
      {
        canonicalKey: CANONICAL_KEY,
        projectId: '42',
        sentryIssueId: '123456',
        sentryEventId: '0123456789abcdef0123456789abcdef',
      },
      TAGS
    );
    expect(content.title).toBe(
      '[Convex/preview] finishAbandonedGame: unexpected_error'
    );
    expect(content.labels).toEqual([
      'p1',
      'source/sentry',
      'domain/infra',
      'source/agent',
    ]);
    expect(content.body).toContain(githubDedupMarker(CANONICAL_KEY));
    expect(content.body).not.toMatch(
      /title|message|culprit|stack|request|user/i
    );
    expect(
      githubIssueContent(
        {
          canonicalKey: CANONICAL_KEY,
          projectId: '42',
          sentryIssueId: '123456',
          sentryEventId: SENTRY_EVENT_ID,
        },
        PREVIEW_TAGS
      ).title
    ).toBe('[GitHub Actions/preview] previewSmoke: unexpected_error');
  });

  it('uses bounded exponential backoff with jitter', () => {
    expect(retryDelayMs(1, 0)).toBe(500);
    expect(retryDelayMs(1, 1)).toBe(1000);
    expect(retryDelayMs(4, 0)).toBe(4000);
    expect(retryDelayMs(100, 1)).toBeLessThanOrEqual(60 * 60 * 1000);
  });
  it('renews only the current unexpired worker lease', async () => {
    const { t, receiptId } = await insertReceipt();
    const leaseId = '11111111-1111-4111-8111-111111111111';
    expect(
      await t.mutation(claimReceipt, { receiptId, leaseId, now: 1_000 })
    ).toMatchObject({ _id: receiptId, attempts: 1 });
    expect(
      await t.mutation(renewReceiptLease, {
        receiptId,
        leaseId,
        now: 2_000,
      })
    ).toBe(true);
    expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
      leaseExpiresAt: 122_000,
      updatedAt: 2_000,
    });
    expect(
      await t.mutation(renewReceiptLease, {
        receiptId,
        leaseId: '22222222-2222-4222-8222-222222222222',
        now: 3_000,
      })
    ).toBe(false);
    expect(
      await t.mutation(renewReceiptLease, {
        receiptId,
        leaseId,
        now: 122_000,
      })
    ).toBe(false);
  });

  it('recovers a lost create by exact marker and does not create a second issue', async () => {
    const { t, receiptId } = await insertReceipt();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);
        const tag = tagResponse(url);
        if (tag) return tag;
        if (url.includes('/search/issues')) {
          return Response.json({ items: [recoveredIssue(77)] });
        }
        if (
          url.endsWith('/repos/misty-step/linejam/issues/77') &&
          init?.method === 'PATCH'
        ) {
          return Response.json({ number: 77 });
        }
        if (url.includes('/integrations/338522/') && !init?.method) {
          return Response.json(linkedConfig());
        }
        if (url.includes('/integrations/338522/') && init?.method === 'PUT') {
          return new Response(null, { status: 201 });
        }
        throw new Error('unexpected endpoint');
      });

    await t.action(processReceipt, { receiptId });

    const receipt = await t.query(getReceipt, { dedupKey: DEDUP_KEY });
    expect(receipt).toMatchObject({
      state: 'linked',
      githubIssueNumber: 77,
      runtime: 'convex',
      environment: 'preview',
      release: RELEASE,
    });
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input).endsWith('/repos/misty-step/linejam/issues') &&
          init?.method === 'POST'
      )
    ).toBe(false);
  });

  it('reopens one canonical closed issue and ignores attacker candidates', async () => {
    const { t, receiptId } = await insertReceipt();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);
        const tag = tagResponse(url);
        if (tag) return tag;
        if (url.includes('/search/issues')) {
          return Response.json({
            items: [
              recoveredIssue(66, TAGS, {
                user: { login: 'attacker' },
              }),
              recoveredIssue(67, TAGS, {
                state: 'closed',
                labels: [],
                title: 'Prior incident title',
              }),
            ],
          });
        }
        if (
          url.endsWith('/repos/misty-step/linejam/issues/67') &&
          init?.method === 'PATCH'
        ) {
          return Response.json({ number: 67 });
        }
        if (url.includes('/integrations/338522/') && !init?.method) {
          return Response.json(linkedConfig());
        }
        if (url.includes('/integrations/338522/') && init?.method === 'PUT') {
          return new Response(null, { status: 201 });
        }
        throw new Error('unexpected endpoint');
      });

    await t.action(processReceipt, { receiptId });

    expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
      state: 'linked',
      githubIssueNumber: 67,
    });
    const reopenCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).endsWith('/repos/misty-step/linejam/issues/67') &&
        init?.method === 'PATCH'
    );
    expect(reopenCall).toBeDefined();
    expect(JSON.parse(String(reopenCall?.[1]?.body))).toMatchObject({
      state: 'open',
      state_reason: 'reopened',
      title: '[Convex/preview] finishAbandonedGame: unexpected_error',
    });
    expect(String(reopenCall?.[1]?.body)).toContain(
      `- Sentry event ID: ${SENTRY_EVENT_ID}`
    );
  });

  it('persists and links a GitHub Actions preview failure', async () => {
    const { t, receiptId } = await insertReceipt();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const tag = tagResponse(url, PREVIEW_TAGS);
      if (tag) return tag;
      if (url.includes('/search/issues')) {
        return Response.json({ items: [recoveredIssue(78, PREVIEW_TAGS)] });
      }
      if (
        url.endsWith('/repos/misty-step/linejam/issues/78') &&
        init?.method === 'PATCH'
      ) {
        return Response.json({ number: 78 });
      }
      if (url.includes('/integrations/338522/') && !init?.method) {
        return Response.json(linkedConfig());
      }
      if (url.includes('/integrations/338522/') && init?.method === 'PUT') {
        return new Response(null, { status: 201 });
      }
      throw new Error('unexpected endpoint');
    });

    await t.action(processReceipt, { receiptId });

    expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
      state: 'linked',
      githubIssueNumber: 78,
      runtime: 'github-actions',
      environment: 'preview',
      operation: 'previewSmoke',
      failureCode: 'unexpected_error',
    });
  });

  it('honors Retry-After without persisting an error body', async () => {
    const { t, receiptId } = await insertReceipt();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('PROHIBITED_PROVIDER_BODY', {
        status: 429,
        headers: { 'Retry-After': '17' },
      })
    );
    const before = Date.now();

    await t.action(processReceipt, { receiptId });

    const receipt = await t.query(getReceipt, { dedupKey: DEDUP_KEY });
    expect(receipt).toMatchObject({ state: 'pending', attempts: 1 });
    expect(receipt?.nextAttemptAt).toEqual(expect.any(Number));
    expect(receipt?.nextAttemptAt).toBeGreaterThanOrEqual(before + 17_000);
    expect(JSON.stringify(receipt)).not.toContain('PROHIBITED_PROVIDER_BODY');
  });

  it('honors an HTTP-date Retry-After value', async () => {
    const { t, receiptId } = await insertReceipt();
    const before = Date.now();
    const retryAt = new Date(before + 30_000).toUTCString();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 429,
        headers: { 'Retry-After': retryAt },
      })
    );

    await t.action(processReceipt, { receiptId });

    const receipt = await t.query(getReceipt, { dedupKey: DEDUP_KEY });
    expect(receipt).toMatchObject({ state: 'pending', attempts: 1 });
    expect(receipt?.nextAttemptAt).toBeGreaterThanOrEqual(before + 28_000);
    expect(receipt?.nextAttemptAt).toBeLessThanOrEqual(before + 31_000);
  });
  it.each([
    ['absent', null],
    ['malformed', 'not-a-date'],
  ] as const)(
    'falls back to bounded retry timing when Retry-After is %s',
    async (_case, retryAfter) => {
      const { t, receiptId } = await insertReceipt();
      const headers = new Headers();
      if (retryAfter !== null) headers.set('Retry-After', retryAfter);
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(null, { status: 429, headers })
      );

      await t.action(processReceipt, { receiptId });

      const receipt = await t.query(getReceipt, { dedupKey: DEDUP_KEY });
      expect(receipt).toMatchObject({ state: 'pending', attempts: 1 });
      expect(receipt?.nextAttemptAt).toEqual(expect.any(Number));
    }
  );

  it('maps a Sentry transport failure to a bounded retry without persisting it', async () => {
    const { t, receiptId } = await insertReceipt();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('PROHIBITED_PROVIDER_BODY')
    );

    await t.action(processReceipt, { receiptId });

    const receipt = await t.query(getReceipt, { dedupKey: DEDUP_KEY });
    expect(receipt).toMatchObject({ state: 'pending', attempts: 1 });
    expect(receipt?.nextAttemptAt).toEqual(expect.any(Number));
    expect(JSON.stringify(receipt)).not.toContain('PROHIBITED_PROVIDER_BODY');
  });

  it('blocks a conflicting native Sentry link without custom sync', async () => {
    const { t, receiptId } = await insertReceipt();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const tag = tagResponse(url);
      if (tag) return tag;
      if (url.includes('/search/issues')) {
        return Response.json({ items: [recoveredIssue(77)] });
      }
      if (url.includes('/integrations/338522/')) {
        return Response.json(linkedConfig(999));
      }
      throw new Error('unexpected endpoint');
    });

    await t.action(processReceipt, { receiptId });

    expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
      state: 'blocked',
      blockedCode: 'link_conflict',
      githubIssueNumber: 77,
    });
  });
  it.each(['misty-step/linejam#77', '#77', '77'])(
    'accepts an existing native Sentry link key %s',
    async (key) => {
      const { t, receiptId } = await insertReceipt();
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async (input, init) => {
          const url = String(input);
          const tag = tagResponse(url);
          if (tag) return tag;
          if (url.includes('/search/issues')) {
            return Response.json({ items: [recoveredIssue(77)] });
          }
          if (url.includes('/integrations/338522/') && !init?.method) {
            return Response.json({
              ...linkedConfig(),
              linkedIssues: [{ key }],
            });
          }
          throw new Error('unexpected endpoint');
        });

      await t.action(processReceipt, { receiptId });

      expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
        state: 'linked',
        githubIssueNumber: 77,
      });
      expect(
        fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')
      ).toBe(false);
    }
  );

  it.each([
    ['string choice', ['misty-step/linejam'], undefined],
    ['later string choice', ['other/repository', 'misty-step/linejam'], []],
    ['tuple choice', [['Linejam', 'misty-step/linejam']], []],
    [
      'later object choice',
      [{ value: 'other/repository' }, { value: 'misty-step/linejam' }],
      [],
    ],
    ['object choice', [{ value: 'misty-step/linejam' }], []],
  ] as const)(
    'accepts a Sentry repository %s',
    async (_case, choices, linkedIssues) => {
      const { t, receiptId } = await insertReceipt();
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input);
        const tag = tagResponse(url);
        if (tag) return tag;
        if (url.includes('/search/issues')) {
          return Response.json({ items: [recoveredIssue(77)] });
        }
        if (url.includes('/integrations/338522/') && !init?.method) {
          return Response.json({
            linkIssueConfig: [
              { name: 'repo', choices },
              { name: 'externalIssue' },
            ],
            linkedIssues,
          });
        }
        if (url.includes('/integrations/338522/') && init?.method === 'PUT') {
          return new Response(null, { status: 201 });
        }
        throw new Error('unexpected endpoint');
      });

      await t.action(processReceipt, { receiptId });

      expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
        state: 'linked',
        githubIssueNumber: 77,
      });
    }
  );

  it.each([
    ['missing linkIssueConfig', {}],
    ['null linkIssueConfig', { linkIssueConfig: null }],
    ['null field', { linkIssueConfig: [null] }],
    ['array field', { linkIssueConfig: [[]] }],
    ['non-string field name', { linkIssueConfig: [{ name: 42 }] }],
    [
      'non-array choices',
      {
        linkIssueConfig: [
          { name: 'repo', choices: null },
          { name: 'externalIssue' },
        ],
      },
    ],
    [
      'numeric choice',
      {
        linkIssueConfig: [
          { name: 'repo', choices: [42] },
          { name: 'externalIssue' },
        ],
      },
    ],
    [
      'non-string choice tuple',
      {
        linkIssueConfig: [
          { name: 'repo', choices: [[42]] },
          { name: 'externalIssue' },
        ],
      },
    ],
    [
      'choice object without value',
      {
        linkIssueConfig: [
          { name: 'repo', choices: [{}] },
          { name: 'externalIssue' },
        ],
      },
    ],
    [
      'non-string choice object value',
      {
        linkIssueConfig: [
          { name: 'repo', choices: [{ value: 42 }] },
          { name: 'externalIssue' },
        ],
      },
    ],
    [
      'non-array linkedIssues',
      {
        linkIssueConfig: [
          { name: 'repo', choices: ['misty-step/linejam'] },
          { name: 'externalIssue' },
        ],
        linkedIssues: null,
      },
    ],
    [
      'null linked issue',
      {
        linkIssueConfig: [
          { name: 'repo', choices: ['misty-step/linejam'] },
          { name: 'externalIssue' },
        ],
        linkedIssues: [null],
      },
    ],
    [
      'array linked issue',
      {
        linkIssueConfig: [
          { name: 'repo', choices: ['misty-step/linejam'] },
          { name: 'externalIssue' },
        ],
        linkedIssues: [[]],
      },
    ],
    [
      'non-string linked issue key',
      {
        linkIssueConfig: [
          { name: 'repo', choices: ['misty-step/linejam'] },
          { name: 'externalIssue' },
        ],
        linkedIssues: [{ key: 42 }],
      },
    ],
  ] as const)('blocks a Sentry link config with a %s', async (_case, body) => {
    const { t, receiptId } = await insertReceipt();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const tag = tagResponse(url);
      if (tag) return tag;
      if (url.includes('/search/issues')) {
        return Response.json({ items: [recoveredIssue(77)] });
      }
      if (url.includes('/integrations/338522/')) {
        return Response.json(body);
      }
      throw new Error('unexpected endpoint');
    });

    await t.action(processReceipt, { receiptId });

    expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
      state: 'blocked',
      blockedCode: 'configuration_invalid',
      githubIssueNumber: 77,
    });
  });

  it('creates and links one GitHub issue, then ignores duplicate workers', async () => {
    const { t, receiptId } = await insertReceipt();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);
        const tag = tagResponse(url);
        if (tag) return tag;
        if (url.includes('/search/issues')) {
          return Response.json({ items: [] });
        }
        if (url.includes('/repos/misty-step/linejam/labels/')) {
          return Response.json({ name: 'configured' });
        }
        if (
          url.endsWith('/repos/misty-step/linejam/issues') &&
          init?.method === 'POST'
        ) {
          return Response.json({ number: 88 }, { status: 201 });
        }
        if (url.includes('/integrations/338522/') && !init?.method) {
          return Response.json(linkedConfig());
        }
        if (url.includes('/integrations/338522/') && init?.method === 'PUT') {
          return new Response(null, { status: 201 });
        }
        throw new Error('unexpected endpoint');
      });

    await t.action(processReceipt, { receiptId });
    await t.action(processReceipt, { receiptId });

    expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
      state: 'linked',
      githubIssueNumber: 88,
    });
    expect(
      fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith('/repos/misty-step/linejam/issues') &&
          init?.method === 'POST'
      )
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith(
            '/issues/123456/integrations/338522/?action=link'
          ) && init?.method === undefined
      )
    ).toHaveLength(1);
    const linkCalls = fetchMock.mock.calls.filter(
      ([input, init]) =>
        String(input).endsWith('/issues/123456/integrations/338522/') &&
        init?.method === 'PUT'
    );
    expect(linkCalls).toHaveLength(1);
    expect(JSON.parse(String(linkCalls[0]?.[1]?.body))).toEqual({
      repo: 'misty-step/linejam',
      externalIssue: '88',
    });
    expect(
      fetchMock.mock.calls.every(
        ([, init]) => init?.signal instanceof AbortSignal
      )
    ).toBe(true);
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith(
          `/organizations/misty-step/issues/123456/events/${SENTRY_EVENT_ID}/`
        )
      )
    ).toHaveLength(1);
  });

  it('serializes concurrent receipts and reuses the canonical GitHub issue', async () => {
    const secondEventId = 'b'.repeat(32);
    const secondDedupKey = `v2:${INSTALLATION_UUID}:42:123456:${secondEventId}`;
    const secondProvenance = await signSentryAutomationProvenance(
      PROVENANCE_SECRET,
      {
        eventId: secondEventId,
        ...TAGS,
      }
    );
    const { t, receiptId } = await insertReceipt();
    const second = await t.mutation(acceptWebhook, {
      dedupKey: secondDedupKey,
      canonicalKey: CANONICAL_KEY,
      installationUuid: INSTALLATION_UUID,
      projectId: '42',
      sentryIssueId: '123456',
      sentryEventId: secondEventId,
      now: 1_000,
    });
    const firstClaim = await t.mutation(claimReceipt, {
      receiptId,
      leaseId: 'concurrent-a',
      now: Date.now(),
    });
    const secondClaim = await t.mutation(claimReceipt, {
      receiptId: second.receiptId,
      leaseId: 'concurrent-b',
      now: Date.now(),
    });
    expect(firstClaim).not.toBeNull();
    expect(secondClaim).toBeNull();
    await t.run(async (ctx) => {
      const receipts = await ctx.db.query('sentryGithubReceipts').collect();
      for (const receipt of receipts) {
        await ctx.db.patch(receipt._id, {
          state: 'pending',
          leaseId: undefined,
          leaseExpiresAt: undefined,
          nextAttemptAt: 0,
          updatedAt: 3_000,
        });
      }
      const canonicalIssue = await ctx.db
        .query('sentryGithubCanonicalIssues')
        .withIndex('by_canonicalKey', (q) =>
          q.eq('canonicalKey', CANONICAL_KEY)
        )
        .unique();
      if (!canonicalIssue) throw new Error('missing canonical issue');
      await ctx.db.patch(canonicalIssue._id, {
        leaseId: undefined,
        leaseExpiresAt: undefined,
        updatedAt: 3_000,
      });
    });
    let searchCalls = 0;
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith('/user')) {
          return Response.json({ login: 'bridge-bot' });
        }
        const eventId = url.match(/\/events\/([0-9a-f]{32})\/$/)?.[1];
        if (eventId) {
          const provenance =
            eventId === secondEventId ? secondProvenance : PROVENANCE;
          return Response.json({
            eventID: eventId,
            groupID: '123456',
            tags: Object.entries({ ...TAGS, provenance }).map(
              ([field, value]) => ({
                key: field === 'failureCode' ? 'failure_code' : field,
                value,
              })
            ),
          });
        }
        if (url.includes('/search/issues')) {
          searchCalls += 1;
          return Response.json({ items: [] });
        }
        if (url.includes('/repos/misty-step/linejam/labels/')) {
          return Response.json({ name: 'configured' });
        }
        if (
          url.endsWith('/repos/misty-step/linejam/issues') &&
          init?.method === 'POST'
        ) {
          return Response.json({ number: 88 }, { status: 201 });
        }
        if (
          url.endsWith('/repos/misty-step/linejam/issues/88') &&
          init?.method === 'PATCH'
        ) {
          return Response.json({ number: 88 });
        }
        if (url.includes('/integrations/338522/') && !init?.method) {
          return Response.json(linkedConfig());
        }
        if (url.includes('/integrations/338522/') && init?.method === 'PUT') {
          return new Response(null, { status: 201 });
        }
        throw new Error('unexpected endpoint');
      });

    await t.action(processReceipt, { receiptId });
    await t.run((ctx) =>
      ctx.db.patch(second.receiptId, {
        nextAttemptAt: 0,
        updatedAt: Date.now(),
      })
    );
    await t.action(processReceipt, { receiptId: second.receiptId });

    const receipts = await t.run((ctx) =>
      ctx.db.query('sentryGithubReceipts').collect()
    );
    expect(
      receipts.map((receipt) => ({
        state: receipt.state,
        githubIssueNumber: receipt.githubIssueNumber,
        agentState: receipt.agentState,
        agentBlockedCode: receipt.agentBlockedCode,
      }))
    ).toEqual([
      {
        state: 'linked',
        githubIssueNumber: 88,
        agentState: 'pending',
        agentBlockedCode: undefined,
      },
      {
        state: 'linked',
        githubIssueNumber: 88,
        agentState: 'queued',
        agentBlockedCode: undefined,
      },
    ]);
    expect(searchCalls).toBe(1);
    expect(
      fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith('/repos/misty-step/linejam/issues') &&
          init?.method === 'POST'
      )
    ).toHaveLength(1);
  });

  it('never repeats an ambiguous canonical GitHub issue create', async () => {
    const secondEventId = 'c'.repeat(32);
    const secondDedupKey = `v2:${INSTALLATION_UUID}:42:123456:${secondEventId}`;
    const secondProvenance = await signSentryAutomationProvenance(
      PROVENANCE_SECRET,
      {
        eventId: secondEventId,
        ...TAGS,
      }
    );
    const { t, receiptId } = await insertReceipt();
    let postCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/user')) {
        return Response.json({ login: 'bridge-bot' });
      }
      const eventId = url.match(/\/events\/([0-9a-f]{32})\/$/)?.[1];
      if (eventId) {
        const provenance =
          eventId === secondEventId ? secondProvenance : PROVENANCE;
        return Response.json({
          eventID: eventId,
          groupID: '123456',
          tags: Object.entries({ ...TAGS, provenance }).map(
            ([field, value]) => ({
              key: field === 'failureCode' ? 'failure_code' : field,
              value,
            })
          ),
        });
      }
      if (url.includes('/search/issues')) {
        return Response.json({ items: [] });
      }
      if (url.includes('/repos/misty-step/linejam/labels/')) {
        return Response.json({ name: 'configured' });
      }
      if (
        url.endsWith('/repos/misty-step/linejam/issues') &&
        init?.method === 'POST'
      ) {
        postCalls += 1;
        throw new TypeError('connection reset after create');
      }
      throw new Error('unexpected endpoint');
    });

    await t.action(processReceipt, { receiptId });
    const second = await t.mutation(acceptWebhook, {
      dedupKey: secondDedupKey,
      canonicalKey: CANONICAL_KEY,
      installationUuid: INSTALLATION_UUID,
      projectId: '42',
      sentryIssueId: '123456',
      sentryEventId: secondEventId,
      now: Date.now(),
    });
    await t.action(processReceipt, { receiptId: second.receiptId });

    expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
      state: 'blocked',
      blockedCode: 'github_create_ambiguous',
    });
    expect(
      await t.query(getReceipt, { dedupKey: secondDedupKey })
    ).toMatchObject({
      state: 'blocked',
      blockedCode: 'github_create_ambiguous',
    });
    expect(postCalls).toBe(1);
  });

  it('clears a definitive create failure so replay can create', async () => {
    const { t, receiptId } = await insertReceipt();
    let authorized = false;
    let postCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const tag = tagResponse(url);
      if (tag) return tag;
      if (url.includes('/search/issues')) {
        return Response.json({ items: [] });
      }
      if (url.includes('/repos/misty-step/linejam/labels/')) {
        return Response.json({ name: 'configured' });
      }
      if (
        url.endsWith('/repos/misty-step/linejam/issues') &&
        init?.method === 'POST'
      ) {
        postCalls += 1;
        return authorized
          ? Response.json({ number: 88 }, { status: 201 })
          : new Response(null, { status: 401 });
      }
      if (url.includes('/integrations/338522/') && !init?.method) {
        return Response.json(linkedConfig());
      }
      if (url.includes('/integrations/338522/') && init?.method === 'PUT') {
        return new Response(null, { status: 201 });
      }
      throw new Error('unexpected endpoint');
    });

    await t.action(processReceipt, { receiptId });
    expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
      state: 'blocked',
      blockedCode: 'github_auth',
    });

    authorized = true;
    expect(await t.mutation(replayReceipt, { receiptId })).toBe(true);
    await t.action(processReceipt, { receiptId });

    expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
      state: 'linked',
      githubIssueNumber: 88,
    });
    expect(postCalls).toBe(2);
  });

  it('renews before fencing create so a lease failure remains replayable', async () => {
    const { t, receiptId } = await insertReceipt();
    await t.run((ctx) => ctx.db.patch(receiptId, { attempts: 9 }));
    let now = 1_000;
    let expireOnSearch = true;
    let postCalls = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const tag = tagResponse(url);
      if (tag) return tag;
      if (url.includes('/search/issues')) {
        if (expireOnSearch) {
          now = 122_001;
          expireOnSearch = false;
        }
        return Response.json({ items: [] });
      }
      if (url.includes('/repos/misty-step/linejam/labels/')) {
        return Response.json({ name: 'configured' });
      }
      if (
        url.endsWith('/repos/misty-step/linejam/issues') &&
        init?.method === 'POST'
      ) {
        postCalls += 1;
        return Response.json({ number: 88 }, { status: 201 });
      }
      if (url.includes('/integrations/338522/') && !init?.method) {
        return Response.json(linkedConfig());
      }
      if (url.includes('/integrations/338522/') && init?.method === 'PUT') {
        return new Response(null, { status: 201 });
      }
      throw new Error('unexpected endpoint');
    });

    await t.action(processReceipt, { receiptId });
    expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
      state: 'blocked',
      blockedCode: 'internal_error',
    });
    expect(postCalls).toBe(0);

    expect(await t.mutation(replayReceipt, { receiptId })).toBe(true);
    await t.action(processReceipt, { receiptId });

    expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
      state: 'linked',
      githubIssueNumber: 88,
    });
    expect(postCalls).toBe(1);
  });

  it('blocks when a fixed GitHub label prerequisite is absent', async () => {
    const { t, receiptId } = await insertReceipt();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        const tag = tagResponse(url);
        if (tag) return tag;
        if (url.includes('/search/issues')) {
          return Response.json({ items: [] });
        }
        if (url.includes('/labels/source%2Fsentry')) {
          return new Response(null, { status: 404 });
        }
        if (url.includes('/labels/')) {
          return Response.json({ name: 'configured' });
        }
        throw new Error('unexpected endpoint');
      });

    await t.action(processReceipt, { receiptId });

    expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
      state: 'blocked',
      blockedCode: 'github_invalid',
    });
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).endsWith('/repos/misty-step/linejam/issues')
      )
    ).toBe(false);
  });

  it.each([
    [401, 'blocked', 'sentry_auth'],
    [404, 'blocked', 'sentry_missing'],
    [400, 'blocked', 'invalid_tags'],
    [500, 'pending', undefined],
  ] as const)(
    'classifies Sentry tag HTTP %i without storing provider content',
    async (status, state, blockedCode) => {
      const { t, receiptId } = await insertReceipt();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('PROHIBITED_PROVIDER_BODY', { status })
      );

      await t.action(processReceipt, { receiptId });

      const receipt = await t.query(getReceipt, { dedupKey: DEDUP_KEY });
      expect(receipt).toMatchObject({ state, attempts: 1 });
      if (blockedCode) {
        expect(receipt).toMatchObject({ blockedCode });
      } else {
        expect(receipt).not.toHaveProperty('blockedCode');
      }
      expect(JSON.stringify(receipt)).not.toContain('PROHIBITED_PROVIDER_BODY');
    }
  );

  it.each([
    ['missing event ID', { ...eventPayload(), eventID: null }],
    ['missing issue ID', { ...eventPayload(), groupID: null }],
    ['non-array tags', { ...eventPayload(), tags: null }],
    [
      'missing provenance',
      {
        ...eventPayload(),
        tags: eventPayload().tags.filter((tag) => tag.key !== 'provenance'),
      },
    ],
    ['null tag', { ...eventPayload(), tags: [null] }],
    [
      'non-string tag key',
      { ...eventPayload(), tags: [{ key: 42, value: 'convex' }] },
    ],
    [
      'non-string tag value',
      { ...eventPayload(), tags: [{ key: 'runtime', value: 42 }] },
    ],
    [
      'missing runtime',
      eventPayload({
        environment: TAGS.environment,
        release: TAGS.release,
        level: TAGS.level,
        operation: TAGS.operation,
        failureCode: TAGS.failureCode,
      }),
    ],
    [
      'missing environment',
      eventPayload({
        runtime: TAGS.runtime,
        release: TAGS.release,
        level: TAGS.level,
        operation: TAGS.operation,
        failureCode: TAGS.failureCode,
      }),
    ],
    [
      'missing release',
      eventPayload({
        runtime: TAGS.runtime,
        environment: TAGS.environment,
        level: TAGS.level,
        operation: TAGS.operation,
        failureCode: TAGS.failureCode,
      }),
    ],
    [
      'missing level',
      eventPayload({
        runtime: TAGS.runtime,
        environment: TAGS.environment,
        release: TAGS.release,
        operation: TAGS.operation,
        failureCode: TAGS.failureCode,
      }),
    ],
    [
      'missing operation',
      eventPayload({
        runtime: TAGS.runtime,
        environment: TAGS.environment,
        release: TAGS.release,
        level: TAGS.level,
        failureCode: TAGS.failureCode,
      }),
    ],
    [
      'missing failure code',
      eventPayload({
        runtime: TAGS.runtime,
        environment: TAGS.environment,
        release: TAGS.release,
        level: TAGS.level,
        operation: TAGS.operation,
      }),
    ],
    ['unknown runtime', eventPayload({ ...TAGS, runtime: 'node' })],
  ] as const)(
    'blocks a malformed Sentry tag payload with a %s',
    async (_case, body) => {
      const { t, receiptId } = await insertReceipt();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(body));

      await t.action(processReceipt, { receiptId });

      expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
        state: 'blocked',
        blockedCode: 'invalid_tags',
        attempts: 1,
      });
    }
  );
  it.each([
    [
      'another event ID',
      { ...eventPayload(), eventID: 'fedcba9876543210fedcba9876543210' },
    ],
    ['another issue ID', { ...eventPayload(), groupID: '654321' }],
    [
      'a duplicate required tag',
      {
        ...eventPayload(),
        tags: [
          ...eventPayload().tags,
          { key: 'runtime', value: 'github-actions' },
        ],
      },
    ],
  ] as const)(
    'blocks a Sentry event payload bound to %s',
    async (_case, body) => {
      const { t, receiptId } = await insertReceipt();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(body));

      await t.action(processReceipt, { receiptId });

      expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
        state: 'blocked',
        blockedCode: 'invalid_tags',
        attempts: 1,
      });
    }
  );

  it('reads tags from the triggering event instead of aggregated issue history', async () => {
    const { t, receiptId } = await insertReceipt();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);
        const event = tagResponse(url);
        if (event) return event;
        if (url.includes('/issues/123456/tags/')) {
          return Response.json([{ value: RELEASE }, { value: 'b'.repeat(40) }]);
        }
        if (url.includes('/search/issues')) {
          return Response.json({
            items: [
              recoveredIssue(76, TAGS, { body: 'unrelated issue' }),
              recoveredIssue(77),
            ],
          });
        }
        if (url.includes('/integrations/338522/') && !init?.method) {
          return Response.json(linkedConfig());
        }
        if (url.includes('/integrations/338522/') && init?.method === 'PUT') {
          return new Response(null, { status: 201 });
        }
        throw new Error('unexpected endpoint');
      });

    await t.action(processReceipt, { receiptId });

    expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
      state: 'linked',
      release: RELEASE,
      githubIssueNumber: 77,
    });
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).includes(`/events/${SENTRY_EVENT_ID}/`)
      )
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes('/issues/123456/tags/')
      )
    ).toBe(false);
  });

  it.each([
    [401, 'blocked', 'github_auth'],
    [403, 'blocked', 'github_forbidden'],
    [422, 'blocked', 'github_invalid'],
    [500, 'pending', undefined],
  ] as const)(
    'classifies GitHub search HTTP %i without creating an issue',
    async (status, state, blockedCode) => {
      const { t, receiptId } = await insertReceipt();
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const tag = tagResponse(String(input));
        return tag ?? new Response(null, { status });
      });

      await t.action(processReceipt, { receiptId });

      const receipt = await t.query(getReceipt, { dedupKey: DEDUP_KEY });
      expect(receipt).toMatchObject({ state, attempts: 1 });
      if (blockedCode) {
        expect(receipt).toMatchObject({ blockedCode });
      } else {
        expect(receipt).not.toHaveProperty('blockedCode');
      }
    }
  );

  it.each([
    [401, 'blocked', 'sentry_auth'],
    [404, 'blocked', 'sentry_missing'],
    [422, 'blocked', 'link_conflict'],
    [500, 'pending', undefined],
  ] as const)(
    'classifies Sentry link HTTP %i after recovering the GitHub issue',
    async (status, state, blockedCode) => {
      const { t, receiptId } = await insertReceipt();
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        const tag = tagResponse(url);
        if (tag) return tag;
        if (url.includes('/search/issues')) {
          return Response.json({ items: [recoveredIssue(77)] });
        }
        return new Response(null, { status });
      });

      await t.action(processReceipt, { receiptId });

      const receipt = await t.query(getReceipt, { dedupKey: DEDUP_KEY });
      expect(receipt).toMatchObject({
        state,
        attempts: 1,
        githubIssueNumber: 77,
      });
      if (blockedCode) {
        expect(receipt).toMatchObject({ blockedCode });
      } else {
        expect(receipt).not.toHaveProperty('blockedCode');
      }
    }
  );

  it.each([
    ['SENTRY_GITHUB_INTEGRATION_ID', undefined],
    ['GITHUB_REPOSITORY_OWNER', 'another-owner'],
    ['SENTRY_ORG', 'another-organization'],
  ] as const)(
    'blocks invalid bridge configuration for %s',
    async (name, value) => {
      const { t, receiptId } = await insertReceipt();
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
      const fetchMock = vi.spyOn(globalThis, 'fetch');

      await t.action(processReceipt, { receiptId });

      expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
        state: 'blocked',
        blockedCode: 'configuration_invalid',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('blocks malformed and ambiguous GitHub search results', async () => {
    for (const testCase of [
      {
        value: { unexpected: [] },
        blockedCode: 'github_invalid',
      },
      {
        value: { items: [null] },
        blockedCode: 'github_invalid',
      },
      {
        value: { items: [[]] },
        blockedCode: 'github_invalid',
      },
      {
        value: { items: [{ number: 77, body: 42 }] },
        blockedCode: 'github_invalid',
      },
      {
        value: {
          items: [{ number: '77', body: githubDedupMarker(DEDUP_KEY) }],
        },
        blockedCode: 'github_invalid',
      },
      {
        value: {
          items: [recoveredIssue(77), recoveredIssue(78)],
        },
        blockedCode: 'marker_conflict',
      },
    ] as const) {
      const { t, receiptId } = await insertReceipt();
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const tag = tagResponse(String(input));
        return tag ?? Response.json(testCase.value);
      });

      await t.action(processReceipt, { receiptId });

      expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
        state: 'blocked',
        blockedCode: testCase.blockedCode,
      });
      vi.restoreAllMocks();
    }
  });

  it.each([
    ['null response', null],
    ['array response', []],
    ['non-numeric issue number', { number: '88' }],
  ] as const)(
    'blocks a malformed GitHub create result with a %s',
    async (_case, body) => {
      const { t, receiptId } = await insertReceipt();
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input);
        const tag = tagResponse(url);
        if (tag) return tag;
        if (url.includes('/search/issues')) {
          return Response.json({ items: [] });
        }
        if (url.includes('/repos/misty-step/linejam/labels/')) {
          return Response.json({ name: 'configured' });
        }
        if (
          url.endsWith('/repos/misty-step/linejam/issues') &&
          init?.method === 'POST'
        ) {
          return Response.json(body);
        }
        throw new Error('unexpected endpoint');
      });

      await t.action(processReceipt, { receiptId });

      expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
        state: 'blocked',
        blockedCode: 'github_create_ambiguous',
        attempts: 1,
      });
    }
  );

  it('preserves an internal failure class after bounded retries', async () => {
    const { t, receiptId } = await insertReceipt();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{malformed-json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await t.action(processReceipt, { receiptId });
      if (attempt < 10) {
        await t.run((ctx) =>
          ctx.db.patch(receiptId, { nextAttemptAt: 0, updatedAt: attempt })
        );
      }
    }

    expect(await t.query(getReceipt, { dedupKey: DEDUP_KEY })).toMatchObject({
      state: 'blocked',
      blockedCode: 'internal_error',
      attempts: 10,
    });
  });

  it('creates a new execution receipt while reusing the canonical GitHub issue', async () => {
    const { t, receiptId } = await insertReceipt();
    await t.run((ctx) =>
      ctx.db.patch(receiptId, {
        state: 'linked',
        githubIssueNumber: 77,
        linkedAt: 2_000,
        updatedAt: 2_000,
      })
    );
    const regressionEventId = 'd'.repeat(32);
    const regressionDedupKey = `v2:${INSTALLATION_UUID}:42:123456:${regressionEventId}`;
    const accepted = await t.mutation(acceptWebhook, {
      dedupKey: regressionDedupKey,
      canonicalKey: CANONICAL_KEY,
      installationUuid: INSTALLATION_UUID,
      projectId: '42',
      sentryIssueId: '123456',
      sentryEventId: regressionEventId,
      now: 3_000,
    });

    expect(accepted.receiptId).not.toBe(receiptId);
    expect(
      await t.query(getReceipt, { dedupKey: regressionDedupKey })
    ).toMatchObject({
      state: 'pending',
      githubIssueNumber: 77,
      reusedGithubIssue: true,
      sentryEventId: regressionEventId,
    });
  });

  it('maps one Sentry issue to one durable receipt under exact replay', async () => {
    const { t } = await insertReceipt();
    const replays = await Promise.all(
      Array.from({ length: 10 }, () =>
        t.mutation(acceptWebhook, {
          dedupKey: DEDUP_KEY,
          canonicalKey: CANONICAL_KEY,
          installationUuid: INSTALLATION_UUID,
          projectId: '42',
          sentryIssueId: '123456',
          sentryEventId: '0123456789abcdef0123456789abcdef',
        })
      )
    );
    expect(new Set(replays.map((result) => result.receiptId)).size).toBe(1);
    expect(
      await t.run((ctx) => ctx.db.query('sentryGithubReceipts').collect())
    ).toHaveLength(1);
  });
});
