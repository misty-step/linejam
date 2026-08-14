/** @vitest-environment node */
import { buildCanarySubprocessEnv } from './canary-test-env';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve('scripts/canary/setup-webhook.sh');

type WebhookRecord = {
  id: string;
  url: string;
  events: string[];
  active?: boolean;
  created_at?: string;
  secret?: string;
};

function startCanaryStub(
  initialWebhooks: WebhookRecord[] = [],
  options?: { failCreate?: boolean }
) {
  const state = {
    webhooks: [...initialWebhooks],
    deletions: [] as string[],
    tests: [] as string[],
    creations: 0,
  };

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');

    if (request.headers.authorization !== 'Bearer canary-secret') {
      response.writeHead(401, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/webhooks') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ webhooks: state.webhooks }));
      return;
    }

    if (
      request.method === 'DELETE' &&
      url.pathname.startsWith('/api/v1/webhooks/')
    ) {
      const id = url.pathname.split('/').at(-1) || '';
      state.deletions.push(id);
      state.webhooks = state.webhooks.filter((webhook) => webhook.id !== id);
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/webhooks') {
      if (options?.failCreate) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'create_failed' }));
        return;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.from(chunk));
      }

      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
        url: string;
        events: string[];
      };
      state.creations += 1;
      const created = {
        id: `WHK-${state.creations}`,
        url: body.url,
        events: body.events,
        secret: `secret-${state.creations}`,
        created_at: '2026-04-08T00:00:00Z',
      };
      state.webhooks.push(created);

      response.writeHead(201, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(created));
      return;
    }

    if (
      request.method === 'POST' &&
      /^\/api\/v1\/webhooks\/[^/]+\/test$/.test(url.pathname)
    ) {
      const id = url.pathname.split('/').at(-2) || '';
      state.tests.push(id);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ status: 'delivered' }));
      return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'not_found' }));
  });

  return new Promise<{
    baseUrl: string;
    close: () => Promise<void>;
    state: typeof state;
  }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }

              closeResolve();
            });
          }),
        state,
      });
    });
  });
}

