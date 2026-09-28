import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  analyzeCommits,
  generateNotes,
  verifyRelease,
} from '../../scripts/releases/semantic-release.mjs';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const prepareScript = path.resolve(
  projectRoot,
  process.env.RELEASE_PREPARE_SCRIPT || 'scripts/releases/prepare.ts'
);
const tsx = path.join(projectRoot, 'node_modules/.bin/tsx');
const secret = 'private-provider-key-403-example';
const failureReason = (stderr: string) =>
  stderr.replaceAll(secret, '[redacted]').match(/^\w*Error:.*$/m)?.[0];
const notes =
  '## Improvements\n\n- Rooms keep their lines when players reconnect.\n';
const technical =
  '## Technical Changelog v1.0.1\n\n### Bug Fixes\n\n- fix(room): preserve lines on reconnect\n';
const roots: string[] = [];

// The fixture replaces only the external Landmark executable. prepare.ts,
// generation, Git history, and the publication adapter are the real owners.
const landmarkFixture = String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
const mode = process.env.FIXTURE_MODE;
const notes = ${JSON.stringify(notes)};
const technical = ${JSON.stringify(technical)};
const entry = (version, markdown) => ({
  schema_version: 'landmark.public-release-notes.v1',
  version, tag: 'v' + version, repository: 'misty-step/linejam',
  audience: 'end-user', notes: markdown, markdown,
  plaintext: 'Rooms keep their lines when players reconnect.',
  html: '<h2>Improvements</h2><p>Rooms keep their lines when players reconnect.</p>',
  slack: 'Rooms keep their lines when players reconnect.',
  sections: [{ title: 'Improvements', bullets: [{ text: 'Rooms keep their lines when players reconnect.', links: [] }] }],
  published_at: '2026-09-28T00:00:00Z'
});
if (args[0] === 'run') {
  if (mode === 'local-failure') process.exit(3);
  if (args.includes('--dry-run')) {
    process.stdout.write(JSON.stringify(JSON.parse(fs.readFileSync('.landmark/run/decision.json', 'utf8')).evidence));
  } else {
    const target = option('--technical-changelog-file');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, technical);
  }
} else if (args[0] === 'synthesize') {
  const quality = option('--quality-file');
  const attempts = option('--attempts-file');
  const model = 'google/gemini-3.7-flash';
  const failed = (message) => ({ model, succeeded: false, quality: 'failed', message, classification: {}, cost: {}, decision: {} });
  if (mode === 'provider-403' || mode === 'provider-timeout' || mode === 'mixed-failure') {
    const failure = mode === 'provider-timeout' ? 'curl: (28) Operation timed out' : 'HTTP 403';
    const values = [failed('model ' + model + ' failed: ' + failure)];
    if (mode === 'mixed-failure') values.push({ model, succeeded: true, quality: 'ungrounded', message: '' });
    fs.writeFileSync(attempts, JSON.stringify(values));
    // A real CLI should redact this, but the adapter must never echo provider stderr.
    process.stderr.write('provider body: ' + process.env.OPENROUTER_API_KEY);
    process.exit(1);
  }
  if (mode === 'invalid-curl' || mode === 'empty-response' || mode === 'malformed-response' || mode === 'bad-request' || mode === 'forbidden-model') {
    const message = mode === 'invalid-curl'
      ? 'model ' + model + ' failed: curl: (3) URL rejected: malformed input'
      : mode === 'empty-response'
        ? 'model ' + model + ' returned empty content'
        : mode === 'bad-request' || mode === 'forbidden-model'
          ? 'model ' + model + ' failed: HTTP ' + (mode === 'bad-request' ? '400' : '404')
          : 'model ' + model + ' failed: provider response did not include choices[0].message.content';
    fs.writeFileSync(attempts, JSON.stringify([failed(message)]));
    process.exit(1);
  }
  if (mode === 'ungrounded') {
    fs.writeFileSync(attempts, JSON.stringify([{ model, succeeded: true, quality: 'ungrounded', message: '' }]));
    fs.writeFileSync(quality, 'ungrounded');
    process.exit(1);
  }
  if (mode === 'non-provider') process.exit(2);
  if (mode === 'degraded') {
    fs.writeFileSync(quality, 'degraded');
    process.stdout.write(notes);
    process.exit(0);
  }
  fs.writeFileSync(quality, mode === 'skipped' ? 'skipped' : 'valid');
  if (mode !== 'skipped') process.stdout.write(notes);
} else if (args[0] === 'write-artifacts') {
  const version = option('--version').slice(1);
  const markdown = fs.readFileSync(option('--notes-file'), 'utf8');
  const notesPath = option('--output-file').replace('{version}', 'v' + version);
  fs.mkdirSync(path.dirname(notesPath), { recursive: true });
  fs.writeFileSync(notesPath, markdown);
  const index = option('--output-json');
  const entries = fs.existsSync(index) ? JSON.parse(fs.readFileSync(index, 'utf8')) : [];
  fs.writeFileSync(index, JSON.stringify([entry(version, markdown), ...entries.filter((item) => item.version !== version)]));
} else process.exit(4);
`;

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function record(version: string, markdown = notes) {
  return {
    schema_version: 'landmark.public-release-notes.v1',
    version,
    tag: `v${version}`,
    repository: 'misty-step/linejam',
    audience: 'end-user',
    notes: markdown,
    markdown,
    plaintext: 'Rooms keep their lines when players reconnect.',
    html: '<h2>Improvements</h2><p>Rooms keep their lines when players reconnect.</p>',
    slack: 'Rooms keep their lines when players reconnect.',
    sections: [
      {
        title: 'Improvements',
        bullets: [
          { text: 'Rooms keep their lines when players reconnect.', links: [] },
        ],
      },
    ],
    published_at: '2026-09-28T00:00:00Z',
  };
}

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'linejam-prepare-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, '.landmark/run'), { recursive: true });
  fs.mkdirSync(path.join(root, 'content/releases'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{"version":"1.0.0"}\n');
  fs.writeFileSync(
    path.join(root, 'CHANGELOG.md'),
    '# Changelog\n\n# [1.0.0] (2026-09-01)\n\n### Features\n\n- feat(room): add rooms\n'
  );
  git(root, 'init', '-q');
  git(root, 'add', 'package.json', 'CHANGELOG.md');
  git(
    root,
    '-c',
    'user.name=Release Test',
    '-c',
    'user.email=test@example.test',
    'commit',
    '-qm',
    'feat: initial rooms'
  );
  git(root, 'tag', 'v1.0.0');
  fs.writeFileSync(
    path.join(root, 'source.txt'),
    'protect player lines on reconnect\n'
  );
  git(root, 'add', 'source.txt');
  git(
    root,
    '-c',
    'user.name=Release Test',
    '-c',
    'user.email=test@example.test',
    'commit',
    '-qm',
    'fix: reconnect'
  );
  const head = git(root, 'rev-parse', 'HEAD');
  fs.writeFileSync(
    path.join(root, '.landmark/run/decision.json'),
    JSON.stringify({
      evidence: {
        version: '1.0.1',
        release_tag: 'v1.0.1',
        previous_tag: 'v1.0.0',
        version_decision: { bump: 'patch' },
      },
      templatesDirectory: '/landmark/templates/prompts',
    })
  );
  const cli = path.join(root, 'landmark-fixture.cjs');
  fs.writeFileSync(cli, landmarkFixture, { mode: 0o755 });
  return { root, head, cli };
}

function prepare(root: string, cli: string, mode: string, key = secret) {
  return spawnSync(
    tsx,
    [
      '--tsconfig',
      path.join(projectRoot, 'tsconfig.json'),
      prepareScript,
      '--allow-synthesis',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        LANDMARK_BIN: cli,
        OPENROUTER_API_KEY: key,
        FIXTURE_MODE: mode,
        GITHUB_OUTPUT: path.join(root, 'github-output'),
      },
    }
  );
}

function candidate(root: string) {
  return JSON.parse(
    fs.readFileSync(path.join(root, '.landmark/release.json'), 'utf8')
  );
}

function priorNotes(root: string) {
  const current = path.join(root, 'content/releases/v1.0.1');
  fs.mkdirSync(current, { recursive: true });
  fs.writeFileSync(path.join(current, 'notes.md'), notes);
  fs.writeFileSync(path.join(current, 'synthesis.json'), '{"quality":"valid"}');
  fs.writeFileSync(
    path.join(root, 'content/releases/landmark.json'),
    JSON.stringify([record('1.0.1'), record('1.0.0')])
  );
  fs.mkdirSync(path.join(root, 'content/releases/v1.0.0'), {
    recursive: true,
  });
  fs.writeFileSync(path.join(root, 'content/releases/v1.0.0/notes.md'), notes);
  fs.writeFileSync(
    path.join(root, 'CHANGELOG.md'),
    '# Changelog\n\n# [1.0.1] (2026-09-20)\n\n### Bug Fixes\n\n- fix(room): older candidate\n\n# [1.0.0] (2026-09-01)\n\n### Features\n\n- feat(room): add rooms\n'
  );
  fs.writeFileSync(
    path.join(root, '.landmark/release.json'),
    JSON.stringify({
      schemaVersion: 1,
      version: '1.0.1',
      tag: 'v1.0.1',
      previousTag: 'v1.0.0',
      sourceSha: 'a'.repeat(40),
      quality: 'valid',
    })
  );
}

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

describe('US-004 release preparation', () => {
  it('prepares a reviewable technical-only candidate after provider 403, replacing stale notes without leaking secrets', () => {
    const { root, head, cli } = repo();
    priorNotes(root);
    fs.writeFileSync(path.join(root, '.landmark/run/quality.txt'), 'valid');
    fs.writeFileSync(path.join(root, '.landmark/run/notes.md'), notes);
    const result = prepare(root, cli, 'provider-403');
    expect(result.status, failureReason(result.stderr)).toBe(0);
    expect((result.stdout + result.stderr).includes(secret)).toBe(false);
    expect((result.stdout + result.stderr).includes('provider body:')).toBe(
      false
    );
    expect(candidate(root)).toMatchObject({
      version: '1.0.1',
      tag: 'v1.0.1',
      previousTag: 'v1.0.0',
      quality: 'unavailable',
      sourceSha: head,
    });
    expect(
      fs.existsSync(path.join(root, 'content/releases/v1.0.1/notes.md'))
    ).toBe(false);
    expect(fs.existsSync(path.join(root, '.landmark/run/notes.md'))).toBe(
      false
    );
    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(root, 'content/releases/landmark.json'),
          'utf8'
        )
      ).map((entry: { version: string }) => entry.version)
    ).toEqual(['1.0.0']);
    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(root, 'content/releases/v1.0.1/synthesis.json'),
          'utf8'
        )
      )
    ).toEqual({ quality: 'unavailable' });
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'content/releases/manifest.json'), 'utf8')
    );
    expect(manifest.versions[0]).toBe('1.0.1');
    expect(manifest.notes['1.0.1']).toBe('unavailable');
    expect(
      fs.readFileSync(
        path.join(root, 'content/releases/v1.0.1/changelog.json'),
        'utf8'
      )
    ).toContain('preserve lines on reconnect');
    const workflowOutput = fs.readFileSync(
      path.join(root, 'github-output'),
      'utf8'
    );
    expect(workflowOutput).toContain('notes_status=unavailable\n');
    expect(workflowOutput.includes(secret)).toBe(false);
  });

  it.each([
    ['valid', 'valid', true],
    ['skipped', 'skipped', false],
  ] as const)('preserves %s synthesis semantics', (mode, quality, hasNotes) => {
    const { root, head, cli } = repo();
    const result = prepare(root, cli, mode);
    expect(result.status, failureReason(result.stderr)).toBe(0);
    expect(candidate(root)).toMatchObject({ quality, sourceSha: head });
    expect(
      fs.existsSync(path.join(root, 'content/releases/v1.0.1/notes.md'))
    ).toBe(hasNotes);
    expect(fs.readFileSync(path.join(root, 'github-output'), 'utf8')).toContain(
      `notes_status=${quality}\n`
    );
  });

  it.each([
    'ungrounded',
    'degraded',
    'mixed-failure',
    'empty-response',
    'malformed-response',
    'invalid-curl',
    'bad-request',
    'forbidden-model',
  ])(
    'fails closed for %s rather than calling it provider unavailability',
    (mode) => {
      const { root, cli } = repo();
      const result = prepare(root, cli, mode);
      expect(result.status).not.toBe(0);
      expect(fs.existsSync(path.join(root, '.landmark/release.json'))).toBe(
        false
      );
      expect(fs.existsSync(path.join(root, 'github-output'))).toBe(false);
    }
  );

  it('rejects stale provider attempts when this invocation failed before a provider call', () => {
    const { root, cli } = repo();
    fs.writeFileSync(
      path.join(root, '.landmark/run/attempts.json'),
      JSON.stringify([
        {
          model: 'google/gemini-3.7-flash',
          succeeded: false,
          quality: 'failed',
          message: 'model google/gemini-3.7-flash failed: HTTP 403',
        },
      ])
    );
    expect(prepare(root, cli, 'non-provider').status).not.toBe(0);
    expect(fs.existsSync(path.join(root, '.landmark/release.json'))).toBe(
      false
    );
  });

  it('rejects a missing provider key, malformed decision, and local CLI failure', () => {
    const missingKey = repo();
    expect(
      prepare(missingKey.root, missingKey.cli, 'provider-403', '').status
    ).not.toBe(0);
    expect(
      fs.existsSync(path.join(missingKey.root, '.landmark/release.json'))
    ).toBe(false);

    const invalidDecision = repo();
    const decisionPath = path.join(
      invalidDecision.root,
      '.landmark/run/decision.json'
    );
    const plan = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
    plan.evidence.version_decision.bump = 'guess';
    fs.writeFileSync(decisionPath, JSON.stringify(plan));
    expect(
      prepare(invalidDecision.root, invalidDecision.cli, 'provider-403').status
    ).not.toBe(0);
    expect(
      fs.existsSync(path.join(invalidDecision.root, '.landmark/release.json'))
    ).toBe(false);

    const localFailure = repo();
    expect(
      prepare(localFailure.root, localFailure.cli, 'local-failure').status
    ).not.toBe(0);
    expect(
      fs.existsSync(path.join(localFailure.root, '.landmark/release.json'))
    ).toBe(false);
  });

  it('rejects a malformed Landmark index instead of discarding its integrity error', () => {
    const { root, cli } = repo();
    fs.writeFileSync(
      path.join(root, 'content/releases/landmark.json'),
      JSON.stringify({ version: '1.0.1', notes: 'not a release index' })
    );
    const result = prepare(root, cli, 'provider-403');
    expect(result.status).not.toBe(0);
    expect(fs.existsSync(path.join(root, '.landmark/release.json'))).toBe(
      false
    );
    expect(fs.existsSync(path.join(root, 'github-output'))).toBe(false);
  });

  it('publishes reviewed unavailable technical history, but rejects unrelated source changes and bad quality', async () => {
    const { root, cli } = repo();
    const result = prepare(root, cli, 'provider-timeout');
    expect(result.status, failureReason(result.stderr)).toBe(0);
    git(
      root,
      'add',
      'package.json',
      'CHANGELOG.md',
      '.landmark/release.json',
      'content/releases',
      'site/changelog.html',
      'docs/releases/feed.xml'
    );
    git(
      root,
      '-c',
      'user.name=Release Test',
      '-c',
      'user.email=test@example.test',
      'commit',
      '-qm',
      'chore(release): review v1.0.1'
    );
    const context = {
      cwd: root,
      lastRelease: { gitTag: 'v1.0.0' },
      nextRelease: { version: '1.0.1' },
    };
    const previous = process.env.LANDMARK_BIN;
    process.env.LANDMARK_BIN = cli;
    try {
      expect(await analyzeCommits({}, context)).toBe('patch');
      await expect(verifyRelease({}, context)).resolves.toBeUndefined();
      const body = await generateNotes({}, context);
      expect(body).toContain('preserve lines on reconnect');
      expect(body).not.toContain('skipped');
      const data = candidate(root);
      data.quality = 'ungrounded';
      fs.writeFileSync(
        path.join(root, '.landmark/release.json'),
        JSON.stringify(data)
      );
      git(root, 'add', '.landmark/release.json');
      git(
        root,
        '-c',
        'user.name=Release Test',
        '-c',
        'user.email=test@example.test',
        'commit',
        '-qm',
        'chore(release): invalid quality'
      );
      await expect(analyzeCommits({}, context)).rejects.toThrow(
        'publication policy'
      );
      fs.writeFileSync(
        path.join(root, 'source.txt'),
        'unreviewed source edit\n'
      );
      git(root, 'add', 'source.txt');
      git(
        root,
        '-c',
        'user.name=Release Test',
        '-c',
        'user.email=test@example.test',
        'commit',
        '-qm',
        'fix: unexpected source'
      );
      expect(await analyzeCommits({}, context)).toBeNull();
    } finally {
      if (previous === undefined) delete process.env.LANDMARK_BIN;
      else process.env.LANDMARK_BIN = previous;
    }
  });
});
