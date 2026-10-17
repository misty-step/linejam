// Verify the built artifact in workerd. Do not rebuild or modify it here: the
// release workflow deploys these exact bytes after this command succeeds.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { unstable_readConfig, unstable_startWorker } from 'wrangler';
import { telemetryCollector, verifyWorkerTelemetry } from './worker-telemetry';
import { sourceRevision } from '../check.mjs';
import {
  ROUTE_TEMPLATES,
  assertRouteResponse,
  assertRuntimeLogs,
  routeProbe,
} from './worker-route-contracts';

async function main() {
  const party = process.argv.includes('--party');
  const game = party || process.argv.includes('--game');
  const telemetry = process.argv.includes('--telemetry');
  const observe = telemetry || party;
  assert(
    !(telemetry && game),
    'Telemetry fault injection uses a separate disposable Worker'
  );
  const collector = telemetryCollector();
  // A controlled release tag, not a claim of this checkout's source identity.
  const testRelease = 'a'.repeat(40);
  const backend = new URL(
    process.env.NEXT_PUBLIC_CONVEX_URL || 'http://127.0.0.1:1'
  );
  if (game) {
    assert.equal(process.env.LINEJAM_LOCAL, '1');
    assert.equal(process.env.NEXT_PUBLIC_LINEJAM_LOCAL, '1');
    assert.equal(backend.protocol, 'http:');
    assert.equal(backend.hostname, '127.0.0.1');
    assert.equal(backend.pathname, '/backend');
    assert(
      backend.port &&
        !backend.username &&
        !backend.password &&
        !backend.search &&
        !backend.hash
    );
  }
  const config = unstable_readConfig({ config: 'wrangler.jsonc' });
  assert(
    config.main && config.assets?.directory,
    'Built Worker and assets must be configured'
  );
  const alias: Record<string, string> = config.alias ?? {};
  const directory = mkdtempSync(join(tmpdir(), 'linejam-worker-routes-'));

  const logs: { level: string; message: string }[] = [];
  const failures: string[] = [];
  let blockedRequests = 0;
  let worker: Awaited<ReturnType<typeof unstable_startWorker>> | undefined;
  try {
    // A fresh config directory prevents Wrangler loading .dev.vars or dotenv
    // credentials. Runtime/build settings still come from the deployed config.
    const configPath = join(directory, 'wrangler.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        name: 'linejam-worker-routes',
        main: resolve(config.main),
        // The entry imports the OpenNext build through an alias and exports
        // the backend Durable Object, so both carry over from the deployed config.
        alias: Object.fromEntries(
          Object.entries(alias).map(([name, target]) => [
            name,
            target.startsWith('.') ? resolve(target) : target,
          ])
        ),
        durable_objects: telemetry ? undefined : config.durable_objects,
        migrations: telemetry ? undefined : config.migrations,
        compatibility_date: config.compatibility_date,
        compatibility_flags: config.compatibility_flags,
        assets: {
          ...config.assets,
          directory: resolve(config.assets.directory),
        },
        send_metrics: false,
      })
    );
    const vars = {
      LINEJAM_LOCAL: process.env.LINEJAM_LOCAL ?? '0',
      NEXT_PUBLIC_LINEJAM_LOCAL: observe
        ? '0'
        : (process.env.NEXT_PUBLIC_LINEJAM_LOCAL ?? '0'),
      LINEJAM_DEPLOY_ENVIRONMENT: 'development',
      NEXT_PUBLIC_CONVEX_URL: game ? backend.href : 'http://127.0.0.1:1',
      CONVEX_CLOUD_URL: game ? backend.href : '',
      CONVEX_SITE_URL: game ? `${backend.href}/http` : '',
      NEXT_PUBLIC_SENTRY_ENABLED: observe ? '1' : '0',
      NEXT_PUBLIC_SENTRY_DSN: observe
        ? 'https://public@sentry.example.test/1'
        : '',
      NEXT_DEPLOYMENT_ID: observe ? testRelease : '',
      LINEJAM_SENTRY_ENABLED: 'false',
      CLERK_SECRET_KEY: '',
      GUEST_TOKEN_SECRET: game ? randomBytes(32).toString('hex') : '',
      LINEJAM_BACKEND_ADMIN_KEY: game ? randomBytes(32).toString('hex') : '',
    };
    worker = await unstable_startWorker({
      config: configPath,
      bindings: Object.fromEntries(
        Object.entries(vars).map(([name, value]) => [
          name,
          { type: 'plain_text', value },
        ])
      ),
      dev: {
        remote: false,
        persist: false,
        watch: false,
        server: {
          hostname: '127.0.0.1',
          port: game ? Number(backend.port) : 0,
        },
        logLevel: 'error',
        // Native workerd outbound service: no DNS or network request can reach
        // a baked-in production URL. Do not replace with Node's fetch mocking.
        outboundService: async (request: Request) => {
          if (
            observe &&
            new URL(request.url).hostname === 'sentry.example.test'
          ) {
            return collector.receive(request);
          }
          if (
            game &&
            new URL(request.url).origin === backend.origin &&
            new URL(request.url).pathname.startsWith('/backend/')
          ) {
            assert(worker);
            return worker.fetch(request.url, {
              method: request.method,
              headers: [...request.headers],
              body: request.body ? await request.arrayBuffer() : undefined,
              redirect: 'manual',
            });
          }
          blockedRequests++;
          return new Response(
            'Worker route gate: backend deliberately unavailable',
            {
              status: 503,
            }
          );
        },
        structuredLogsHandler: (log: { level: string; message: string }) =>
          logs.push(log),
      },
    });
    worker.raw.on('runtimeError', (error: { text: string }) => {
      logs.push({ level: 'error', message: error.text });
    });
    // Exercise the HTTP ingress browsers use, not only Wrangler's RPC fetch.
    const ingress = await fetch(new URL('/api/deployment', await worker.url), {
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(
      ingress.status,
      200,
      'Native HTTP deployment endpoint must remain healthy'
    );
    if (telemetry) {
      await verifyWorkerTelemetry(await worker.url, collector, testRelease);
      console.log(
        'Native Worker Sentry passed: real SDK, redacted canary, sink failure and recovery; no production ingest.'
      );
      return;
    }
    if (game) {
      const url = new URL('/backend/admin/freeze', await worker.url);
      const body = JSON.stringify({ frozen: false });
      const denied = await worker.fetch(url, { method: 'POST', body });
      assert.equal(
        denied.status,
        401,
        'Anonymous callers cannot enable writes'
      );
      const enabled = await worker.fetch(url, {
        method: 'POST',
        body,
        headers: { Authorization: `Bearer ${vars.LINEJAM_BACKEND_ADMIN_KEY}` },
      });
      assert.equal(enabled.status, 200);
      const status = await worker.fetch(
        new URL('/backend/admin/status', await worker.url),
        {
          headers: {
            Authorization: `Bearer ${vars.LINEJAM_BACKEND_ADMIN_KEY}`,
          },
        }
      );
      assert.equal(status.status, 200);
      const state = JSON.parse(await status.text());
      assert.equal(state.writesFrozen, false);
      const artifacts = resolve('.qa/worker');
      mkdirSync(artifacts, { recursive: true });
      writeFileSync(
        join(artifacts, 'receipt.json'),
        JSON.stringify(
          {
            source: sourceRevision(process.cwd()),
            backend: 'LinejamBackend / SQLite Durable Object',
            origin: backend.origin,
            persistent: false,
          },
          null,
          2
        )
      );
      const child = spawn(
        process.execPath,
        party
          ? [
              'node_modules/@playwright/test/cli.js',
              'test',
              '--config=scripts/qa/party.playwright.config.ts',
            ]
          : ['scripts/local/container.mjs', 'qa'],
        {
          env: {
            PATH: process.env.PATH,
            HOME: directory,
            TMPDIR: process.env.TMPDIR,
            CI: '1',
            NODE_ENV: 'test',
            ...vars,
            E2E_BASE_URL: backend.origin,
            LINEJAM_LOCAL_ARTIFACTS: artifacts,
            LINEJAM_EVIDENCE_DIR: join(artifacts, 'qa/evidence'),
            LINEJAM_EVIDENCE_RESULT_FILE: join(
              artifacts,
              'qa/evidence/result.json'
            ),
            PLAYWRIGHT_BROWSERS_PATH:
              process.env.PLAYWRIGHT_BROWSERS_PATH ||
              join(homedir(), '.cache/ms-playwright'),
          },
          stdio: 'inherit',
        }
      );
      const code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
      assert.equal(
        code,
        0,
        'Existing guest lifecycle and evidence consumer must pass'
      );
    }
    for (const template of game ? [] : ROUTE_TEMPLATES) {
      const { path, method, backendUnavailable } = routeProbe(template);
      try {
        const blockedBefore = blockedRequests;
        const response = await worker.fetch(new URL(path, await worker.url), {
          method,
          redirect: 'manual',
          signal: AbortSignal.timeout(15_000),
        });
        const bytes = Buffer.from(await response.arrayBuffer());
        assertRouteResponse(template, response, bytes);
        if (backendUnavailable) {
          assert(
            blockedRequests > blockedBefore,
            'Backend isolation must be exercised, not assumed'
          );
        }
        console.log(`PASS ${method} ${template}: ${response.status}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${method} ${template}: ${message}`);
        console.error(`FAIL ${failures.at(-1)}`);
      }
    }
  } catch (error) {
    mkdirSync('.qa/worker', { recursive: true });
    writeFileSync(
      '.qa/worker/private-failure-logs.json',
      JSON.stringify(logs, null, 2)
    );
    throw error;
  } finally {
    await worker?.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
  assertRuntimeLogs(logs);
  if (failures.length)
    throw new Error(`Worker route gate failed:\n${failures.join('\n')}`);
  console.log(
    game
      ? `Worker guest QA passed: fresh SQLite Durable Object; ${blockedRequests} external requests blocked.`
      : `Worker route gate passed: ${ROUTE_TEMPLATES.length} templates; ${blockedRequests} backend requests isolated; egress disabled.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
