import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

function createWorkspace() {
  const workspace = mkdtempSync(join(tmpdir(), 'linejam-claims-'));
  return {
    workspace,
    claimsDir: join(workspace, '.claims'),
  };
}

function runClaimsScript(script: string, claimsDir: string) {
  return spawnSync('bash', ['--noprofile', '--norc', '-lc', script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CLAIMS_DIR: claimsDir,
    },
    encoding: 'utf8',
  });
}

describe('claims.sh', () => {
  const workspaces: string[] = [];

  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('does not enable errexit when sourced', () => {
    const { workspace, claimsDir } = createWorkspace();
    workspaces.push(workspace);

    const result = runClaimsScript(
      `
        set +e
        source scripts/lib/claims.sh
        set -o | grep -E '^errexit[[:space:]]+off$' >/dev/null
      `,
      claimsDir
    );

    expect(result.status).toBe(0);
  });

  it('rejects traversal ids before touching the filesystem', () => {
    const { workspace, claimsDir } = createWorkspace();
    workspaces.push(workspace);

    const escapedPath = join(dirname(claimsDir), 'escape.lock');
    const result = runClaimsScript(
      `
        source scripts/lib/claims.sh
        claim_acquire '../escape'
      `,
      claimsDir
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('invalid claim id');
    expect(existsSync(escapedPath)).toBe(false);
  });

  it('acquires, lists, and releases safe claim ids', () => {
    const { workspace, claimsDir } = createWorkspace();
    workspaces.push(workspace);

    const result = runClaimsScript(
      `
        source scripts/lib/claims.sh
        claim_acquire smoke-test
        claim_list
        printf -- '---\\n'
        claim_release smoke-test
        claim_list
      `,
      claimsDir
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('smoke-test\n');
    expect(result.stdout.trimEnd().endsWith('---')).toBe(true);
    expect(existsSync(join(claimsDir, 'smoke-test.lock'))).toBe(false);
  });
});
