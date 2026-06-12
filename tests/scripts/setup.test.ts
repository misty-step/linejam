import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

function createWorkspace() {
  return mkdtempSync(join(tmpdir(), 'linejam-setup-'));
}

function runSetup(args: string[], cwd = process.cwd()) {
  return spawnSync('bash', ['scripts/setup.sh', ...args], {
    cwd,
    env: {
      ...process.env,
      CI: '1',
    },
    encoding: 'utf8',
  });
}

describe('scripts/setup.sh', () => {
  const workspaces: string[] = [];

  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('prints help for the supported bootstrap options', () => {
    const result = runSetup(['--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: bash scripts/setup.sh');
    expect(result.stdout).toContain('--write-env');
    expect(result.stdout).toContain('--skip-install');
  });

  it('writes env files from the example without requiring install', () => {
    const workspace = createWorkspace();
    workspaces.push(workspace);
    const envExample = join(workspace, '.env.example');
    const envLocal = join(workspace, '.env.local');
    writeFileSync(envExample, 'NEXT_PUBLIC_CONVEX_URL=\n');

    const result = runSetup([
      '--write-env',
      '--skip-install',
      '--env-example',
      envExample,
      '--env-local',
      envLocal,
    ]);

    expect(result.status).toBe(0);
    expect(readFileSync(envLocal, 'utf8')).toBe('NEXT_PUBLIC_CONVEX_URL=\n');
    expect(result.stdout).toContain(`created ${envLocal}`);
  });

  it('does not clobber an existing env file', () => {
    const workspace = createWorkspace();
    workspaces.push(workspace);
    const envExample = join(workspace, '.env.example');
    const envLocal = join(workspace, '.env.local');
    writeFileSync(envExample, 'NEXT_PUBLIC_CONVEX_URL=\n');
    writeFileSync(envLocal, 'KEEP=me\n');

    const result = runSetup([
      '--write-env',
      '--skip-install',
      '--env-example',
      envExample,
      '--env-local',
      envLocal,
    ]);

    expect(result.status).toBe(0);
    expect(readFileSync(envLocal, 'utf8')).toBe('KEEP=me\n');
    expect(result.stdout).toContain(`kept existing ${envLocal}`);
  });

  it('prepares the claims directory when install is skipped', () => {
    const workspace = createWorkspace();
    workspaces.push(workspace);
    const claimsDir = join(workspace, '.claims');

    const result = spawnSync(
      'bash',
      ['scripts/setup.sh', '--skip-install', '--claims-dir', claimsDir],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CI: '1',
        },
        encoding: 'utf8',
      }
    );

    expect(result.status).toBe(0);
    expect(existsSync(claimsDir)).toBe(true);
    expect(result.stdout).toContain(`claims directory ready at ${claimsDir}`);
  });
});
