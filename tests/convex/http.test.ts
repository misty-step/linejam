/** @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinejamConvexTest } from '../helpers/convexTest';
import { withEnv } from '../helpers/envHelper';
import { setupConvexTest } from '../helpers/convexTest';

const ORIGINAL_ENV = { ...process.env };

/**
 * Health route tests on the real convex-test engine (backlog 018).
 *
 * convex/lib/env.ts captures process.env into a module-level frozen constant at
 * import time. To exercise different env configurations across test cases we
 * must reset the module cache before each test so a fresh import of
 * convex/http.ts (and its transitive dependency convex/lib/env.ts) re-reads
 * process.env. vi.resetModules() + withEnv() achieves this.
 *
 * vi.mock of convex/server and convex/_generated/server has been removed.
 * t.fetch() drives the real httpRouter → httpAction dispatch pipeline and
 * asserts the observable Response (status + JSON body) instead of stub call
 * counts.
 */

describe('convex/http health route', () => {
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  beforeEach(() => {
    // Reset the module registry so each test re-imports convex/http.ts and
    // convex/lib/env.ts fresh, picking up the process.env set by withEnv().
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  it('registers GET /api/health and returns 500 when guest verification is missing', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        GUEST_TOKEN_SECRET: undefined,
      },
      async () => {
        const t = setupConvexTest();
        const response = await t.fetch('/api/health');

        expect(response.status).toBe(500);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        await expect(response.json()).resolves.toMatchObject({
          ok: false,
          status: 500,
          environment: 'production',
          capabilities: {
            guestTokenVerification: {
              status: 'missing_required',
              available: false,
              required: true,
            },
          },
        });
      }
    );
  });

  it('returns 200 when retained production configuration is complete', async () => {
    await withEnv(
      {
        CONVEX_CLOUD_URL: 'https://linejam.convex.cloud',
        LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        GITHUB_ISSUES_TOKEN: 'test-github-token',
        GITHUB_REPOSITORY_NAME: 'linejam',
        GITHUB_REPOSITORY_OWNER: 'misty-step',
        CLERK_JWT_ISSUER_DOMAIN: 'https://clerk.test',
        GUEST_TOKEN_SECRET: 'test-secret',
        LINEJAM_SENTRY_ENABLED: 'true',
        SENTRY_DSN: ['https://public', 'sentry.example.test/1'].join('@'),
        SENTRY_ENVIRONMENT: 'production',
        SENTRY_RELEASE: 'a'.repeat(40),
        SENTRY_EVENT_WRITE_TOKEN: 'test-event-token',
        SENTRY_EXPECTED_APP_ID: '160944',
        SENTRY_EXPECTED_INSTALLATION_UUID:
          '268a6e8e-c341-414e-bee6-20125b9987ef',
        SENTRY_EXPECTED_PROJECT_ID: '4510762050650112',
        SENTRY_GITHUB_INTEGRATION_ID: '338522',
        SENTRY_ORG: 'misty-step',
        SENTRY_AGENT_LOOP_SECRET:
          'agent-loop-test-secret-at-least-32-characters',
        SENTRY_WEBHOOK_SECRET: 'test-webhook-secret',
      },
      async () => {
        const t = setupConvexTest();
        const response = await t.fetch('/api/health');

        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        await expect(response.json()).resolves.toMatchObject({
          ok: true,
          status: 200,
          environment: 'production',
          capabilities: {
            guestTokenVerification: {
              status: 'ready',
              available: true,
              required: true,
            },
          },
        });
      }
    );
  });
});

const WEBHOOK_SECRET = 'test-sentry-webhook-secret';
const INSTALLATION_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const REQUEST_ID = '11111111222243338444555555555555';

interface SentryWebhookOverrides {
  action?: string;
  installation?: { uuid?: string };
  data?: {
    event?: {
      project?: number | string;
      issue_id?: string;
      event_id?: string;
      title?: string;
      message?: string;
      stacktrace?: string;
    };
  };
}

function webhookPayload(overrides: SentryWebhookOverrides = {}) {
  return {
    action: 'triggered',
    installation: { uuid: INSTALLATION_UUID },
    data: {
      event: {
        project: 42,
        issue_id: '123456',
        event_id: '0123456789abcdef0123456789abcdef',
        title: 'PROHIBITED_TITLE_SENTINEL',
        message: 'PROHIBITED_MESSAGE_SENTINEL',
        stacktrace: 'PROHIBITED_STACK_SENTINEL',
      },
    },
    ...overrides,
  };
}

async function webhookSignature(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  );
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function webhookHeaders(body: string) {
  return {
    'Content-Type': 'application/json',
    'Sentry-Hook-Resource': 'event_alert',
    'Sentry-Hook-Signature': await webhookSignature(body),
    'Request-ID': REQUEST_ID,
  };
}

