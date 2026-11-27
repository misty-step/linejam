// `pnpm verify` — the whole acceptance bar in one command, on this machine,
// with zero cloud credentials: build (checksum gate), types, formatting, the
// Durable Object + CLI + MCP suites, then the headed two-player walkthrough
// against a live `wrangler dev`. A failing step stops verification, nonzero.
import { spawnSync } from 'node:child_process';
import { ensureLocalSecrets, localEnv, root } from './local.mjs';

ensureLocalSecrets();
const fast = process.argv.includes('--fast');
const display = process.env.DISPLAY ? [] : ['xvfb-run', '-a'];
const steps = [
  ['build', ['node', 'scripts/build.mjs']],
  ['typecheck', ['pnpm', 'typecheck']],
  ['format', ['pnpm', 'format:check']],
  ['tests', ['pnpm', 'exec', 'vitest', 'run']],
  ...(fast ? [] : [['walkthrough', [...display, 'node', 'e2e/walkthrough.mjs']]]),
];

const revision =
  spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim() || 'no git metadata';
console.log(`verify: mode=${fast ? 'fast' : 'full'} revision=${revision}`);
for (const [name, command] of steps) {
  console.log(`\n── ${name}: ${command.join(' ')}`);
  const result = spawnSync(command[0], command.slice(1), { cwd: root, env: localEnv(), stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`\nverify: ${name} failed (exit ${result.status ?? result.signal})`);
    process.exit(result.status ?? 1);
  }
}
console.log(`\nverify: ${steps.length} steps passed at ${revision}`);