describe('canary setup webhook script', () => {
  const servers: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((close) => close()));
  });

  it('creates a webhook when none exists', async () => {
    const stub = await startCanaryStub();
    servers.push(stub.close);

    const { stdout, stderr } = await execFileAsync(scriptPath, {
      cwd: process.cwd(),
      env: buildCanarySubprocessEnv({
        CANARY_ENDPOINT: stub.baseUrl,
        CANARY_API_KEY: 'canary-secret',
        LINEJAM_CANARY_WEBHOOK_URL:
          'https://linejam.example.com/canary/webhook',
      }),
    });

    const result = JSON.parse(stdout) as {
      status: string;
      webhook: { id: string; url: string; events: string[] };
      replaced_ids: string[];
      secret: string | null;
    };

    expect(result.status).toBe('created');
    expect(result.webhook.id).toBe('WHK-1');
    expect(result.replaced_ids).toEqual([]);
    expect(result.secret).toBeNull();
    expect(stderr).toBe('');
  });

  it('emits the created secret only when explicitly requested', async () => {
    const stub = await startCanaryStub();
    servers.push(stub.close);

    const { stdout, stderr } = await execFileAsync(
      scriptPath,
      ['--emit-secret'],
      {
        cwd: process.cwd(),
        env: buildCanarySubprocessEnv({
          CANARY_ENDPOINT: stub.baseUrl,
          CANARY_API_KEY: 'canary-secret',
          LINEJAM_CANARY_WEBHOOK_URL:
            'https://linejam.example.com/canary/webhook',
        }),
      }
    );

    const result = JSON.parse(stdout) as { secret: string | null };

    expect(result.secret).toBe('secret-1');
    expect(stderr).toContain('Save the returned secret');
  });

  it('reuses an exact active webhook without creating duplicates', async () => {
    const stub = await startCanaryStub([
      {
        id: 'WHK-existing',
        url: 'https://linejam.example.com/canary/webhook',
        events: [
          'incident.updated',
          'error.new_class',
          'health_check.down',
          'error.regression',
          'incident.opened',
          'incident.resolved',
          'health_check.degraded',
          'health_check.recovered',
          'health_check.tls_expiring',
        ],
        active: true,
        created_at: '2026-04-07T00:00:00Z',
      },
    ]);
    servers.push(stub.close);

    const { stdout, stderr } = await execFileAsync(scriptPath, {
      cwd: process.cwd(),
      env: buildCanarySubprocessEnv({
        CANARY_ENDPOINT: stub.baseUrl,
        CANARY_API_KEY: 'canary-secret',
        LINEJAM_CANARY_WEBHOOK_URL:
          'https://linejam.example.com/canary/webhook',
      }),
    });

    const result = JSON.parse(stdout) as {
      status: string;
      webhook: { id: string };
      replaced_ids: string[];
      secret: string | null;
    };

    expect(result.status).toBe('existing');
    expect(result.webhook.id).toBe('WHK-existing');
    expect(result.replaced_ids).toEqual([]);
    expect(result.secret).toBeNull();
    expect(stub.state.deletions).toEqual([]);
    expect(stub.state.creations).toBe(0);
    expect(stderr).toBe('');
  });

  it('replaces duplicate or mismatched subscriptions for the same url', async () => {
    const stub = await startCanaryStub([
      {
        id: 'WHK-old-1',
        url: 'https://linejam.example.com/canary/webhook',
        events: ['error.new_class'],
        active: true,
      },
      {
        id: 'WHK-old-2',
        url: 'https://linejam.example.com/canary/webhook/',
        events: ['error.new_class', 'error.regression'],
        active: true,
      },
    ]);
    servers.push(stub.close);

    const { stdout } = await execFileAsync(scriptPath, {
      cwd: process.cwd(),
      env: buildCanarySubprocessEnv({
        CANARY_ENDPOINT: stub.baseUrl,
        CANARY_API_KEY: 'canary-secret',
        LINEJAM_CANARY_WEBHOOK_URL:
          'https://linejam.example.com/canary/webhook',
      }),
    });

    const result = JSON.parse(stdout) as {
      status: string;
      webhook: { id: string };
      replaced_ids: string[];
    };

    expect(result.status).toBe('replaced');
    expect(result.webhook.id).toBe('WHK-1');
    expect(result.replaced_ids).toEqual(['WHK-old-1', 'WHK-old-2']);
    expect(stub.state.deletions).toEqual(['WHK-old-1', 'WHK-old-2']);
  });

  it('does not delete existing subscriptions before replacement creation succeeds', async () => {
    const stub = await startCanaryStub(
      [
        {
          id: 'WHK-old-1',
          url: 'https://linejam.example.com/canary/webhook',
          events: ['error.new_class'],
          active: true,
        },
      ],
      { failCreate: true }
    );
    servers.push(stub.close);

    await expect(
      execFileAsync(scriptPath, {
        cwd: process.cwd(),
        env: buildCanarySubprocessEnv({
          CANARY_ENDPOINT: stub.baseUrl,
          CANARY_API_KEY: 'canary-secret',
          LINEJAM_CANARY_WEBHOOK_URL:
            'https://linejam.example.com/canary/webhook',
        }),
      })
    ).rejects.toThrow(/Canary API POST \/api\/v1\/webhooks returned 500/);

    expect(stub.state.deletions).toEqual([]);
  });

  it('can send a test delivery after ensuring the webhook', async () => {
    const stub = await startCanaryStub();
    servers.push(stub.close);

    const { stdout } = await execFileAsync(scriptPath, {
      cwd: process.cwd(),
      env: buildCanarySubprocessEnv({
        CANARY_ENDPOINT: stub.baseUrl,
        CANARY_API_KEY: 'canary-secret',
        LINEJAM_CANARY_WEBHOOK_URL:
          'https://linejam.example.com/canary/webhook',
        CANARY_WEBHOOK_SEND_TEST: '1',
      }),
    });

    const result = JSON.parse(stdout) as {
      status: string;
      test: { status: string } | null;
    };

    expect(result.status).toBe('created');
    expect(result.test).toEqual({ status: 'delivered' });
    expect(stub.state.tests).toEqual(['WHK-1']);
  });
});
