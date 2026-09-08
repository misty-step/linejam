import Ajv from 'ajv/dist/2020';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { readJson } from '../../lib/releases/loader';
import { isReleaseVersion } from '../../lib/releases/parser';
import { generateReleases } from '../generate-releases';

const ajv = new Ajv();
const versionRecordSchema = {
  type: 'object',
  required: ['version'],
  properties: { version: { type: 'string' } },
};
const isVersionRecord = ajv.compile<{ version: string }>(versionRecordSchema);
const isVersionRecordList = ajv.compile<{ version: string }[]>({
  type: 'array',
  items: versionRecordSchema,
});
const isDecisionPlan = ajv.compile<{
  evidence: {
    version: string;
    release_tag: string;
    previous_tag: string;
    version_decision: { bump: string };
  };
  templatesDirectory: string;
}>({
  type: 'object',
  required: ['evidence', 'templatesDirectory'],
  properties: {
    templatesDirectory: { type: 'string' },
    evidence: {
      type: 'object',
      required: ['version', 'release_tag', 'previous_tag', 'version_decision'],
      properties: {
        version: { type: 'string' },
        release_tag: { type: 'string' },
        previous_tag: { type: 'string' },
        version_decision: {
          type: 'object',
          required: ['bump'],
          properties: { bump: { type: 'string' } },
        },
      },
    },
  },
});

// Only the release workflow calls this mutating, potentially paid step. Local
// preview uses `landmark run --provider local --dry-run` instead.
if (!process.argv.includes('--allow-synthesis')) {
  throw new Error(
    'Preparation requires explicit --allow-synthesis and release credentials. Use the documented dry-run for a free preview.'
  );
}
const binary = process.env.LANDMARK_BIN;
const key = process.env.OPENROUTER_API_KEY;
if (!binary)
  throw new Error('LANDMARK_BIN is required to prepare a release PR.');
