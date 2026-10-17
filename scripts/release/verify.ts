// Exercise the deploy input, not the source entrypoint; no network or accepted data.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { unstable_startWorker } from 'wrangler';
import { api } from '../../convex/_generated/api';
import {
  assertRouteResponse,
  assertRuntimeLogs,
  ROUTE_TEMPLATES,
  routeProbe,
} from '../qa/worker-route-contracts';

async function main() {
  const artifact = resolve('.release/wrangler.json');
  const config = JSON.parse(readFileSync(artifact, 'utf8'));
  assert.equal(config.vars.LINEJAM_DEPLOY_ENVIRONMENT, 'production');
  assert.equal(
    config.vars.NEXT_PUBLIC_CONVEX_URL,
    'https://linejam.mistystep.io/backend'
  );
  assert(!config.vars.LINEJAM_LOCAL && !config.vars.NEXT_PUBLIC_LINEJAM_LOCAL);
  // Like the existing route gate, keep Wrangler scratch/config discovery out
  // of the deploy input. Only relative file roots are resolved for workerd;
  // every deployed setting and the actual packaged modules/assets stay intact.
  const directory = mkdtempSync(join(tmpdir(), 'linejam-release-proof-'));
  const runtimeConfig = join(directory, 'wrangler.json');
  writeFileSync(
    runtimeConfig,
    JSON.stringify({
      ...config,
      main: resolve(dirname(artifact), config.main),
      assets: {
        ...config.assets,
        directory: resolve(dirname(artifact), config.assets.directory),
      },
    })
  );
  const backend = new URL(config.vars.NEXT_PUBLIC_CONVEX_URL);
  const guestSecret = randomBytes(32).toString('hex');
  const actionKey = randomBytes(32).toString('base64');
  const adminKey = randomBytes(32).toString('hex');
  const runtime = {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
    GUEST_TOKEN_SECRET: guestSecret,
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: actionKey,
    LINEJAM_BACKEND_ADMIN_KEY: adminKey,
    SENTRY_AUTOMATION_PROVENANCE_SECRET: randomBytes(32).toString('hex'),
    CLERK_SECRET_KEY: '', // Account provider unavailable; guest admission must work.
  };
  const logs: { level: string; message: string }[] = [];
  let blocked = 0;
  let allowBackend = false;
  let worker: Awaited<ReturnType<typeof unstable_startWorker>> | undefined;
  async function start(values: Record<string, string>) {
    return unstable_startWorker({
      config: runtimeConfig,
      bindings: Object.fromEntries(
        Object.entries(values).map(([name, value]) => [
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
        structuredLogsHandler: (log: { level: string; message: string }) =>
          logs.push(log),
        outboundService: async (request: Request) => {
          const url = new URL(request.url);
          if (
            allowBackend &&
            url.origin === backend.origin &&
            url.pathname.startsWith('/backend/')
          ) {
            assert(worker);
            return worker.fetch(request.url, {
              method: request.method,
              headers: [...request.headers],
              body: request.body ? await request.arrayBuffer() : undefined,
              redirect: 'manual',
            });
          }
          blocked++;
          return new Response(
            'Isolated release proof: external dependency unavailable',
            { status: 503 }
          );
        },
      },
    });
  }
  try {
    for (const invalid of [
      { GUEST_TOKEN_SECRET: '' },
      { NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: '' },
      { NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: 'invalid' },
    ]) {
      worker = await start({ ...runtime, ...invalid });
      for (const path of ['/', '/backend/api/mutation']) {
        const response = await worker.fetch(new URL(path, await worker.url));
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), {
          status: 'unavailable',
          reason: 'production_configuration',
        });
        assert.equal(response.headers.get('set-cookie'), null);
      }
      await worker.dispose();
      worker = undefined;
    }
    worker = await start(runtime);
    worker.raw.on('runtimeError', (error: { text: string }) =>
      logs.push({ level: 'error', message: error.text })
    );
    for (const template of ROUTE_TEMPLATES) {
      const { path, method } = routeProbe(template);
      const response = await worker.fetch(new URL(path, await worker.url), {
        method,
        redirect: 'manual',
      });
      assertRouteResponse(
        template,
        response,
        Buffer.from(await response.arrayBuffer())
      );
      console.log(`PASS packaged production ${method} ${template}`);
    }
    allowBackend = true;
    const freeze = new URL('/backend/admin/freeze', await worker.url);
    assert.equal(
      (await worker.fetch(freeze, { method: 'POST', body: '{"frozen":false}' }))
        .status,
      401
    );
    assert.equal(
      (
        await worker.fetch(freeze, {
          method: 'POST',
          body: '{"frozen":false}',
          headers: { Authorization: `Bearer ${adminKey}` },
        })
      ).status,
      200
    );
    const health = await worker.fetch(new URL('/api/health', await worker.url));
    // SAFETY: this is the real health handler; the gate asserts these fields below.
    const report = (await health.json()) as {
      deployment: { id: string; stableServerActions: boolean };
      env: { guestTokenParity: boolean };
    };
    assert.equal(health.status, 200, JSON.stringify(report));
    assert.equal(report.deployment.id, config.vars.NEXT_DEPLOYMENT_ID);
    assert.equal(report.deployment.stableServerActions, true);
    assert.equal(report.env.guestTokenParity, true);
    const session = await worker.fetch(
      new URL('/api/guest/session', await worker.url)
    );
    assert.equal(session.status, 200);
    // SAFETY: the real guest route succeeded; both fields are checked before use.
    const identity = (await session.json()) as {
      guestId: string;
      token: string;
    };
    assert(identity.guestId && identity.token);
    assert(session.headers.get('set-cookie')?.includes('HttpOnly'));
    const client = new ConvexHttpClient(
      new URL('/backend', await worker.url).href
    );
    const room = await client.mutation(api.rooms.createRoom, {
      guestToken: identity.token,
      displayName: 'Isolated release host',
      avatarId: 'rhyme',
    });
    assert(room);
    console.log(
      'PASS packaged production: missing/invalid binding rejection, recovery, source health, real guest issuance and room admission'
    );

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 320, height: 740 },
        reducedMotion: 'reduce',
      });
      const origin = (await worker.url).origin;
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === origin) return route.continue();
        // No browser request, SDK or script may contact a hosted service.
        blocked++;
        return route.abort('blockedbyclient');
      });
      const page = await context.newPage();
      const browserErrors: string[] = [];
      page.on('pageerror', (error) => browserErrors.push(error.message));
      mkdirSync('.qa/release', { recursive: true });
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme });
        await page.goto(origin);
        await page
          .getByRole('heading', { level: 1, name: 'A little room for words.' })
          .waitFor();
        assert.equal(
          await page
            .getByRole('navigation', { name: 'Play Linejam' })
            .getByRole('link', { name: 'Join a room' })
            .getAttribute('href'),
          '/join'
        );
        assert.equal(
          await page.locator('linejam-entry[view="home"] svg').count(),
          4
        );
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
          )
        );
        await page.screenshot({
          path: `.qa/release/home-${colorScheme}.png`,
          fullPage: true,
        });
      }
      await page.getByRole('button', { name: 'More options' }).click();
      await page.getByRole('button', { name: 'How to play' }).click();
      await page.getByRole('dialog', { name: 'How to play' }).waitFor();
      await page.getByRole('button', { name: 'Close help' }).waitFor();
      assert(
        await page
          .getByRole('button', { name: 'Close help' })
          .evaluate((element) => element === document.activeElement)
      );
      await page.screenshot({ path: '.qa/release/help.png', fullPage: true });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'More options' })
      ).toBeFocused();
      // The production browser still uses the existing provider's guest
      // fallback when Clerk is unavailable. Exercise the new entry view in
      // this packaged artifact, without claiming hosted account/multiplayer QA.
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme });
        await page.goto(`${origin}/join?code=a-bcd&name=MustNotPrefill`);
        const code = page.getByRole('textbox', { name: 'Room code' });
        const name = page.getByRole('textbox', { name: 'Your pen name' });
        await expect(name).toBeVisible({ timeout: 15_000 });
        await expect(code).toHaveValue('ABCD');
        await expect(name).toHaveValue('');
        await expect(
          page.getByRole('button', { name: 'Join room', exact: true })
        ).toBeDisabled();
        const avatar = page.getByRole('button', { name: /^Change avatar,/ });
        await avatar.click();
        const picker = page.getByRole('dialog', { name: 'Choose your avatar' });
        await expect(
          picker.getByRole('button', { name: 'Doodle', exact: true })
        ).toBeVisible();
        await page.screenshot({
          path: `.qa/release/picker-${colorScheme}.png`,
          fullPage: true,
        });
        await picker
          .getByRole('button', { name: 'Doodle', exact: true })
          .click();
        await expect(picker).toBeHidden();
        await expect(avatar).toBeFocused();
        await expect(avatar).toHaveAccessibleName(/Doodle selected/);
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
          )
        );
        await page.screenshot({
          path: `.qa/release/join-${colorScheme}.png`,
          fullPage: true,
        });
      }
      assert.deepEqual(browserErrors, []);
      await context.close();
    } finally {
      await browser.close();
    }
    assertRuntimeLogs(logs);
    writeFileSync(
      '.qa/release/receipt.json',
      JSON.stringify(
        {
          source: config.vars.NEXT_DEPLOYMENT_ID,
          productionConfigured: true,
          runtimeCredentials: 'generated disposable identities only',
          persistent: false,
          routeTemplates: ROUTE_TEMPLATES.length,
          rejectedBindingVariants: 3,
          homeThemes: 2,
          helpKeyboard: true,
          joinThemes: 2,
          joinInvitationAndPicker: true,
          browserErrors: 0,
          externalRequestsBlocked: blocked,
        },
        null,
        2
      ) + '\n'
    );
    console.log(
      'PASS packaged production Rust home/join/picker light/dark and keyboard help; all browser and Worker egress isolated'
    );
  } finally {
    await worker?.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
