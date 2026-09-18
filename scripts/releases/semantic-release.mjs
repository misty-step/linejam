import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// This is an adapter, not another version analyzer: Landmark supplies the bump.
// Preparation is a reviewed PR. Publication never writes a commit to master.
const releaseFiles =
  /^(?:package\.json|CHANGELOG\.md|\.landmark\/release\.json|content\/releases\/.+|site\/changelog\.html|docs\/releases\/feed\.xml)$/;
let prepared;

export const analyzeCommits = async (_config, context) => {
  const binary = process.env.LANDMARK_BIN;
  if (!binary)
    throw new Error(
      'LANDMARK_BIN is required; run through the pinned Landmark action.'
    );
  const evidence = JSON.parse(
    execFileSync(
      binary,
      [
        'run',
        '--provider',
        'local',
        '--repo-root',
        context.cwd,
        '--repository',
        'misty-step/linejam',
        '--dry-run',
      ],
      { cwd: context.cwd, encoding: 'utf8' }
    )
  );
  const runDirectory = path.join(context.cwd, '.landmark/run');
  fs.mkdirSync(runDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(runDirectory, 'decision.json'),
    JSON.stringify(
      {
        evidence,
        templatesDirectory:
          process.env.LANDMARK_TEMPLATES_DIR ||
          path.join(process.env.GITHUB_ACTION_PATH || '', 'templates/prompts'),
      },
      null,
      2
    )
  );
  const bump = evidence.version_decision?.bump;
  if (bump === 'none') return null;
  if (!['patch', 'minor', 'major'].includes(bump))
    throw new Error('Landmark returned an invalid version decision.');

  const candidatePath = path.join(context.cwd, '.landmark/release.json');
  if (!fs.existsSync(candidatePath)) return null;
  const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
  if (
    candidate.schemaVersion !== 1 ||
    !/^[a-f0-9]{40}$/.test(candidate.sourceSha || '')
  ) {
    throw new Error('Malformed prepared release. Regenerate the release PR.');
  }
  if (
    candidate.version !== evidence.version ||
    candidate.tag !== evidence.release_tag
  )
    return null;
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: context.cwd,
    encoding: 'utf8',
  }).trim();
  if (candidate.sourceSha === head) return null;
  execFileSync(
    'git',
    ['merge-base', '--is-ancestor', candidate.sourceSha, head],
    { cwd: context.cwd }
  );
  const changed = execFileSync(
    'git',
    ['diff', '--name-only', `${candidate.sourceSha}..${head}`],
    { cwd: context.cwd, encoding: 'utf8' }
  )
    .trim()
    .split('\n')
    .filter(Boolean);
  if (
    changed.length === 0 ||
    changed.some((filename) => !releaseFiles.test(filename))
  )
    return null;
  if (
    candidate.previousTag !== evidence.previous_tag ||
    candidate.previousTag !== context.lastRelease.gitTag
  ) {
    throw new Error(
      'Landmark and semantic-release disagree about the previous release. Reconcile tag history before publishing.'
    );
  }
  if (!['valid', 'skipped'].includes(candidate.quality))
    throw new Error('Prepared notes did not pass Landmark publication policy.');
  prepared = candidate;
  return bump;
};

export const verifyRelease = async (_config, context) => {
  if (!prepared || context.nextRelease.version !== prepared.version) {
    throw new Error(
      'The computed release does not match the reviewed Landmark candidate.'
    );
  }
};

export const generateNotes = async (_config, context) => {
  const directory = path.join(context.cwd, 'content/releases', prepared.tag);
  const notes =
    prepared.quality === 'valid'
      ? fs.readFileSync(path.join(directory, 'notes.md'), 'utf8').trim()
      : 'Landmark skipped public notes for this release.';
  const technical = fs
    .readFileSync(path.join(directory, 'technical.md'), 'utf8')
    .trim();
  return `${notes}\n\n<details>\n<summary>Technical history</summary>\n\n${technical}\n\n</details>`;
};

export const prepare = async (_config, context) => {
  // semantic-release prepare is before tag publication, but AFTER PR review in
  // this integration. A mismatch fails closed, not a direct bot push/skip-CI commit.
  execFileSync('pnpm', ['generate:releases', '--check'], {
    cwd: context.cwd,
    stdio: 'inherit',
  });
  const version = JSON.parse(
    fs.readFileSync(path.join(context.cwd, 'package.json'), 'utf8')
  ).version;
  if (version !== context.nextRelease.version)
    throw new Error('Package and release versions disagree.');
};
