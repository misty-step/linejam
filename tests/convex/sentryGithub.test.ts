import { makeFunctionReference } from 'convex/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import {
  githubDedupMarker,
  githubIssueContent,
  retryDelayMs,
  validateBridgeTags,
} from '../../convex/sentryGithub';
import { setupConvexTest } from '../helpers/convexTest';

const ORIGINAL_ENV = { ...process.env };
const INSTALLATION_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const DEDUP_KEY = `v1:${INSTALLATION_UUID}:42:123456`;
const SENTRY_EVENT_ID = '0123456789abcdef0123456789abcdef';
const RELEASE = 'a'.repeat(40);

const acceptWebhook = makeFunctionReference<
  'mutation',
  {
    dedupKey: string;
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

function bridgeEnv() {
  process.env = {
    ...ORIGINAL_ENV,
    SENTRY_EVENT_WRITE_TOKEN: 'test-sentry-token',
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
    installationUuid: INSTALLATION_UUID,
    projectId: '42',
    sentryIssueId: '123456',
    sentryEventId: SENTRY_EVENT_ID,
    now: 1_000,
  });
  return { t, receiptId: accepted.receiptId };
}

function eventPayload(tags: Record<string, string> = TAGS) {
  return {
    eventID: SENTRY_EVENT_ID,
    groupID: '123456',
    tags: Object.entries(tags).map(([field, value]) => ({
      key: field === 'failureCode' ? 'failure_code' : field,
      value,
    })),
  };
}

function tagResponse(
  url: string,
  tags: Record<string, string> = TAGS
): Response | null {
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
    expect(validateBridgeTags({ ...TAGS, runtime: 'node' })).toBeNull();
    expect(validateBridgeTags({ ...TAGS, release: 'A'.repeat(40) })).toBeNull();
    expect(validateBridgeTags({ ...TAGS, operation: 'arbitrary' })).toBeNull();
    expect(
      validateBridgeTags({ ...TAGS, failureCode: 'raw provider body' })
    ).toBeNull();
  });

  it('generates GitHub content only from closed tags and allowlisted IDs', () => {
    const content = githubIssueContent(
      {
        dedupKey: DEDUP_KEY,
        projectId: '42',
        sentryIssueId: '123456',
        sentryEventId: '0123456789abcdef0123456789abcdef',
      },
      TAGS
    );
    expect(content.title).toBe(
      '[Convex/preview] finishAbandonedGame: unexpected_error'
    );
    expect(content.labels).toEqual(['p1', 'source/sentry', 'domain/infra']);
    expect(content.body).toContain(githubDedupMarker(DEDUP_KEY));
    expect(content.body).not.toMatch(
      /title|message|culprit|stack|request|user/i
    );
  });

  it('uses bounded exponential backoff with jitter', () => {
    expect(retryDelayMs(1, 0)).toBe(500);
    expect(retryDelayMs(1, 1)).toBe(1000);
    expect(retryDelayMs(4, 0)).toBe(4000);
    expect(retryDelayMs(100, 1)).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it('recovers a lost create by exact marker and does not create a second issue', async () => {
    const { t, receiptId } = await insertReceipt();
    const marker = githubDedupMarker(DEDUP_KEY);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);
        const tag = tagResponse(url);
        if (tag) return tag;
        if (url.includes('/search/issues')) {
          return Response.json({ items: [{ number: 77, body: marker }] });
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

  it('persists and links a GitHub Actions preview failure', async () => {
    const { t, receiptId } = await insertReceipt();
    const marker = githubDedupMarker(DEDUP_KEY);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const tag = tagResponse(url, PREVIEW_TAGS);
      if (tag) return tag;
      if (url.includes('/search/issues')) {
        return Response.json({ items: [{ number: 78, body: marker }] });
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

  it('blocks a conflicting native Sentry link without custom sync', async () => {
    const { t, receiptId } = await insertReceipt();
    const marker = githubDedupMarker(DEDUP_KEY);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const tag = tagResponse(url);
      if (tag) return tag;
      if (url.includes('/search/issues')) {
        return Response.json({ items: [{ number: 77, body: marker }] });
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

  it.each([
    ['string choice', ['misty-step/linejam'], undefined],
    ['object choice', [{ value: 'misty-step/linejam' }], []],
  ] as const)(
    'accepts a Sentry repository %s',
    async (_case, choices, linkedIssues) => {
      const { t, receiptId } = await insertReceipt();
      const marker = githubDedupMarker(DEDUP_KEY);
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input);
        const tag = tagResponse(url);
        if (tag) return tag;
        if (url.includes('/search/issues')) {
          return Response.json({ items: [{ number: 77, body: marker }] });
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
    const marker = githubDedupMarker(DEDUP_KEY);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const tag = tagResponse(url);
      if (tag) return tag;
      if (url.includes('/search/issues')) {
        return Response.json({ items: [{ number: 77, body: marker }] });
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
    ['null entry', [null]],
    ['array entry', [[]]],
    ['non-string value', [{ value: 42 }]],
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
    const marker = githubDedupMarker(DEDUP_KEY);
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
          return Response.json({ items: [{ number: 77, body: marker }] });
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
      const marker = githubDedupMarker(DEDUP_KEY);
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        const tag = tagResponse(url);
        if (tag) return tag;
        if (url.includes('/search/issues')) {
          return Response.json({ items: [{ number: 77, body: marker }] });
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
          items: [
            { number: 77, body: githubDedupMarker(DEDUP_KEY) },
            { number: 78, body: githubDedupMarker(DEDUP_KEY) },
          ],
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
        blockedCode: 'github_invalid',
        attempts: 1,
      });
    }
  );

  it('maps one Sentry issue to one durable receipt under exact replay', async () => {
    const { t } = await insertReceipt();
    const replays = await Promise.all(
      Array.from({ length: 10 }, () =>
        t.mutation(acceptWebhook, {
          dedupKey: DEDUP_KEY,
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
