import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

function writeExecutable(path: string, contents: string) {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
}

function createWorkspaceFixture() {
  const workspace = mkdtempSync(join(tmpdir(), 'linejam-dagger-call-'));
  const scriptsDir = join(workspace, 'scripts/ci');
  const daggerDir = join(workspace, 'dagger');
  const binDir = join(workspace, 'bin');

  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(daggerDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });

  copyFileSync(
    resolve(process.cwd(), 'scripts/ci/dagger-call.sh'),
    join(scriptsDir, 'dagger-call.sh')
  );
  writeExecutable(
    join(binDir, 'rsync'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const source = process.argv.at(-2);
const destination = process.argv.at(-1);
const raw = fs.readFileSync(0).toString('utf8').split('\\0');

for (const relative of raw) {
  if (!relative) continue;
  const src = path.join(source, relative);
  const dst = path.join(destination, relative);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
`
  );

  return { workspace, scriptsDir, binDir };
}

function initGitRepo(workspace: string) {
  const gitInit = spawnSync('git', ['init', '-q'], {
    cwd: workspace,
    encoding: 'utf8',
  });

  expect(gitInit.status).toBe(0);
}

function runDaggerCall(
  workspace: string,
  binDir: string,
  command: string,
  env: Record<string, string> = {}
) {
  return spawnSync(
    'bash',
    ['--noprofile', '--norc', '-lc', `scripts/ci/dagger-call.sh ${command}`],
    {
      cwd: workspace,
      env: {
        ...process.env,
        ...env,
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
      },
      encoding: 'utf8',
    }
  );
}

describe('dagger-call.sh', () => {
  const workspaces: string[] = [];

  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('runs dagger from the snapshot and preserves dotenv-loaded values', () => {
    const { workspace, scriptsDir, binDir } = createWorkspaceFixture();
    workspaces.push(workspace);

    const pwdLog = join(workspace, 'dagger-pwd.log');
    const argsLog = join(workspace, 'dagger-args.log');
    const envLog = join(workspace, 'dagger-env.log');

    copyFileSync(
      resolve(process.cwd(), 'scripts/ci/dotenv.mjs'),
      join(scriptsDir, 'dotenv.mjs')
    );

    writeFileSync(
      join(workspace, '.env.local'),
      'NEXT_PUBLIC_CANARY_API_KEY="key\\\\value" # comment\n'
    );

    writeExecutable(
      join(binDir, 'dagger'),
      `#!/bin/sh
printf '%s' "$PWD" > "${pwdLog}"
printf '%s\n' "$@" > "${argsLog}"
printf '%s' "\${NEXT_PUBLIC_CANARY_API_KEY:-}" > "${envLog}"
`
    );

    initGitRepo(workspace);

    const result = runDaggerCall(workspace, binDir, 'format-check');

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');

    const snapshotDir = readFileSync(pwdLog, 'utf8');
    const args = readFileSync(argsLog, 'utf8').trim().split('\n');

    expect(snapshotDir).not.toBe(workspace);
    expect(snapshotDir.startsWith(tmpdir())).toBe(true);
    expect(existsSync(snapshotDir)).toBe(false);
    expect(args).toContain('call');
    expect(args).toContain('format-check');
    expect(args).toContain('--source=.');
    expect(args).toContain('--next-public-canary-api-key=key\\value');
    expect(readFileSync(envLog, 'utf8')).toBe('key\\value');
  });

  it('fails fast when dotenv loading fails before invoking dagger', () => {
    const { workspace, scriptsDir, binDir } = createWorkspaceFixture();
    workspaces.push(workspace);

    const invokeLog = join(workspace, 'dagger-invoked.log');

    writeFileSync(
      join(workspace, '.env.local'),
      'NEXT_PUBLIC_CANARY_API_KEY=1\n'
    );
    writeFileSync(
      join(scriptsDir, 'dotenv.mjs'),
      'process.stderr.write("dotenv failed\\n"); process.exit(7);\n'
    );
    writeExecutable(
      join(binDir, 'dagger'),
      `#!/bin/sh
printf 'called' > "${invokeLog}"
`
    );

    initGitRepo(workspace);

    const result = runDaggerCall(workspace, binDir, 'format-check');

    expect(result.status).toBe(7);
    expect(result.stderr).toContain('dotenv failed');
    expect(existsSync(invokeLog)).toBe(false);
  });

  it('treats post-success Dagger transport cleanup noise as success', () => {
    const { workspace, scriptsDir, binDir } = createWorkspaceFixture();
    workspaces.push(workspace);

    copyFileSync(
      resolve(process.cwd(), 'scripts/ci/dotenv.mjs'),
      join(scriptsDir, 'dotenv.mjs')
    );
    writeExecutable(
      join(binDir, 'dagger'),
      `#!/bin/sh
printf 'Ci.formatCheck DONE\\n'
printf 'Error: Post "http://dagger/query": unexpected EOF\\n' >&2
printf 'cleanup failed msg="close dagger session"\\n' >&2
exit 1
`
    );

    initGitRepo(workspace);

    const result = runDaggerCall(workspace, binDir, 'format-check');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Ci.formatCheck DONE');
    expect(result.stderr).toContain(
      'Dagger transport cleanup failed after format-check completed successfully; treating the run as passed.'
    );
  });

  it('rejects untrusted smoke origins before invoking dagger', () => {
    const { workspace, scriptsDir, binDir } = createWorkspaceFixture();
    workspaces.push(workspace);

    const invokeLog = join(workspace, 'dagger-invoked.log');

    copyFileSync(
      resolve(process.cwd(), 'scripts/ci/dotenv.mjs'),
      join(scriptsDir, 'dotenv.mjs')
    );
    writeFileSync(
      join(workspace, '.env.local'),
      [
        'LINEJAM_ENFORCE_SMOKE_URL_ALLOWLIST=1',
        'PLAYWRIGHT_BASE_URL=https://evil.example',
      ].join('\n')
    );
    writeExecutable(
      join(binDir, 'dagger'),
      `#!/bin/sh
printf 'called' > "${invokeLog}"
`
    );

    initGitRepo(workspace);

    const result = runDaggerCall(workspace, binDir, 'smoke');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Refusing to run smoke against untrusted origin https://evil.example.'
    );
    expect(existsSync(invokeLog)).toBe(false);
  });

  it('rejects authenticated smoke without Clerk credentials before invoking dagger', () => {
    const { workspace, scriptsDir, binDir } = createWorkspaceFixture();
    workspaces.push(workspace);

    const invokeLog = join(workspace, 'dagger-invoked.log');
    const canaryScriptsDir = join(workspace, 'scripts/canary');

    mkdirSync(canaryScriptsDir, { recursive: true });
    copyFileSync(
      resolve(process.cwd(), 'scripts/ci/dotenv.mjs'),
      join(scriptsDir, 'dotenv.mjs')
    );
    copyFileSync(
      resolve(process.cwd(), 'scripts/canary/smoke-auth.mjs'),
      join(canaryScriptsDir, 'smoke-auth.mjs')
    );
    writeFileSync(
      join(workspace, '.env.local'),
      [
        'PLAYWRIGHT_REQUIRE_AUTH_SMOKE=1',
        'PLAYWRIGHT_BASE_URL=https://staging.linejam.app',
      ].join('\n')
    );
    writeExecutable(
      join(binDir, 'dagger'),
      `#!/bin/sh
printf 'called' > "${invokeLog}"
`
    );

    initGitRepo(workspace);

    const result = runDaggerCall(workspace, binDir, 'smoke', {
      CLERK_PUBLISHABLE_KEY: '',
      CLERK_SECRET_KEY: '',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Authenticated smoke requires NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.'
    );
    expect(existsSync(invokeLog)).toBe(false);
  });
});
