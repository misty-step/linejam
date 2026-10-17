/** @vitest-environment node */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

it('ignores generated Worker SDK output but still rejects active source dependencies', () => {
  const root = mkdtempSync(join(tmpdir(), 'linejam-provider-scope-'));
  const checker = resolve('scripts/check-provider-retirement.mjs');
  const marker = ['https://ver', 'cel.app'].join('');
  try {
    for (const directory of ['.open-next', '.release', '.wrangler']) {
      mkdirSync(join(root, directory));
      writeFileSync(join(root, directory, 'sdk.js'), marker);
    }
    const generatedOnly = spawnSync(process.execPath, [checker], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(generatedOnly.status).toBe(0);

    writeFileSync(join(root, 'app.ts'), marker);
    const activeSource = spawnSync(process.execPath, [checker], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(activeSource.status).toBe(1);
    expect(activeSource.stderr).toContain('app.ts');
    expect(activeSource.stderr).not.toContain('sdk.js');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