const WEBHOOK_ENV = {
  LINEJAM_DEPLOY_ENVIRONMENT: 'preview',
  SENTRY_WEBHOOK_SECRET: WEBHOOK_SECRET,
  SENTRY_EXPECTED_APP_ID: '160944',
  SENTRY_EXPECTED_INSTALLATION_UUID: INSTALLATION_UUID,
  SENTRY_EXPECTED_PROJECT_ID: '42',
};

const rejectionCases: Array<
  [
    string,
    {
      signature?: string;
      resource?: string;
      body?: unknown;
    },
  ]
> = [
  ['bad signature', { signature: '0'.repeat(64) }],
  ['wrong resource', { resource: 'issue' }],
  ['unallowlisted action', { body: webhookPayload({ action: 'resolved' }) }],
  [
    'unallowlisted project',
    {
      body: {
        ...webhookPayload(),
        data: {
          event: {
            ...webhookPayload().data.event,
            project: 99,
          },
        },
      },
    },
  ],
];

describe('convex/http Sentry webhook route', () => {
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  it.each(rejectionCases)(
    'returns the same constant rejection for %s',
    async (_name, variant) => {
      await withEnv(WEBHOOK_ENV, async () => {
        const t = setupConvexTest();
        const body = JSON.stringify(variant.body ?? webhookPayload());
        const headers = await webhookHeaders(body);
        headers['Sentry-Hook-Resource'] = variant.resource ?? 'event_alert';
        headers['Sentry-Hook-Signature'] =
          variant.signature ?? headers['Sentry-Hook-Signature'];

        const response = await t.fetch('/api/webhooks/sentry', {
          method: 'POST',
          headers,
          body,
        });

        expect(response.status).toBe(400);
        expect(await response.text()).toBe('Invalid webhook');
        expect(
          await t.run((ctx) => ctx.db.query('sentryGithubReceipts').collect())
        ).toHaveLength(0);
      });
    }
  );

  it('rejects a body above 256 KiB before parsing', async () => {
    await withEnv(WEBHOOK_ENV, async () => {
      const t = setupConvexTest();
      const body = 'x'.repeat(256 * 1024 + 1);
      const response = await t.fetch('/api/webhooks/sentry', {
        method: 'POST',
        headers: await webhookHeaders(body),
        body,
      });
      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Invalid webhook');
    });
  });

  it.each(['preview', 'production'] as const)(
    'commits the projected receipt in %s before acknowledging',
    async (deploymentEnvironment) => {
      await withEnv(
        { ...WEBHOOK_ENV, LINEJAM_DEPLOY_ENVIRONMENT: deploymentEnvironment },
        async () => {
          const t = setupConvexTest();
          const body = JSON.stringify(webhookPayload());
          const response = await t.fetch('/api/webhooks/sentry', {
            method: 'POST',
            headers: await webhookHeaders(body),
            body,
          });

          expect(response.status).toBe(202);
          const receipts = await t.run((ctx) =>
            ctx.db.query('sentryGithubReceipts').collect()
          );
          expect(receipts).toHaveLength(1);
          expect(receipts[0]).toMatchObject({
            dedupKey: `v1:${INSTALLATION_UUID}:42:123456`,
            installationUuid: INSTALLATION_UUID,
            projectId: '42',
            sentryIssueId: '123456',
            sentryEventId: '0123456789abcdef0123456789abcdef',
            state: 'pending',
            attempts: 0,
          });
          const serialized = JSON.stringify(receipts[0]);
          expect(serialized).not.toContain('PROHIBITED_TITLE_SENTINEL');
          expect(serialized).not.toContain('PROHIBITED_MESSAGE_SENTINEL');
          expect(serialized).not.toContain(REQUEST_ID);
          expect(serialized).not.toContain('PROHIBITED_STACK_SENTINEL');
        }
      );
    }
  );

  it('retains one receipt under concurrent exact replay', async () => {
    await withEnv(WEBHOOK_ENV, async () => {
      const t = setupConvexTest();
      const body = JSON.stringify(webhookPayload());
      const headers = await webhookHeaders(body);
      const responses = await Promise.all(
        Array.from({ length: 10 }, () =>
          t.fetch('/api/webhooks/sentry', {
            method: 'POST',
            headers,
            body,
          })
        )
      );
      expect(responses.every((response) => response.status === 202)).toBe(true);
      expect(
        await t.run((ctx) => ctx.db.query('sentryGithubReceipts').collect())
      ).toHaveLength(1);
    });
  });
});

const AGENT_SECRET = 'agent-loop-test-secret-at-least-32-characters';
const AGENT_LEASE_ONE = '11111111-1111-4111-8111-111111111111';
const AGENT_LEASE_TWO = '22222222-2222-4222-8222-222222222222';

