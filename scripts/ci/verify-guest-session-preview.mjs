import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const account = 'b069014f6a46558ea9146fb6c4ff8f6c';
const name = 'linejam-guest-t504fd3d9';
const apiBase = `https://api.cloudflare.com/client/v4/accounts/${account}`;
const receipt = {
  name,
  source: process.env.GITHUB_SHA,
  repair: '8179da707f7bf58d4def1af36fddea14261cfe50',
  backend: 'b798bb99f42bf0923f52de2b3207f3b8da5c19fd',
};
const directory = mkdtempSync(join(tmpdir(), 'guest-session-preview-'));
const config = '.guest-session-preview.json';
let deployed = false;
async function api(path, body) {
  const options = {
    method: body ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'content-type': 'application/json',
    },
    signal: AbortSignal.timeout(30000),
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${apiBase}${path}`, options);
  const data = await response.json();
  if (!response.ok || !data.success)
    throw new Error(
      `Cloudflare ${path}: HTTP ${response.status}; codes ${(data.errors ?? []).map((e) => e.code).join(',')}`
    );
  return data.result;
}
function run(args, env = process.env) {
  const result = spawnSync('pnpm', args, { stdio: 'inherit', env });
  assert.equal(result.status, 0, `pnpm ${args.join(' ')} failed`);
}
try {
  const subdomain = (await api('/workers/subdomain')).subdomain;
  assert.match(subdomain, /^[a-z0-9-]+$/);
  const origin = `https://${name}.${subdomain}.workers.dev`;
  receipt.origin = origin;
  const guestSecret = randomBytes(32).toString('hex');
  const adminSecret = randomBytes(32).toString('hex');
  const vars = {
    NEXT_PUBLIC_CONVEX_URL: `${origin}/backend`,
    CONVEX_CLOUD_URL: `${origin}/backend`,
    CONVEX_SITE_URL: `${origin}/backend/http`,
    LINEJAM_DEPLOY_ENVIRONMENT: 'development',
    NEXT_PUBLIC_SENTRY_ENABLED: '1',
    NEXT_PUBLIC_SENTRY_DSN: 'https://preview@invalid/1',
    LINEJAM_SENTRY_ENABLED: 'false',
    SENTRY_ENVIRONMENT: 'guest-session-preview',
    NEXT_DEPLOYMENT_ID: process.env.GITHUB_SHA,
  };
  writeFileSync(
    config,
    JSON.stringify({
      name,
      account_id: account,
      main: 'cloudflare/worker.ts',
      alias: { 'open-next-worker': './.open-next/worker.js' },
      compatibility_date: '2026-09-20',
      compatibility_flags: ['nodejs_compat', 'global_fetch_strictly_public'],
      workers_dev: true,
      preview_urls: false,
      send_metrics: false,
      observability: { enabled: true, head_sampling_rate: 1 },
      assets: {
        directory: '.open-next/assets',
        binding: 'ASSETS',
        run_worker_first: ['/backend/*'],
      },
      durable_objects: {
        bindings: [{ name: 'LINEJAM_BACKEND', class_name: 'LinejamBackend' }],
      },
      migrations: [
        { tag: 'linejam-backend-v1', new_sqlite_classes: ['LinejamBackend'] },
      ],
      vars,
    })
  );
  const secretsFile = join(directory, 'secrets.json');
  writeFileSync(
    secretsFile,
    JSON.stringify({
      GUEST_TOKEN_SECRET: guestSecret,
      LINEJAM_BACKEND_ADMIN_KEY: adminSecret,
    }),
    { mode: 0o600 }
  );
  run(['build:cf', '--config', config], {
    ...process.env,
    ...vars,
    GUEST_TOKEN_SECRET: guestSecret,
    CIRCLE_NODE_TOTAL: '2',
  });
  // The deployment contains only this named Worker and its own SQLite DO.
  deployed = true;
  run([
    'exec',
    'wrangler',
    'deploy',
    '--config',
    config,
    '--secrets-file',
    secretsFile,
  ]);
  receipt.deployments = await api(`/workers/scripts/${name}/deployments`);
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(`${origin}/api/deployment`, {
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const identity = await response.json();
      if (identity.deployment?.id === process.env.GITHUB_SHA) {
        receipt.identity = identity;
        ready = true;
        break;
      }
    }
    await delay(2000);
  }
  assert.ok(ready, 'candidate source did not become visible');
  const adminHeaders = {
    authorization: `Bearer ${adminSecret}`,
    'content-type': 'application/json',
  };
  const unfreeze = await fetch(`${origin}/backend/admin/freeze`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ frozen: false }),
    signal: AbortSignal.timeout(30000),
  });
  const unfreezeBody = await unfreeze.text();
  receipt.unfreeze = {
    status: unfreeze.status,
    url: unfreeze.url,
    body: unfreezeBody,
  };
  assert.equal(unfreeze.status, 200, `unfreeze: ${unfreezeBody.slice(0, 500)}`);
  assert.equal(JSON.parse(unfreezeBody).writesFrozen, false);
  const status = await fetch(`${origin}/backend/admin/status`, {
    headers: adminHeaders,
    signal: AbortSignal.timeout(30000),
  });
  const statusBody = await status.text();
  receipt.backendStatus = {
    status: status.status,
    url: status.url,
    body: statusBody,
  };
  assert.equal(status.status, 200, `status: ${statusBody.slice(0, 500)}`);
  assert.equal(JSON.parse(statusBody).writesFrozen, false);
  // Allow the newly-created workers.dev dispatch mapping to settle before
  // sending simultaneous requests over separate edge connections.
  await delay(15000);
  receipt.startedAt = Date.now();
  receipt.clientRequests = [];
  receipt.concurrency = 4;
  const sessions = [];
  async function burst(count, cookie) {
    const results = [];
    for (let offset = 0; offset < count; offset += receipt.concurrency) {
      const wave = await Promise.allSettled(
        Array.from(
          { length: Math.min(receipt.concurrency, count - offset) },
          async () => {
            const start = performance.now();
            const response = await fetch(`${origin}/api/guest/session`, {
              headers: cookie ? { cookie } : {},
              signal: AbortSignal.timeout(30000),
            });
            const responseMetadata = {
              url: response.url,
              status: response.status,
              contentType: response.headers.get('content-type'),
              ray: response.headers.get('cf-ray'),
            };
            receipt.clientRequests.push(responseMetadata);
            if (!responseMetadata.contentType?.includes('application/json')) {
              const text = await response.text();
              responseMetadata.edgeError =
                text.match(/(?:Error|error code)\s*(\d{4})/)?.[1] ?? null;
              throw new Error(
                `Non-JSON guest response: ${JSON.stringify(responseMetadata)}`
              );
            }
            const body = await response.json();
            if (response.status === 200) {
              assert.match(body.guestId, /^[a-f0-9-]{36}$/);
              assert.match(body.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
              assert.ok(body.validForMs > 0);
              if (!cookie) {
                assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
                sessions.push({
                  guestId: body.guestId,
                  cookie: response.headers.get('set-cookie').split(';')[0],
                });
              }
            } else {
              assert.equal(response.status, 429);
              assert.equal(response.headers.get('retry-after'), '600');
              assert.equal(
                body.error,
                'Too many guest sessions. Try again later.'
              );
              assert.equal(response.headers.get('set-cookie'), null);
            }
            return {
              status: response.status,
              durationMs: Math.round(performance.now() - start),
            };
          }
        )
      );
      results.push(...wave);
    }
    // Wait for all owned requests before failing or deleting the Worker.
    return results.map((result) => {
      if (result.status === 'rejected') throw result.reason;
      return result.value;
    });
  }
  receipt.first = await burst(16);
  assert.ok(receipt.first.every((r) => r.status === 200));
  receipt.reuse = await burst(16, sessions[0].cookie);
  assert.ok(receipt.reuse.every((r) => r.status === 200));
  receipt.saturated = await burst(64);
  assert.equal(receipt.saturated.filter((r) => r.status === 200).length, 4);
  assert.equal(receipt.saturated.filter((r) => r.status === 429).length, 60);
  receipt.after = await burst(8);
  assert.ok(receipt.after.every((r) => r.status === 429));
  assert.equal(new Set(sessions.map((s) => s.guestId)).size, 20);
  receipt.finishedAt = Date.now();
  receipt.burstPassed = true;
  console.log(
    JSON.stringify({
      event: 'guest-session-burst',
      origin,
      startedAt: receipt.startedAt,
      finishedAt: receipt.finishedAt,
      requests: [
        ...receipt.first,
        ...receipt.reuse,
        ...receipt.saturated,
        ...receipt.after,
      ].length,
      result: 'passed',
    })
  );
  // Never infer zero errors from an empty telemetry result. Query permission
  // can be narrower than deployment permission; record that gap explicitly.
  await delay(45000);
  try {
    const timeframe = { from: receipt.startedAt - 1000, to: Date.now() };
    const keys = await api('/workers/observability/telemetry/keys', {
      timeframe,
    });
    receipt.telemetryKeys = keys;
    const data = await api('/workers/observability/telemetry/query', {
      queryId: 'guest-session-t504fd3d9',
      timeframe,
      dry: true,
      limit: 2000,
      parameters: {
        view: 'events',
        filters: [
          {
            key: '$metadata.service',
            operation: 'eq',
            type: 'string',
            value: name,
          },
        ],
      },
    });
    const events = data.events?.events ?? [];
    assert.ok(events.length > 0, 'no candidate telemetry observed');
    assert.ok(events.length < 2000, 'telemetry requires pagination');
    receipt.telemetry = {
      count: data.events.count,
      rows: events.length,
      statistics: data.statistics,
      hung: events.filter((event) => JSON.stringify(event).includes('had hung'))
        .length,
      exceptions: events.filter(
        (event) => event.$workers?.outcome === 'exception'
      ).length,
      invocations: events
        .filter((event) => event.$workers?.eventType === 'fetch')
        .map((event) => ({
          id: event.$metadata?.id,
          timestamp: event.timestamp,
          outcome: event.$workers?.outcome,
          version: event.$workers?.scriptVersion?.id,
          method: event.$workers?.event?.request?.method,
          path: event.$workers?.event?.request?.url
            ? new URL(event.$workers.event.request.url).pathname
            : null,
          status: event.$workers?.event?.response?.status,
        })),
    };
    assert.equal(receipt.telemetry.hung, 0);
    assert.equal(receipt.telemetry.exceptions, 0);
  } catch (error) {
    receipt.telemetryUnverified = error.message;
    console.log(`Observability gap: ${error.message}`);
  }
} catch (error) {
  receipt.error = error.message;
  receipt.errorStack = error.stack;
  process.exitCode = 1;
} finally {
  if (deployed) {
    const result = spawnSync(
      'pnpm',
      ['exec', 'wrangler', 'delete', '--config', config, '--force'],
      { stdio: 'inherit' }
    );
    receipt.cleanupExit = result.status;
    if (result.status !== 0) process.exitCode = 1;
    const absent = await fetch(`${apiBase}/workers/scripts/${name}`, {
      headers: { authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
    });
    receipt.cleanupReadbackStatus = absent.status;
    if (absent.status !== 404) process.exitCode = 1;
  }
  rmSync(directory, { recursive: true, force: true });
  rmSync(config, { force: true });
  writeFileSync(
    'guest-session-preview-receipt.json',
    JSON.stringify(receipt, null, 2)
  );
  console.log(
    JSON.stringify({
      burstPassed: receipt.burstPassed ?? false,
      error: receipt.error ?? null,
      cleanupExit: receipt.cleanupExit,
      cleanupReadbackStatus: receipt.cleanupReadbackStatus,
    })
  );
}
