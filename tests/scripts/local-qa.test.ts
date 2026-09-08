/** @vitest-environment node */
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const workspaces: string[] = [];
const privateValue = 'fixture-browser-bearer-value-not-for-logs';

interface LocalQaFixture {
  workspace: string;
  bin: string;
  source: string;
  artifacts: string;
  boundary: string;
}

function fixture(): LocalQaFixture {
  const workspace = mkdtempSync(join(tmpdir(), 'linejam-local-qa-'));
  workspaces.push(workspace);
  const bin = join(workspace, 'bin');
  const source = join(workspace, 'playwright-output');
  const artifacts = join(workspace, 'artifacts/qa');
  mkdirSync(bin);
  mkdirSync(join(source, 'evidence/raw-video'), { recursive: true });
  for (const relative of [
    'local/container.mjs',
    'local/identity.mjs',
    'evidence/guest-flow-artifacts.mjs',
    'evidence/verdict.mjs',
  ]) {
    const destination = join(workspace, 'scripts', relative);
    mkdirSync(join(destination, '..'), { recursive: true });
    copyFileSync(resolve('scripts', relative), destination);
  }
  writeFileSync(
    join(source, 'results.json'),
    JSON.stringify({
      stats: { expected: 3, skipped: 0, unexpected: 0, flaky: 0 },
      errors: [],
    })
  );
  writeFileSync(
    join(source, 'evidence/result.json'),
    JSON.stringify({
      baseUrl: 'http://127.0.0.1:3333',
      checks: ['Nine human-authored rounds and reveal completed.'],
      flowError: null,
      rawVideoPath: '/artifacts/qa/evidence/raw-video/host.webm',
      roomCode: 'ABCD',
      runtimeErrors: [],
      screenshots: ['reveal.png'],
    })
  );
  writeFileSync(
    join(source, 'evidence/reveal.png'),
    'recorded screenshot bytes'
  );
  writeFileSync(
    join(source, 'evidence/raw-video/host.webm'),
    'recorded video bytes'
  );
  const pnpm = join(bin, 'pnpm');
  writeFileSync(
    pnpm,
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (JSON.stringify(args) !== JSON.stringify([
  'exec', 'playwright', 'test', '--config=scripts/local/playwright.config.ts'
])) throw new Error('Unexpected pnpm fixture operation');
fs.cpSync(${JSON.stringify(source)}, ${JSON.stringify(artifacts)}, { recursive: true });
console.log(${JSON.stringify(privateValue)});
const exitCode = ${JSON.stringify(join(source, 'exit-code'))};
if (fs.existsSync(exitCode)) process.exitCode = Number(fs.readFileSync(exitCode, 'utf8'));
`
  );
  chmodSync(pnpm, 0o755);
  const boundary = join(workspace, 'container-boundary.mjs');
  writeFileSync(
    boundary,
    `import fs from 'node:fs/promises';
import net from 'node:net';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
// Only the container's filesystem mount and network boundaries are replaced.
// The actual subprocess runner, report parsing, artifact checks and verdict run.
const remap = (file) => {
  if (typeof file !== 'string') return file;
  if (file === '/artifacts' || file.startsWith('/artifacts/')) {
    return ${JSON.stringify(workspace)} + file;
  }
  if (file === '/tmp/linejam-home') return ${JSON.stringify(join(workspace, 'home'))};
  return file;
};
for (const name of ['mkdir', 'readFile', 'rm', 'stat', 'writeFile']) {
  const original = fs[name];
  fs[name] = (file, ...args) => original(remap(file), ...args);
}
net.createServer = () => {
  const server = new EventEmitter();
  server.listen = (_address, ready) => { queueMicrotask(ready); return server; };
  server.close = (closed) => { queueMicrotask(closed); return server; };
  return server;
};
net.connect = () => { throw new Error('Unexpected fixture transport connection'); };
globalThis.fetch = async (url) => {
  if (url !== 'http://127.0.0.1:3333/api/health') {
    throw new Error('Unexpected fixture health request');
  }
  return new Response(JSON.stringify({ status: 'ok' }));
};
syncBuiltinESMExports();
`
  );
  return { workspace, bin, source, artifacts, boundary };
}

function evidence(
  setup: LocalQaFixture,
  fields: { runtimeErrors?: string[] | null; flowError?: string | null }
) {
  const file = join(setup.source, 'evidence/result.json');
  writeFileSync(
    file,
    JSON.stringify({
      ...JSON.parse(readFileSync(file, 'utf8')),
      ...fields,
    })
  );
}

function run(setup: LocalQaFixture) {
  return spawnSync(
    process.execPath,
    ['--import', setup.boundary, 'scripts/local/container.mjs', 'qa'],
    {
      cwd: setup.workspace,
      env: {
        NODE_ENV: 'test',
        PATH: `${setup.bin}:${process.env.PATH ?? ''}`,
        HOME: setup.workspace,
        LINEJAM_LOCAL: '1',
        NEXT_PUBLIC_LINEJAM_LOCAL: '1',
        LINEJAM_DEPLOY_ENVIRONMENT: 'development',
        E2E_BASE_URL: 'http://127.0.0.1:3333',
        NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3210',
        LINEJAM_LOCAL_SITE_PORT: '3211',
        LINEJAM_EVIDENCE_DIR: '/artifacts/qa/evidence',
        LINEJAM_EVIDENCE_RESULT_FILE: '/artifacts/qa/evidence/result.json',
      },
      encoding: 'utf8',
      timeout: 10_000,
    }
  );
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe('local QA evidence acceptance', () => {
  it('accepts complete clean raw evidence without requiring packaged GIFs or logs', () => {
    const setup = fixture();
    const result = run(setup);
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).not.toContain(privateValue);
    const log = join(setup.artifacts, 'playwright.log');
    expect(readFileSync(log, 'utf8')).toContain(privateValue);
    expect(statSync(log).mode & 0o777).toBe(0o600);
    expect(
      JSON.parse(readFileSync(join(setup.artifacts, 'verdict.json'), 'utf8'))
    ).toMatchObject({
      result: 'PASS',
      evidence: { resultValid: true, screenshotsValid: true, videoValid: true },
    });
  });

  it('rejects green Playwright stats with recorded runtime errors without exposing them', () => {
    const setup = fixture();
    evidence(setup, {
      runtimeErrors: [`[console] request failed: ${privateValue}`],
    });
    const result = run(setup);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(privateValue);
    const publicResult = JSON.parse(
      readFileSync(join(setup.artifacts, 'verdict.json'), 'utf8')
    );
    expect(publicResult).toMatchObject({
      result: 'FAIL',
      evidence: {
        runtimeErrors: 1,
        artifactErrors: 0,
        screenshotsValid: true,
        videoValid: true,
      },
    });
    expect(Object.keys(publicResult).sort()).toEqual([
      'evidence',
      'playwright',
      'result',
    ]);
    for (const value of Object.values(publicResult.playwright)) {
      if (value !== null) {
        expect(Number.isSafeInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
    for (const value of Object.values(publicResult.evidence)) {
      if (value !== null && value !== true && value !== false) {
        expect(Number.isSafeInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('rejects recorded video errors even when a nonempty recording exists', () => {
    const setup = fixture();
    evidence(setup, {
      runtimeErrors: ['[artifact] host video finalization failed'],
    });
    expect(run(setup).status).toBe(1);
  });

  it('rejects recorded flow failure even when Playwright and artifacts are green', () => {
    const setup = fixture();
    evidence(setup, { flowError: 'Guest context did not finish closing' });
    expect(run(setup).status).toBe(1);
  });

  it('preserves a failing Playwright exit despite clean reports and recordings', () => {
    const setup = fixture();
    writeFileSync(join(setup.source, 'exit-code'), '1');
    expect(run(setup).status).toBe(1);
    expect(
      JSON.parse(readFileSync(join(setup.artifacts, 'verdict.json'), 'utf8'))
    ).toMatchObject({
      result: 'FAIL',
      evidence: { resultValid: true, screenshotsValid: true, videoValid: true },
    });
  });

  it('rejects an empty screenshot rather than accepting its existing path', () => {
    const setup = fixture();
    writeFileSync(join(setup.source, 'evidence/reveal.png'), '');
    expect(run(setup).status).toBe(1);
  });

  it('rejects a missing recorded video rather than trusting the result path', () => {
    const setup = fixture();
    rmSync(join(setup.source, 'evidence/raw-video/host.webm'));
    expect(run(setup).status).toBe(1);
  });

  it('does not reuse an earlier successful evidence result when this run omits it', () => {
    const setup = fixture();
    cpSync(setup.source, setup.artifacts, { recursive: true });
    rmSync(join(setup.source, 'evidence/result.json'));
    expect(run(setup).status).toBe(1);
  });

  it('refuses malformed evidence without echoing credential-bearing JSON parser errors', () => {
    const setup = fixture();
    writeFileSync(join(setup.source, 'evidence/result.json'), privateValue);
    const result = run(setup);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(privateValue);
    expect(
      JSON.parse(readFileSync(join(setup.artifacts, 'verdict.json'), 'utf8'))
    ).toMatchObject({ result: 'FAIL', evidence: { resultValid: false } });
  });

  it('does not normalize a missing runtime-error report into clean evidence', () => {
    const setup = fixture();
    evidence(setup, { runtimeErrors: null });
    expect(run(setup).status).toBe(1);
  });
});
