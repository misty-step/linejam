import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, inject, it } from 'vitest';
import { signGuestToken } from '../../src/auth.ts';
// @ts-expect-error plain ESM helper without types
import { convert, readTables } from '../../scripts/import-legacy.mjs';
import { cli, root } from './helpers.ts';

const url = inject('linejamUrl');
const fixture = join(root, 'tests/fixtures/legacy-export');

function localVars(): Record<string, string> {
  return Object.fromEntries(
    readFileSync(join(root, '.dev.vars'), 'utf8')
      .split('\n')
      .filter((line) => line.includes('='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])
  );
}

function importer(
  args: string[],
  env: Record<string, string>
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(root, 'scripts/import-legacy.mjs'), ...args], {
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

describe('[L1-5.4] legacy export → archive import', () => {
  it('converts only completed games, with write-time bylines and published links', () => {
    const batch = convert(readTables(fixture));
    expect(batch.games.map((g: { gameId: string }) => g.gameId)).toEqual(['g_done']);
    expect(batch.skipped).toEqual({ notCompleted: 2, incompletePoems: 0 });
    const [game] = batch.games;
    expect(game.participants.sort()).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
    expect(game.poems.map((p: { id: string }) => p.id)).toEqual(['p_done_a', 'p_done_b']);
    expect(game.poems[1].lines[8].authorName).toBe('Old Sol');
    // No abandoned or unfinished text anywhere in what would be sent.
    expect(JSON.stringify(batch)).not.toMatch(/abandoned secret|unfinished secret/);
    // A favorite on a poem that is not imported is not carried over as a dangling row.
    expect(batch.favorites).toEqual([
      { guestId: '22222222-2222-4222-8222-222222222222', poemId: 'p_done_b', createdAt: 1757003000000 },
    ]);
    // The active slug is honored; the revoked one is not resurrected.
    expect(batch.shares).toEqual([
      {
        kind: 'poem',
        targetId: 'p_done_a',
        token: 'legacy-slug-7f3k9q2m',
        createdBy: '11111111-1111-4111-8111-111111111111',
        activatedAt: 1757000990000,
      },
    ]);
  });

  it('imports through the operator route; the legacy guest then finds their archive and the published link works', async () => {
    const vars = localVars();
    const refused = await importer([fixture, '--url', url], {
      LINEJAM_ADMIN_KEY: 'local-wrong-key-0000000000000000000000000000',
    });
    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('HTTP 401');

    const first = await importer([fixture, '--url', url], { LINEJAM_ADMIN_KEY: vars.LINEJAM_ADMIN_KEY! });
    expect(first.code).toBe(0);
    expect(JSON.parse(first.stdout).imported).toEqual({ games: 1, poems: 2, favorites: 1, shares: 1 });
    const again = await importer([fixture, '--url', url], { LINEJAM_ADMIN_KEY: vars.LINEJAM_ADMIN_KEY! });
    expect(JSON.parse(again.stdout).imported).toEqual({ games: 0, poems: 0, favorites: 0, shares: 0 });

    // A browser still holding its pre-recompile guest credential (same format, same secret).
    const sol = await signGuestToken(vars.GUEST_TOKEN_SECRET!, '22222222-2222-4222-8222-222222222222', Date.now());
    const archive = JSON.parse((await cli(url, ['poems', 'list', '--guest-token', sol])).stdout);
    expect(
      archive.map((p: { id: string; favorited: boolean; shared: boolean }) => [p.id, p.favorited, p.shared])
    ).toEqual([
      ['p_done_b', true, false],
      ['p_done_a', false, true],
    ]);
    const poem = JSON.parse((await cli(url, ['poems', 'get', 'p_done_b', '--guest-token', sol])).stdout);
    expect(poem.lines).toHaveLength(9);
    expect(poem.lines[8].by).toBe('Old Sol');

    // The link published before the recompile, in its original shape.
    const page = await fetch(`${url}/poem/p_done_a?share=legacy-slug-7f3k9q2m`, { headers: { accept: 'text/html' } });
    expect(page.status).toBe(200);
    const shared = await fetch(`${url}/api/poems/p_done_a?share=legacy-slug-7f3k9q2m`);
    expect(shared.status).toBe(200);
    expect(((await shared.json()) as { lines: unknown[] }).lines).toHaveLength(9);
    // The revoked legacy slug stays dead, and private poems stay private.
    expect((await fetch(`${url}/api/poems/p_done_b?share=legacy-revoked-slug`)).status).toBe(404);
    expect(
      (await fetch(`${url}/poem/p_done_b?share=legacy-revoked-slug`, { headers: { accept: 'text/html' } })).status
    ).toBe(404);
    expect((await fetch(`${url}/api/poems/p_abandoned`, { headers: { authorization: `Bearer ${sol}` } })).status).toBe(
      404
    );
  });

  it('plans without writing in --dry-run', async () => {
    const plan = await importer([fixture, '--dry-run'], {});
    expect(plan.code).toBe(0);
    expect(JSON.parse(plan.stdout)).toEqual({
      dryRun: true,
      plan: { games: 1, poems: 2, favorites: 1, shares: 1, skipped: { notCompleted: 2, incompletePoems: 0 } },
    });
  });
});
