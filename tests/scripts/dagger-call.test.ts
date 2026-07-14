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

const GIT_LOCAL_ENV_VARS = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX',
  'GIT_SHALLOW_FILE',
  'GIT_COMMON_DIR',
];

function writeExecutable(path: string, contents: string) {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
}

function cleanGitLocalEnv(env = process.env) {
  const clean = { ...env };
  for (const key of GIT_LOCAL_ENV_VARS) {
    delete clean[key];
  }
  return clean;
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
    env: cleanGitLocalEnv(),
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
        ...cleanGitLocalEnv(),
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

    const result = runDaggerCall(workspace, binDir, 'format-check', {
      GIT_DIR: join(workspace, 'not-this-repo.git'),
      GIT_WORK_TREE: join(workspace, 'not-this-worktree'),
      GIT_INDEX_FILE: join(workspace, 'not-this-index'),
    });

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

  it('passes the explicit unsynced Convex throttle flag into Dagger E2E', () => {
    const { workspace, scriptsDir, binDir } = createWorkspaceFixture();
    workspaces.push(workspace);

    const argsLog = join(workspace, 'dagger-args.log');

    copyFileSync(
      resolve(process.cwd(), 'scripts/ci/dotenv.mjs'),
      join(scriptsDir, 'dotenv.mjs')
    );
    writeExecutable(
      join(binDir, 'dagger'),
      `#!/bin/sh
printf '%s\\n' "$@" > "${argsLog}"
`
    );

    initGitRepo(workspace);

    const result = runDaggerCall(workspace, binDir, 'e2e', {
      CLERK_PUBLISHABLE_KEY: '',
      CLERK_SECRET_KEY: '',
      GUEST_TOKEN_SECRET: 'test-guest-token-secret',
      LINEJAM_ALLOW_UNSYNCED_CONVEX_THROTTLE: '1',
      LINEJAM_SYNC_CONVEX_BEFORE_DAGGER: '0',
      NEXT_PUBLIC_CANARY_API_KEY: 'test-canary-browser-key',
      NEXT_PUBLIC_CANARY_ENDPOINT: 'https://canary.example.test',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
      NEXT_PUBLIC_CONVEX_URL: 'https://test.convex.cloud',
      PLAYWRIGHT_CLERK_TEST_EMAIL: '',
    });

    expect(result.status).toBe(0);

    const args = readFileSync(argsLog, 'utf8').trim().split('\n');
    expect(args).toContain('e-2-e');
    expect(args).toContain('--playwright-require-auth-e2e=1');
    expect(args).toContain('--linejam-allow-unsynced-convex-throttle=1');
  });

  it('refuses a shared dev sync without per-invocation authority', () => {
    const { workspace, scriptsDir, binDir } = createWorkspaceFixture();
    workspaces.push(workspace);

    copyFileSync(
      resolve(process.cwd(), 'scripts/ci/dotenv.mjs'),
      join(scriptsDir, 'dotenv.mjs')
    );
    writeFileSync(
      join(workspace, '.env.local'),
      [
        'NEXT_PUBLIC_CONVEX_URL=https://dev.example.test',
        'LINEJAM_ALLOW_SHARED_DEV_CONVEX_SYNC=1',
      ].join('\n')
    );
    initGitRepo(workspace);

    const result = runDaggerCall(workspace, binDir, 'sync-shared-dev');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('LINEJAM_ALLOW_SHARED_DEV_CONVEX_SYNC=1');
  });

  it('syncs only the confirmed shared dev deployment and verifies it afterward', () => {
    const { workspace, scriptsDir, binDir } = createWorkspaceFixture();
    workspaces.push(workspace);

    const callsLog = join(workspace, 'pnpm-calls.log');
    copyFileSync(
      resolve(process.cwd(), 'scripts/ci/dotenv.mjs'),
      join(scriptsDir, 'dotenv.mjs')
    );
    writeFileSync(
      join(workspace, '.env.local'),
      'NEXT_PUBLIC_CONVEX_URL=https://dev.example.test\n'
    );
    writeExecutable(
      join(binDir, 'pnpm'),
      `#!/bin/sh
printf '%s\n' "$*" >> "${callsLog}"
case "$*" in
  *"function-spec --prod"*) printf '{"url": "https://prod.example.test", "functions": []}\n' ;;
  *"function-spec"*) printf '{"url": "https://dev.example.test", "functions": []}\n' ;;
  *"convex dev --once"*) exit 0 ;;
  *) exit 2 ;;
esac
`
    );
    initGitRepo(workspace);

    const result = runDaggerCall(workspace, binDir, 'sync-shared-dev', {
      LINEJAM_ALLOW_SHARED_DEV_CONVEX_SYNC: '1',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Shared Convex dev sync verified');
    const calls = readFileSync(callsLog, 'utf8');
    expect(calls).toContain(
      'exec convex dev --once --typecheck disable --codegen disable'
    );
    expect(calls.match(/exec convex function-spec/g)).toHaveLength(3);
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
