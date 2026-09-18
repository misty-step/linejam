/** @vitest-environment node */
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const workspaces: string[] = [];
const children: ChildProcess[] = [];
const stalePid = 2_147_483_647;

interface LocalCliFixture {
  workspace: string;
  bin: string;
  state: string;
  calls: string;
  lock: string;
  boundary: string;
}

function fixture(): LocalCliFixture {
  const workspace = realpathSync(
    mkdtempSync(join(tmpdir(), 'linejam-local-cli-'))
  );
  workspaces.push(workspace);
  const scripts = join(workspace, 'scripts/local');
  const bin = join(workspace, 'bin');
  const state = join(workspace, '.qa/local/linejam-local-locks');
  mkdirSync(scripts, { recursive: true });
  mkdirSync(bin);
  for (const name of ['secrets', 'artifacts', 'docker-config']) {
    mkdirSync(join(state, name), { recursive: true, mode: 0o700 });
  }
  copyFileSync(resolve('scripts/local/cli.mjs'), join(scripts, 'cli.mjs'));
  writeFileSync(
    join(state, 'owner.json'),
    JSON.stringify({
      schemaVersion: 1,
      project: 'linejam-local-locks',
      checkout: workspace,
      checkoutId: createHash('sha256')
        .update(workspace)
        .digest('hex')
        .slice(0, 12),
      owner: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      ports: { app: 3333, convex: 3210, site: 3211 },
      dockerHost: 'unix:///var/run/docker.sock',
    }),
    { mode: 0o600 }
  );
  writeFileSync(join(state, 'secrets/guest-token'), 'g'.repeat(64), {
    mode: 0o600,
  });
  writeFileSync(join(state, 'secrets/convex-admin-key'), '', { mode: 0o600 });
  const calls = join(workspace, 'docker-calls');
  const docker = join(bin, 'docker');
  writeFileSync(
    docker,
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(4);
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n');
if (args[0] === 'compose' && args[1] === 'version') console.log('5.5.0');
else if (args[0] === 'version') console.log('linux');
else if (args[0] === 'info') console.log('[]');
else if (args[0] === 'ps' || (['network', 'volume'].includes(args[0]) && args[1] === 'ls')) {}
else if (args[0] === 'compose' && (args.includes('down') || args.includes('ps'))) {}
else throw new Error('Unexpected Docker fixture operation');
`
  );
  chmodSync(docker, 0o755);
  const lock = join(state, 'operation.lock');
  const boundary = join(workspace, 'process-boundary.mjs');
  writeFileSync(
    boundary,
    `import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
const readFile = fs.readFile;
const kill = process.kill;
process.kill = (pid, signal) => {
  if (pid === ${stalePid} && signal === 0) {
    throw Object.assign(new Error('Fixture PID is absent'), { code: 'ESRCH' });
  }
  return kill(pid, signal);
};
fs.readFile = async (file, ...args) => {
  const contents = await readFile(file, ...args);
  if (file === ${JSON.stringify(lock)} && process.env.HOLD_LOCK_SNAPSHOT === '1') {
    const { promise, resolve } = Promise.withResolvers();
    process.once('message', resolve);
    process.send('observed-lock');
    await promise;
  }
  return contents;
};
syncBuiltinESMExports();
`
  );
  return { workspace, bin, state, calls, lock, boundary };
}

function run(
  setup: LocalCliFixture,
  command: string,
  holdLockSnapshot = false
) {
  const child = spawn(
    process.execPath,
    [
      '--import',
      setup.boundary,
      'scripts/local/cli.mjs',
      command,
      '--project',
      'locks',
      ...(command === 'reset' ? ['--confirm', 'linejam-local-locks'] : []),
    ],
    {
      cwd: setup.workspace,
      env: {
        NODE_ENV: 'test',
        PATH: `${setup.bin}:${process.env.PATH ?? ''}`,
        HOME: setup.workspace,
        HOLD_LOCK_SNAPSHOT: holdLockSnapshot ? '1' : '0',
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      timeout: 10_000,
    }
  );
  children.push(child);
  if (!child.stdout || !child.stderr) {
    throw new Error('The IPC fixture requires piped output streams.');
  }
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const {
    promise,
    resolve: finish,
    reject,
  } = Promise.withResolvers<{
    code: number | null;
    stdout: string;
    stderr: string;
  }>();
  child.once('error', reject);
  child.once('close', (code) => finish({ code, stdout, stderr }));
  return { child, result: promise };
}

afterEach(async () => {
  await Promise.all(
    children.splice(0).map(async (child) => {
      if (child.exitCode === null && child.signalCode === null) {
        const closed = once(child, 'close');
        child.kill('SIGKILL');
        await closed;
      }
    })
  );
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe('local command operation ownership', () => {
  it('refuses both stale-lock contenders without reclaiming their lock', async () => {
    const setup = fixture();
    const stale = JSON.stringify({ pid: stalePid, command: 'dev' });
    writeFileSync(setup.lock, stale, { mode: 0o600 });
    const first = run(setup, 'down', true);
    const second = run(setup, 'check', true);
    await Promise.all([
      once(first.child, 'message'),
      once(second.child, 'message'),
    ]);
    first.child.send('continue');
    second.child.send('continue');

    const results = await Promise.all([first.result, second.result]);
    expect(results.map((result) => result.code)).toEqual([1, 1]);
    expect(readFileSync(setup.lock, 'utf8')).toBe(stale);
    expect(existsSync(setup.calls)).toBe(false);
  });

  it('cannot delete a newer live lock after contenders read a stale snapshot', async () => {
    const setup = fixture();
    writeFileSync(
      setup.lock,
      JSON.stringify({ pid: stalePid, command: 'dev' })
    );
    const first = run(setup, 'down', true);
    const second = run(setup, 'reset', true);
    await Promise.all([
      once(first.child, 'message'),
      once(second.child, 'message'),
    ]);
    const replacement = JSON.stringify({ pid: process.pid, command: 'dev' });
    unlinkSync(setup.lock);
    writeFileSync(setup.lock, replacement, { flag: 'wx', mode: 0o600 });
    first.child.send('continue');
    second.child.send('continue');

    const results = await Promise.all([first.result, second.result]);
    expect(results.map((result) => result.code)).toEqual([1, 1]);
    expect(readFileSync(setup.lock, 'utf8')).toBe(replacement);
    expect(existsSync(setup.calls)).toBe(false);
    expect(existsSync(join(setup.state, 'owner.json'))).toBe(true);
  });

  it('refuses an active owner and releases its own lock after ordinary teardown', async () => {
    const setup = fixture();
    const owner = readFileSync(join(setup.state, 'owner.json'), 'utf8');
    const active = JSON.stringify({ pid: process.pid, command: 'dev' });
    writeFileSync(setup.lock, active, { flag: 'wx', mode: 0o600 });

    expect((await run(setup, 'down').result).code).toBe(1);
    expect(readFileSync(setup.lock, 'utf8')).toBe(active);
    expect(existsSync(setup.calls)).toBe(false);
    unlinkSync(setup.lock);

    expect((await run(setup, 'down').result).code).toBe(0);
    expect(existsSync(setup.lock)).toBe(false);
    expect((await run(setup, 'down').result).code).toBe(0);
    expect(readFileSync(join(setup.state, 'owner.json'), 'utf8')).toBe(owner);
  });

  it('keeps status read-only while another command owns the project', async () => {
    const setup = fixture();
    const active = JSON.stringify({ pid: process.pid, command: 'dev' });
    const environment = join(setup.state, 'compose.env');
    writeFileSync(setup.lock, active, { flag: 'wx', mode: 0o600 });
    writeFileSync(environment, 'existing owned Compose environment\n', {
      mode: 0o600,
    });

    expect((await run(setup, 'status').result).code).toBe(0);
    expect(readFileSync(setup.lock, 'utf8')).toBe(active);
    expect(readFileSync(environment, 'utf8')).toBe(
      'existing owned Compose environment\n'
    );
  });
});