const root = process.cwd();
const plan = readJson('.landmark/run/decision.json');
if (!isDecisionPlan(plan)) {
  throw new Error(
    'Landmark decision evidence is malformed; nothing was prepared.'
  );
}
const {
  version,
  release_tag: tag,
  previous_tag: previousTag,
  version_decision: decision,
} = plan.evidence;
if (decision.bump === 'none') {
  console.log('Landmark found no release-worthy changes.');
} else {
  if (!key)
    throw new Error(
      'OPENROUTER_API_KEY is required for Landmark synthesis. Repository or organization secret access must be configured; no fallback notes will be invented.'
    );
  if (
    !isReleaseVersion(version) ||
    tag !== `v${version}` ||
    !['patch', 'minor', 'major'].includes(decision.bump)
  ) {
    throw new Error('Invalid Landmark release decision.');
  }
  if (
    spawnSync('git', ['rev-parse', '--verify', `refs/tags/${tag}`], {
      stdio: 'ignore',
    }).status === 0
  ) {
    throw new Error(`Refusing to replace the already tagged release ${tag}.`);
  }
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const directory = `content/releases/${tag}`;
  const technicalPath = `${directory}/technical.md`;
  execFileSync(
    binary,
    [
      'run',
      '--provider',
      'local',
      '--repo-root',
      root,
      '--repository',
      'misty-step/linejam',
      '--release-tag',
      tag,
      '--previous-tag',
      previousTag,
      '--technical-changelog-file',
      technicalPath,
      '--output-file',
      '',
      '--output-text-file',
      '',
      '--output-html-file',
      '',
      '--output-json',
      '',
      '--rss-feed-file',
      '',
    ],
    { encoding: 'utf8' }
  );

  const preparedAt = new Date().toISOString();
  const technical = fs
    .readFileSync(technicalPath, 'utf8')
    .replace(/^## Technical Changelog[^\n]*\n+/, '')
    .trim();
  const compareUrl = `https://github.com/misty-step/linejam/compare/${previousTag}...${tag}`;
  const section = `# [${version}](${compareUrl}) (${preparedAt.slice(0, 10)})\n\n${technical}\n\n`;
  let changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
  const headings = [...changelog.matchAll(/^#{1,2}\s+\[([^\]]+)\].*$/gm)];
  const sameVersion = headings.find(
    (heading) => heading[1].replace(/^v/, '') === version
  );
  if (sameVersion) {
    const candidate = readJson('.landmark/release.json');
    if (
      !isVersionRecord(candidate) ||
      sameVersion !== headings[0] ||
      candidate.version !== version
    ) {
      throw new Error(
        `Refusing to rewrite historical changelog entry ${version}.`
      );
    }
    changelog =
      changelog.slice(0, sameVersion.index) +
      changelog.slice(headings[1]?.index ?? changelog.length);
  }
  const insertion = changelog.search(/^#{1,2}\s+\[/m);
  fs.writeFileSync(
    'CHANGELOG.md',
    insertion < 0
      ? `${changelog.trim()}\n\n${section}`
      : changelog.slice(0, insertion) + section + changelog.slice(insertion)
  );

  const qualityPath = '.landmark/run/quality.txt';
  const synthesis = spawnSync(
    binary,
    [
      'synthesize',
      '--repo-root',
      root,
      '--version',
      tag,
      '--api-key',
      key,
      '--api-url',
      'https://openrouter.ai/api/v1/chat/completions',
      '--changelog-file',
      'CHANGELOG.md',
      '--templates-dir',
      plan.templatesDirectory,
      '--quality-file',
      qualityPath,
      '--attempts-file',
      '.landmark/run/attempts.json',
      '--context-metadata-file',
      '.landmark/run/context.json',
      '--claim-map-file',
      '.landmark/run/claims.json',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
  );
  if (synthesis.status !== 0) {
    // execFileSync's thrown error includes argv, which contains the provider key.
    throw new Error(
      'Landmark synthesis failed; inspect its quality and attempt evidence. No release PR was published.'
    );
  }
  const notes = synthesis.stdout;
  const quality = fs.readFileSync(qualityPath, 'utf8').trim();
  if (!['valid', 'skipped'].includes(quality)) {
    throw new Error(
      `Landmark synthesis quality is ${quality}; no release PR will be published.`
    );
  }
  fs.writeFileSync(
    `${directory}/synthesis.json`,
    `${JSON.stringify({ quality }, null, 2)}\n`
  );
  if (quality === 'valid') {
    if (!notes.trim())
      throw new Error('Landmark returned empty notes for valid synthesis.');
    fs.writeFileSync('.landmark/run/notes.md', notes);
    execFileSync(
      binary,
      [
        'write-artifacts',
        '--notes-file',
        '.landmark/run/notes.md',
        '--version',
        tag,
        '--repository',
        'misty-step/linejam',
        '--audience',
        'end-user',
        '--output-file',
        'content/releases/{version}/notes.md',
        '--output-json',
        'content/releases/landmark.json',
      ],
      { stdio: 'inherit' }
    );
  } else {
    fs.rmSync(path.join(directory, 'notes.md'), { force: true });
    const jsonPath = 'content/releases/landmark.json';
    if (fs.existsSync(jsonPath)) {
      const entries = readJson(jsonPath);
      if (!isVersionRecordList(entries)) {
        throw new Error(`${jsonPath} is malformed; regenerate the release PR.`);
      }
      fs.writeFileSync(
        jsonPath,
        `${JSON.stringify(
          entries.filter((entry) => entry.version !== version),
          null,
          2
        )}\n`
      );
    }
  }
  const pkg = readJson('package.json');
  if (!isVersionRecord(pkg)) {
    throw new Error('package.json is missing a version to update.');
  }
  pkg.version = version;
  fs.writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  fs.writeFileSync(
    '.landmark/release.json',
    `${JSON.stringify({ schemaVersion: 1, version, tag, previousTag, sourceSha, preparedAt, quality }, null, 2)}\n`
  );
  generateReleases();
  if (process.env.GITHUB_OUTPUT)
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
  console.log(
    `Prepared ${tag} for review; no tag, GitHub Release, or master commit was published.`
  );
}