async function agentHeaders(body: string, timestamp = String(Date.now())) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(AGENT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`${timestamp}\n${body}`)
    )
  );
  const signature = [...digest]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return {
    'Content-Type': 'application/json',
    'Linejam-Agent-Timestamp': timestamp,
    'Linejam-Agent-Signature': signature,
  };
}

async function insertAgentReceipt(t: LinejamConvexTest) {
  return t.run((ctx) =>
    ctx.db.insert('sentryGithubReceipts', {
      dedupKey: `v1:${INSTALLATION_UUID}:42:123456`,
      installationUuid: INSTALLATION_UUID,
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
      release: 'a'.repeat(40),
      level: 'error',
      operation: 'finishAbandonedGame',
      failureCode: 'unexpected_error',
      githubIssueNumber: 426,
      linkedAt: 100,
      agentState: 'pending',
      agentAttempts: 0,
      agentNextAttemptAt: 100,
    })
  );
}

describe('convex/http Sentry agent lease route', () => {
  const env = {
    LINEJAM_DEPLOY_ENVIRONMENT: 'production',
    SENTRY_AGENT_LOOP_SECRET: AGENT_SECRET,
  };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  it('atomically grants one signed claim', async () => {
    await withEnv(env, async () => {
      const t = setupConvexTest();
      await insertAgentReceipt(t);
      const firstBody = JSON.stringify({
        action: 'claim',
        leaseId: AGENT_LEASE_ONE,
      });
      const first = await t.fetch('/api/agents/sentry', {
        method: 'POST',
        headers: await agentHeaders(firstBody),
        body: firstBody,
      });
      expect(first.status).toBe(200);
      await expect(first.json()).resolves.toMatchObject({
        githubIssueNumber: 426,
        sentryEventId: '0123456789abcdef0123456789abcdef',
        leaseId: AGENT_LEASE_ONE,
        agentAttempts: 1,
      });

      const secondBody = JSON.stringify({
        action: 'claim',
        leaseId: AGENT_LEASE_TWO,
      });
      const second = await t.fetch('/api/agents/sentry', {
        method: 'POST',
        headers: await agentHeaders(secondBody),
        body: secondBody,
      });
      expect(second.status).toBe(204);
    });
  });

  it('completes only the matching signed lease', async () => {
    await withEnv(env, async () => {
      const t = setupConvexTest();
      const receiptId = await insertAgentReceipt(t);
      const claimBody = JSON.stringify({
        action: 'claim',
        leaseId: AGENT_LEASE_ONE,
      });
      await t.fetch('/api/agents/sentry', {
        method: 'POST',
        headers: await agentHeaders(claimBody),
        body: claimBody,
      });
      const completeBody = JSON.stringify({
        action: 'complete',
        receiptId,
        leaseId: AGENT_LEASE_ONE,
        outcome: 'completed',
      });
      const response = await t.fetch('/api/agents/sentry', {
        method: 'POST',
        headers: await agentHeaders(completeBody),
        body: completeBody,
      });
      expect(response.status).toBe(202);
      expect(await t.run((ctx) => ctx.db.get(receiptId))).toMatchObject({
        agentState: 'completed',
      });
    });
  });

  it('rejects stale or invalid signatures without leasing work', async () => {
    await withEnv(env, async () => {
      const t = setupConvexTest();
      const receiptId = await insertAgentReceipt(t);
      const body = JSON.stringify({
        action: 'claim',
        leaseId: AGENT_LEASE_ONE,
      });
      const headers = await agentHeaders(
        body,
        String(Date.now() - 10 * 60 * 1000)
      );
      const response = await t.fetch('/api/agents/sentry', {
        method: 'POST',
        headers,
        body,
      });
      expect(response.status).toBe(400);
      expect(await t.run((ctx) => ctx.db.get(receiptId))).toMatchObject({
        agentState: 'pending',
      });
    });
  });

  it('rejects malformed signed claim and completion projections', async () => {
    await withEnv(env, async () => {
      const t = setupConvexTest();
      const invalidPayloads = [
        { action: 'claim', leaseId: [AGENT_LEASE_ONE] },
        { action: 'claim', leaseId: -1 },
        { action: 'claim', leaseId: 1.5 },
        { action: 'claim', leaseId: 'bad' },
        { action: 'unknown', leaseId: AGENT_LEASE_ONE },
        {
          action: 'complete',
          leaseId: AGENT_LEASE_ONE,
          receiptId: ['receipt'],
          outcome: 'completed',
        },
        {
          action: 'complete',
          leaseId: AGENT_LEASE_ONE,
          receiptId: 'receipt',
          outcome: 'wrong',
        },
      ];

      for (const payload of invalidPayloads) {
        const body = JSON.stringify(payload);
        const response = await t.fetch('/api/agents/sentry', {
          method: 'POST',
          headers: await agentHeaders(body),
          body,
        });
        expect(response.status).toBe(400);
      }
    });
  });
});
