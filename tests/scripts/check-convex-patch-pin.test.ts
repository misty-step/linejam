/** @vitest-environment node */
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkConvexPatchPin } from '@/scripts/qa/check-convex-patch-pin.mjs';

const providerRetirementScript = resolve(
  'scripts/check-provider-retirement.mjs'
);
const workspaces: string[] = [];

function createWorkspace({
  resolvedVersion = '9.8.7',
  patchKey = `convex@${resolvedVersion}`,
  patchPath = `patches/${patchKey}.patch`,
  createPatch = true,
}: {
  resolvedVersion?: string;
  patchKey?: string;
  patchPath?: string;
  createPatch?: boolean;
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'linejam-convex-patch-pin-'));
  workspaces.push(root);
  const workspaceContents = `packages: []
patchedDependencies:
  ${patchKey}: ${patchPath}
`;
  const lockfileContents = `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      convex:
        specifier: ^${resolvedVersion}
        version: ${resolvedVersion}(patch_hash=fixture)
`;
  writeFileSync(join(root, 'pnpm-workspace.yaml'), workspaceContents);
  writeFileSync(join(root, 'pnpm-lock.yaml'), lockfileContents);
  if (createPatch) {
    const absolutePatchPath = join(root, patchPath);
    mkdirSync(dirname(absolutePatchPath), { recursive: true });
    writeFileSync(absolutePatchPath, 'fixture patch\n');
  }

  return { lockfileContents, patchPath, root, workspaceContents };
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe('checkConvexPatchPin', () => {
  it('follows the workspace patch key and leaves every input unchanged', async () => {
    const fixture = createWorkspace();
    const patchContents = readFileSync(
      join(fixture.root, fixture.patchPath),
      'utf8'
    );

    await expect(checkConvexPatchPin({ root: fixture.root })).resolves.toEqual({
      patchKey: 'convex@9.8.7',
      patchPath: 'patches/convex@9.8.7.patch',
      resolvedVersion: '9.8.7',
    });
    expect(
      readFileSync(join(fixture.root, 'pnpm-workspace.yaml'), 'utf8')
    ).toBe(fixture.workspaceContents);
    expect(readFileSync(join(fixture.root, 'pnpm-lock.yaml'), 'utf8')).toBe(
      fixture.lockfileContents
    );
    expect(readFileSync(join(fixture.root, fixture.patchPath), 'utf8')).toBe(
      patchContents
    );
  });

  it('fails closed when the resolved version is not patched', async () => {
    const fixture = createWorkspace({
      resolvedVersion: '1.43.0',
      patchKey: 'convex@1.42.3',
    });

    await expect(checkConvexPatchPin({ root: fixture.root })).rejects.toThrow(
      'Resolved convex@1.43.0 is not a key in pnpm-workspace.yaml patchedDependencies.'
    );
  });

  it('fails when the configured patch file is missing', async () => {
    const fixture = createWorkspace({ createPatch: false });

    await expect(checkConvexPatchPin({ root: fixture.root })).rejects.toThrow(
      'pnpm-workspace.yaml patch file is missing: patches/convex@9.8.7.patch'
    );
  });

  it('runs from the provider-retirement quality gate', () => {
    const fixture = createWorkspace({
      resolvedVersion: '1.43.0',
      patchKey: 'convex@1.42.3',
    });
    const result = spawnSync(process.execPath, [providerRetirementScript], {
      cwd: fixture.root,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Resolved convex@1.43.0 is not a key in pnpm-workspace.yaml patchedDependencies.'
    );
  });
});
