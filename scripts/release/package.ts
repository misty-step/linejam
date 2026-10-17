// Package once; both isolated proof and deployment consume .release/wrangler.json.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { unstable_readConfig } from 'wrangler';
import { sourceRevision } from '../check.mjs';

const source = process.env.NEXT_DEPLOYMENT_ID || sourceRevision(process.cwd());
assert(
  source && /^[a-f0-9]{40}$/.test(source),
  'Release requires exact source'
);
const config = unstable_readConfig({
  config: 'wrangler.jsonc',
  env: 'production',
});
assert(config.assets?.directory, 'Release requires Worker assets');
rmSync('.release', { recursive: true, force: true });
mkdirSync('.release', { recursive: true });
const result = spawnSync(
  'pnpm',
  [
    'exec',
    'wrangler',
    'deploy',
    '--env',
    'production',
    '--dry-run',
    '--outdir',
    '.release/modules',
  ],
  { stdio: 'inherit' }
);
assert.equal(result.status, 0, 'Worker packaging failed');
// Wrangler includes a source map and deployment README that are not runtime inputs.
rmSync('.release/modules/worker.js.map', { force: true });
rmSync('.release/modules/README.md', { force: true });
cpSync(resolve(config.assets.directory), '.release/assets', {
  recursive: true,
});

writeFileSync(
  '.release/wrangler.json',
  JSON.stringify(
    {
      name: config.name,
      account_id: config.account_id,
      main: 'modules/worker.js',
      no_bundle: true,
      find_additional_modules: true,
      rules: [
        { type: 'CompiledWasm', globs: ['**/*.wasm'], fallthrough: true },
        { type: 'Data', globs: ['**/*.bin'], fallthrough: true },
      ],
      compatibility_date: config.compatibility_date,
      compatibility_flags: config.compatibility_flags,
      workers_dev: false,
      preview_urls: false,
      send_metrics: false,
      observability: config.observability,
      routes: config.routes,
      assets: { ...config.assets, directory: 'assets' },
      durable_objects: config.durable_objects,
      migrations: config.migrations,
      // Existing Worker secrets stay bound, including its public Clerk/DSN
      // values. Do not convert or rebind them during an application release.
      vars: { ...config.vars, NEXT_DEPLOYMENT_ID: source },
    },
    null,
    2
  ) + '\n'
);
console.log(
  `Packaged production Worker source=${source}; no runtime credentials`
);
