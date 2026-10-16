// Verify the built artifact in workerd. Do not rebuild or modify it here: the
// release workflow deploys these exact bytes after this command succeeds.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { unstable_readConfig, unstable_startWorker } from 'wrangler';
import {
  ROUTE_TEMPLATES,
  assertRouteResponse,
  assertRuntimeLogs,
  routeProbe,
} from './worker-route-contracts';

async function main() {
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
        durable_objects: config.durable_objects,
        migrations: config.migrations,
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
      NEXT_PUBLIC_LINEJAM_LOCAL: process.env.NEXT_PUBLIC_LINEJAM_LOCAL ?? '0',
      LINEJAM_DEPLOY_ENVIRONMENT: 'development',
      NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:1',
      NEXT_PUBLIC_SENTRY_ENABLED: '0',
      LINEJAM_SENTRY_ENABLED: 'false',
      CLERK_SECRET_KEY: '',
      GUEST_TOKEN_SECRET: '',
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
        server: { hostname: '127.0.0.1', port: 0 },
        logLevel: 'error',
        // Native workerd outbound service: no DNS or network request can reach
        // a baked-in production URL. Do not replace with Node's fetch mocking.
        outboundService: () => {
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
    for (const template of ROUTE_TEMPLATES) {
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
  } finally {
    await worker?.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
  assertRuntimeLogs(logs);
  if (failures.length)
    throw new Error(`Worker route gate failed:\n${failures.join('\n')}`);
  console.log(
    `Worker route gate passed: ${ROUTE_TEMPLATES.length} templates; ${blockedRequests} backend requests isolated; egress disabled.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
