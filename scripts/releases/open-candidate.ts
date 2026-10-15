import Ajv from 'ajv/dist/2020';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

// A Release rerun for the same green source keeps the open release PR instead
// of paying for synthesis again and rewriting it. Only a PR from this
// repository counts: a fork can reuse the `landmark/release` branch name, and
// the contents API resolves fork commits. When in doubt this prints nothing,
// and preparation runs as usual.

type Plan = {
  evidence: { version: string; release_tag: string; previous_tag: string };
};
type PullRequest = { headRefOid: string; isCrossRepository: boolean };
type Candidate = {
  version: string;
  tag: string;
  previousTag: string;
  sourceSha: string;
  quality: string;
};

const KEPT_QUALITIES = new Set(['valid', 'skipped']);

const ajv = new Ajv();
const isPlan = ajv.compile<Plan>({
  type: 'object',
  required: ['evidence'],
  properties: {
    evidence: {
      type: 'object',
      required: ['version', 'release_tag', 'previous_tag'],
      properties: {
        version: { type: 'string' },
        release_tag: { type: 'string' },
        previous_tag: { type: 'string' },
      },
    },
  },
});
const isPullRequestList = ajv.compile<PullRequest[]>({
  type: 'array',
  items: {
    type: 'object',
    required: ['headRefOid', 'isCrossRepository'],
    properties: {
      headRefOid: { type: 'string', pattern: '^[0-9a-f]{40}$' },
      isCrossRepository: { type: 'boolean' },
    },
  },
});
const isContents = ajv.compile<{ content: string }>({
  type: 'object',
  required: ['content'],
  properties: { content: { type: 'string' } },
});
const isCandidate = ajv.compile<Candidate>({
  type: 'object',
  required: ['version', 'tag', 'previousTag', 'sourceSha', 'quality'],
  properties: {
    version: { type: 'string' },
    tag: { type: 'string' },
    previousTag: { type: 'string' },
    sourceSha: { type: 'string' },
    quality: { type: 'string' },
  },
});

const repository = process.env.GITHUB_REPOSITORY;
const output = process.env.GITHUB_OUTPUT;
if (!repository || !output) {
  throw new Error('GITHUB_REPOSITORY and GITHUB_OUTPUT are required.');
}

function gh(args: string[]): string {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// A missing or malformed decision is prepare.ts's error to report.
function readPlan(): Plan | undefined {
  try {
    const plan: unknown = JSON.parse(
      fs.readFileSync('.landmark/run/decision.json', 'utf8')
    );
    return isPlan(plan) ? plan : undefined;
  } catch {
    return undefined;
  }
}

function openReleaseHead(repository: string): string | undefined {
  const pulls: unknown = JSON.parse(
    gh([
      'pr',
      'list',
      '--repo',
      repository,
      '--head',
      'landmark/release',
      '--base',
      'master',
      '--state',
      'open',
      '--json',
      'headRefOid,isCrossRepository',
    ])
  );
  return isPullRequestList(pulls)
    ? pulls.find((pull) => !pull.isCrossRepository)?.headRefOid
    : undefined;
}

// A head without a readable candidate is not current; prepare it again.
function readCandidate(
  repository: string,
  head: string
): Candidate | undefined {
  try {
    const contents: unknown = JSON.parse(
      gh([
        'api',
        `repos/${repository}/contents/.landmark/release.json?ref=${head}`,
      ])
    );
    if (!isContents(contents)) return undefined;
    const candidate: unknown = JSON.parse(
      Buffer.from(contents.content, 'base64').toString('utf8')
    );
    return isCandidate(candidate) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

const plan = readPlan();
const head = plan && openReleaseHead(repository);
const candidate = head && readCandidate(repository, head);
if (plan && candidate) {
  const source = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const {
    version,
    release_tag: tag,
    previous_tag: previousTag,
  } = plan.evidence;
  if (
    candidate.sourceSha === source &&
    candidate.version === version &&
    candidate.tag === tag &&
    candidate.previousTag === previousTag &&
    KEPT_QUALITIES.has(candidate.quality)
  ) {
    console.log(
      `::notice::Release PR head ${head} already holds the candidate for this source.`
    );
    fs.appendFileSync(output, 'current=true\n');
  }
}
