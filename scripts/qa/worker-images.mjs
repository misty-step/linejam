// Exercise the actual OpenNext bundle in workerd, not next dev or mocked handlers.
import assert from 'node:assert/strict';
import { unstable_dev, unstable_readConfig } from 'wrangler';

const config = unstable_readConfig({ config: 'wrangler.jsonc' });
const worker = await unstable_dev(config.main, {
  config: 'wrangler.jsonc',
  ip: '127.0.0.1',
  port: 0,
  local: true,
  persist: false,
  logLevel: 'error',
  vars: {
    LINEJAM_LOCAL: '1',
    NEXT_PUBLIC_LINEJAM_LOCAL: '1',
    LINEJAM_DEPLOY_ENVIRONMENT: 'development',
    // No hosted backend or credentials. Unavailable poems must fail closed.
    NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:1',
    NEXT_PUBLIC_SENTRY_ENABLED: '0',
  },
  experimental: { disableExperimentalWarning: true, watch: false },
});

const unknown = '/poem/k970000000000000000000000000000a';
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
try {
  for (const method of ['GET', 'POST']) {
    const response = await worker.fetch(`${unknown}/card`, { method });
    assert.equal(response.status, 404, `${method} unknown card`);
    assert.equal(await response.text(), 'Poem not found or unavailable.');
    console.log(`${method} unknown card: 404`);
  }
  for (const [route, status] of [
    [`${unknown}/opengraph-image`, 404],
    ['/opengraph-image', 200],
    ['/recap/ZZZZ/opengraph-image', 200],
  ]) {
    const response = await worker.fetch(route);
    assert.equal(response.status, status, route);
    assert.equal(response.headers.get('content-type'), 'image/png', route);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(bytes.subarray(0, 8), signature, route);
    assert.equal(bytes.readUInt32BE(16), 1200, route);
    assert.equal(bytes.readUInt32BE(20), 630, route);
    console.log(`${route}: ${status}, PNG ${bytes.length} bytes, 1200x630`);
  }
} finally {
  await worker.stop();
}
