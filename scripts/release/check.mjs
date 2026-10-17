// The one native checker plus one production build of the artifact we promote.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import Ajv from 'ajv/dist/2020.js';
import { runChecks, sourceRevision } from '../check.mjs';

const { values } = parseArgs({
  options: {
    mode: { type: 'string', default: 'fast' },
    'public-config': { type: 'string' },
  },
});
assert(
  values['public-config'],
  'Supply the three existing public browser inputs'
);
const publicInputs = JSON.parse(readFileSync(values['public-config'], 'utf8'));
const publicNames = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_POSTHOG_KEY',
  'NEXT_PUBLIC_SENTRY_DSN',
];
const validInputs = new Ajv().compile({
  type: 'object',
  additionalProperties: false,
  required: publicNames,
  properties: Object.fromEntries(
    publicNames.map((name) => [
      name,
      { type: 'string', minLength: 1, maxLength: 2048 },
    ])
  ),
});
assert(
  validInputs(publicInputs),
  'Only the three nonempty public browser inputs may enter the build sandbox'
);
const source = sourceRevision(process.cwd());
assert(
  source && /^[a-f0-9]{40}$/.test(source),
  'Native release needs an exact Git source'
);
runChecks(process.cwd(), values.mode);
const environment = {
  ...process.env,
  ...publicInputs,
  CI: '1',
  NEXT_TELEMETRY_DISABLED: '1',
  WRANGLER_SEND_METRICS: 'false',
  LINEJAM_LOCAL: '0',
  NEXT_PUBLIC_LINEJAM_LOCAL: '0',
  LINEJAM_DEPLOY_ENVIRONMENT: 'production',
  NEXT_PUBLIC_CONVEX_URL: 'https://linejam.mistystep.io/backend',
  NEXT_PUBLIC_POSTHOG_ENVIRONMENT: 'production',
  NEXT_PUBLIC_SENTRY_ENABLED: '1',
  NEXT_DEPLOYMENT_ID: source,
  CIRCLE_NODE_TOTAL: '2',
};
for (const command of ['build:cf', 'release:package', 'release:verify']) {
  console.log(`> pnpm ${command}: production source=${source}`);
  const result = spawnSync('pnpm', [command], {
    env: environment,
    stdio: 'inherit',
  });
  assert.equal(result.status, 0, `Production artifact ${command} failed`);
}
