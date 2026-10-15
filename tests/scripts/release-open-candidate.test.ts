import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const script = path.join(projectRoot, 'scripts/releases/open-candidate.ts');
const tsx = path.join(projectRoot, 'node_modules/.bin/tsx');
const GENUINE = 'a'.repeat(40);
const FORK = 'f'.repeat(40);
const OLDER_SOURCE = 'b'.repeat(40);
const roots: string[] = [];

// The fixture replaces only the external `gh` executable. It serves the open
// PR list and the contents API from the environment, wraps base64 at 60
// columns like GitHub, and logs every ref whose contents were read.
const ghFixture = String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === 'pr' && args[1] === 'list') {
  process.stdout.write(process.env.GH_PULLS);
} else if (args[0] === 'api') {
  const ref = new URL(args[1], 'https://api.github.test/').searchParams.get('ref');
  fs.appendFileSync(process.env.GH_LOG, ref + '\n');
  const candidates = JSON.parse(process.env.GH_CANDIDATES);
  if (!(ref in candidates)) {
    process.stderr.write('gh: Not Found (HTTP 404)');
    process.exit(1);
  }
  const content = Buffer.from(JSON.stringify(candidates[ref]))
    .toString('base64')
    .replace(/.{60}/g, '$&\n');
  process.stdout.write(JSON.stringify({ content, encoding: 'base64' }));
} else process.exit(4);
`;

type Pull = { headRefOid: string; isCrossRepository: boolean };
type Candidate = ReturnType<typeof candidate>;

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'linejam-candidate-'));
  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Release Test',
      '-c',
      'user.email=test@example.test',
      'commit',
      '--allow-empty',
      '-qm',
      'feat(changelog): add a /changelog page',
    ],
    { cwd: root }
  );
  fs.mkdirSync(path.join(root, '.landmark/run'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.landmark/run/decision.json'),
    JSON.stringify({
      evidence: {
        version: '0.28.1',
        release_tag: 'v0.28.1',
        previous_tag: 'v0.28.0',
        version_decision: { bump: 'patch' },
      },
      templatesDirectory: '/landmark/templates',
    })
  );
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'gh'), ghFixture, { mode: 0o755 });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  return { root, head };
}

function candidate(sourceSha: string, changes: Record<string, string> = {}) {
  return {
    schemaVersion: 1,
    version: '0.28.1',
    tag: 'v0.28.1',
    previousTag: 'v0.28.0',
    sourceSha,
    preparedAt: '2026-10-15T00:00:00.000Z',
    quality: 'valid',
    ...changes,
  };
}

function keep(
  root: string,
  pulls: Pull[],
  candidates: Record<string, Candidate>
) {
  const output = path.join(root, 'github-output');
  const log = path.join(root, 'gh-contents.log');
  fs.writeFileSync(output, '');
  fs.writeFileSync(log, '');
  const result = spawnSync(tsx, [script], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${path.join(root, 'bin')}${path.delimiter}${process.env.PATH}`,
      GITHUB_REPOSITORY: 'misty-step/linejam',
      GITHUB_OUTPUT: output,
      GH_PULLS: JSON.stringify(pulls),
      GH_CANDIDATES: JSON.stringify(candidates),
      GH_LOG: log,
    },
  });
  return {
    status: result.status,
    stderr: result.stderr,
    output: fs.readFileSync(output, 'utf8'),
    readRefs: fs.readFileSync(log, 'utf8').split('\n').filter(Boolean),
  };
}

const genuine: Pull = { headRefOid: GENUINE, isCrossRepository: false };
const fork: Pull = { headRefOid: FORK, isCrossRepository: true };

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('release reruns keep the open candidate', () => {
  it.each(['valid', 'skipped'])(
    'keeps a same-repository candidate with %s notes for this exact source',
    (quality) => {
      const { root, head } = repo();
      const result = keep(root, [genuine], {
        [GENUINE]: candidate(head, { quality }),
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.output).toBe('current=true\n');
      expect(result.readRefs).toEqual([GENUINE]);
    }
  );

  it.each([
    ['provider-failed notes', { quality: 'unavailable' }],
    ['another version', { version: '0.29.0', tag: 'v0.29.0' }],
    ['another baseline', { previousTag: 'v0.27.0' }],
  ])('prepares again for a candidate with %s', (_, changes) => {
    const { root, head } = repo();
    const result = keep(root, [genuine], {
      [GENUINE]: candidate(head, changes),
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.output).toBe('');
  });

  it('prepares again after master moves past the candidate source', () => {
    const { root } = repo();
    const result = keep(root, [genuine], {
      [GENUINE]: candidate(OLDER_SOURCE),
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.output).toBe('');
  });

  it('ignores a fork PR that reuses the release branch name', () => {
    const { root, head } = repo();
    const result = keep(root, [fork], { [FORK]: candidate(head) });
    expect(result.status, result.stderr).toBe(0);
    expect(result.output).toBe('');
    expect(result.readRefs).toEqual([]);
  });

  it('reads only the same-repository PR when a fork PR is listed first', () => {
    const { root, head } = repo();
    const kept = keep(root, [fork, genuine], {
      [FORK]: candidate(head),
      [GENUINE]: candidate(head),
    });
    expect(kept.output).toBe('current=true\n');
    expect(kept.readRefs).toEqual([GENUINE]);

    const replaced = keep(root, [fork, genuine], {
      [FORK]: candidate(head),
      [GENUINE]: candidate(head, { quality: 'unavailable' }),
    });
    expect(replaced.status, replaced.stderr).toBe(0);
    expect(replaced.output).toBe('');
    expect(replaced.readRefs).toEqual([GENUINE]);
  });

  it('prepares when no release PR is open or its candidate is unreadable', () => {
    const { root, head } = repo();
    expect(keep(root, [], {}).output).toBe('');

    const unreadable = keep(root, [genuine], {});
    expect(unreadable.status, unreadable.stderr).toBe(0);
    expect(unreadable.output).toBe('');

    fs.rmSync(path.join(root, '.landmark/run/decision.json'));
    const undecided = keep(root, [genuine], { [GENUINE]: candidate(head) });
    expect(undecided.status, undecided.stderr).toBe(0);
    expect(undecided.output).toBe('');
  });
});
