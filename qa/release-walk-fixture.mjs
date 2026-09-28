import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeCommits,
  generateNotes,
  verifyRelease,
} from '../scripts/releases/semantic-release.mjs';

const source = fileURLToPath(new URL('../', import.meta.url));
const version = '0.27.1';
const tag = `v${version}`;
const fixtureBinary = String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
const evidence = {
  version: '0.27.1', release_tag: 'v0.27.1', previous_tag: 'v0.27.0',
  version_decision: { bump: 'patch' }
};
if (args[0] === 'run') {
  if (args.includes('--dry-run')) process.stdout.write(JSON.stringify(evidence));
  else {
    const target = option('--technical-changelog-file');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, '## Technical Changelog v0.27.1\n\n### Bug Fixes\n\n- fix(room): preserve submitted lines after reconnect\n');
  }
} else if (args[0] === 'synthesize') {
  if (process.env.RELEASE_WALK_MODE === 'ungrounded') {
    fs.writeFileSync(option('--quality-file'), 'ungrounded');
    fs.writeFileSync(option('--attempts-file'), JSON.stringify([{ model: 'google/gemini-3.7-flash', succeeded: true, quality: 'ungrounded', message: '' }]));
  } else {
    fs.writeFileSync(option('--attempts-file'), JSON.stringify([{ model: 'google/gemini-3.7-flash', succeeded: false, quality: 'failed', message: 'model google/gemini-3.7-flash failed: HTTP 403' }]));
  }
  process.exit(1);
} else process.exit(2);
`;

/** The existing guest-walk container is disposable; this repo is never a release target. */
export async function exerciseReleaseCandidate() {
  const parent = path.join(os.homedir(), '.cache/tmp');
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  const root = fs.mkdtempSync(path.join(parent, 'linejam-release-walk-'));
  const run = (binary, args, env = {}) => {
    const result = spawnSync(binary, args, {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  };
  const requireSuccess = (result, label) => {
    if (result.status !== 0) throw new Error(`Release walk failed at ${label}`);
    return result.stdout.trim();
  };
  const git = (...args) =>
    requireSuccess(run('git', args), 'isolated Git history');
  const packageManager = JSON.parse(
    fs.readFileSync(path.join(source, 'package.json'), 'utf8')
  ).packageManager;
  const script = path.join(source, 'node_modules/.bin/tsx');
  const command = [
    '--tsconfig',
    path.join(source, 'tsconfig.json'),
    path.join(source, 'scripts/releases/prepare.ts'),
    '--allow-synthesis',
  ];
  const candidate = () =>
    JSON.parse(
      fs.readFileSync(path.join(root, '.landmark/release.json'), 'utf8')
    );
  const content = path.join(root, 'content/releases');
  fs.mkdirSync(path.join(root, '.landmark/run'), { recursive: true });
  fs.mkdirSync(path.join(content, tag), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'linejam-release-walk',
      private: true,
      version: '0.27.0',
      packageManager,
      scripts: {
        'generate:releases': `${script} --tsconfig ${path.join(source, 'tsconfig.json')} ${path.join(source, 'scripts/generate-releases.ts')}`,
      },
    })
  );
  fs.writeFileSync(
    path.join(root, 'CHANGELOG.md'),
    '# Changelog\n\n# [0.27.0] (2026-09-01)\n\n### Features\n\n- feat(room): create a room\n'
  );
  git('init', '-q');
  git('add', 'package.json', 'CHANGELOG.md');
  const identity = [
    '-c',
    'user.name=Release Walk',
    '-c',
    'user.email=walk@example.test',
  ];
  git(...identity, 'commit', '-qm', 'feat(room): create a room');
  git('tag', 'v0.27.0');
  fs.writeFileSync(
    path.join(root, 'room.txt'),
    'keep submitted lines after reconnect\n'
  );
  git('add', 'room.txt');
  git(
    ...identity,
    'commit',
    '-qm',
    'fix(room): preserve submitted lines after reconnect'
  );
  const sourceSha = git('rev-parse', 'HEAD');
  fs.writeFileSync(
    path.join(root, '.landmark/run/decision.json'),
    JSON.stringify({
      evidence: {
        version,
        release_tag: tag,
        previous_tag: 'v0.27.0',
        version_decision: { bump: 'patch' },
      },
      templatesDirectory: path.join(root, 'templates'),
    })
  );
  const cli = path.join(root, 'landmark-fixture.cjs');
  fs.writeFileSync(cli, fixtureBinary, { mode: 0o700 });
  const stale = 'Earlier candidate notes must not survive.';
  fs.writeFileSync(path.join(content, tag, 'notes.md'), stale);
  fs.writeFileSync(
    path.join(content, tag, 'synthesis.json'),
    '{"quality":"valid"}'
  );
  fs.writeFileSync(
    path.join(content, 'landmark.json'),
    JSON.stringify([
      {
        version,
        tag,
        markdown: stale,
        notes: stale,
      },
    ])
  );
  fs.writeFileSync(
    path.join(root, '.landmark/release.json'),
    JSON.stringify({ version, sourceSha: 'a'.repeat(40), quality: 'valid' })
  );
  const current = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  fs.writeFileSync(
    path.join(root, 'CHANGELOG.md'),
    current.replace(
      '# Changelog\n',
      `# Changelog\n\n# [${version}] (2026-09-20)\n\n### Bug Fixes\n\n- fix(room): earlier candidate\n`
    )
  );
  const env = {
    LANDMARK_BIN: cli,
    OPENROUTER_API_KEY: ['walk', 'fixture', 'only'].join('-'),
    GITHUB_OUTPUT: path.join(root, 'workflow-output'),
  };
  requireSuccess(run(script, command, env), 'provider-failure preparation');
  const prepared = candidate();
  const manifest = JSON.parse(
    fs.readFileSync(path.join(content, 'manifest.json'), 'utf8')
  );
  const nativeEntries = JSON.parse(
    fs.readFileSync(path.join(content, 'landmark.json'), 'utf8')
  );
  const projections = ['site/changelog.html', 'docs/releases/feed.xml'].map(
    (file) => fs.readFileSync(path.join(root, file), 'utf8')
  );
  const firstOutput = fs.readFileSync(env.GITHUB_OUTPUT, 'utf8');
  const tags = git('tag', '--list', tag);
  const before = fs.readFileSync(
    path.join(root, '.landmark/release.json'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, '.landmark/run/decision.json'),
    '{"invalid":"decision"}'
  );
  const malformedRejected =
    run(script, command, env).status !== 0 &&
    fs.readFileSync(path.join(root, '.landmark/release.json'), 'utf8') ===
      before;
  fs.writeFileSync(
    path.join(root, '.landmark/run/decision.json'),
    JSON.stringify({
      evidence: {
        version,
        release_tag: tag,
        previous_tag: 'v0.27.0',
        version_decision: { bump: 'patch' },
      },
      templatesDirectory: path.join(root, 'templates'),
    })
  );
  const ungroundedRejected =
    run(script, command, { ...env, RELEASE_WALK_MODE: 'ungrounded' }).status !==
      0 &&
    fs.readFileSync(path.join(root, '.landmark/release.json'), 'utf8') ===
      before;
  // Regenerate the reviewed candidate after exercising the failure path.
  requireSuccess(run(script, command, env), 'restoring the review candidate');
  git(
    'add',
    'package.json',
    'CHANGELOG.md',
    '.landmark/release.json',
    'content/releases',
    'site/changelog.html',
    'docs/releases/feed.xml'
  );
  git(...identity, 'commit', '-qm', `chore(release): review ${tag}`);
  const context = {
    cwd: root,
    lastRelease: { gitTag: 'v0.27.0' },
    nextRelease: { version },
  };
  const oldBinary = process.env.LANDMARK_BIN;
  let releaseBody;
  try {
    process.env.LANDMARK_BIN = cli;
    if ((await analyzeCommits({}, context)) !== 'patch')
      throw new Error('Reviewed candidate rejected');
    await verifyRelease({}, context);
    releaseBody = await generateNotes({}, context);
  } finally {
    if (oldBinary === undefined) delete process.env.LANDMARK_BIN;
    else process.env.LANDMARK_BIN = oldBinary;
  }
  return {
    root,
    version,
    tag,
    sourceSha,
    prepared,
    manifest,
    nativeEntries,
    projections,
    firstOutput,
    tags,
    stale,
    malformedRejected,
    ungroundedRejected,
    releaseBody,
  };
}
