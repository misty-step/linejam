#!/usr/bin/env node

import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCHEMA_PATH = resolve(
  REPO_ROOT,
  '.agents/skills/play-linejam/result.schema.json'
);
const ARTIFACT_EXTENSIONS = Object.freeze({
  screenshot: new Set(['png', 'webp']),
  video: new Set(['webm']),
  trace: new Set(['zip']),
  log: new Set(['log']),
});

function fail(message) {
  throw new Error(`play-linejam result rejected: ${message}`);
}

function requireUnique(values, field) {
  if (new Set(values).size !== values.length) {
    fail(`${field} must be unique`);
  }
}

function validateTarget(target) {
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    fail('target must be an absolute URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    fail('target must use http or https');
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== '/'
  ) {
    fail('target must be an origin without credentials, path, query, or hash');
  }
  if (target !== parsed.origin) {
    fail('target must use its canonical origin form');
  }
}

function validateArtifactPaths(result) {
  const expectedRunDir = `.qa/runs/${result.runId}`;
  if (result.evidence.runDir !== expectedRunDir) {
    fail(`evidence.runDir must equal ${expectedRunDir}`);
  }

  const paths = [];
  for (const artifact of result.evidence.artifacts) {
    const expectedPrefix = `${expectedRunDir}/`;
    const relativePath = artifact.path.slice(expectedPrefix.length);
    const match = /^artifact-[0-9]{4}\.([a-z]+)$/.exec(relativePath);
    if (
      !artifact.path.startsWith(expectedPrefix) ||
      match === null ||
      !ARTIFACT_EXTENSIONS[artifact.kind]?.has(match[1])
    ) {
      fail(
        `artifact path must use an opaque run-local name and match kind ${artifact.kind}`
      );
    }
    paths.push(artifact.path);
  }
  requireUnique(paths, 'evidence.artifacts[].path');
}

async function validateArtifactFiles(result) {
  if (result.evidence.artifacts.length === 0) return;

  const runsPath = resolve(REPO_ROOT, '.qa', 'runs');
  const runPath = resolve(REPO_ROOT, result.evidence.runDir);
  let runsStat;
  let runStat;
  try {
    [runsStat, runStat] = await Promise.all([lstat(runsPath), lstat(runPath)]);
  } catch {
    fail('artifact run directory is missing');
  }
  if (!runsStat.isDirectory() || !runStat.isDirectory()) {
    fail('artifact run directory must be a regular directory');
  }

  const [canonicalRepo, canonicalRuns, canonicalRun] = await Promise.all([
    realpath(REPO_ROOT),
    realpath(runsPath),
    realpath(runPath),
  ]);
  if (
    canonicalRuns !== resolve(canonicalRepo, '.qa', 'runs') ||
    dirname(canonicalRun) !== canonicalRuns
  ) {
    fail('artifact run directory must be inside the repository QA runs root');
  }

  for (const artifact of result.evidence.artifacts) {
    const artifactPath = resolve(REPO_ROOT, artifact.path);
    let artifactStat;
    let canonicalArtifact;
    try {
      [artifactStat, canonicalArtifact] = await Promise.all([
        lstat(artifactPath),
        realpath(artifactPath),
      ]);
    } catch {
      fail(`artifact file is missing: ${artifact.path}`);
    }
    if (
      !artifactStat.isFile() ||
      artifactStat.size === 0 ||
      dirname(canonicalArtifact) !== canonicalRun
    ) {
      fail(
        `artifact must be a non-empty regular run-local file: ${artifact.path}`
      );
    }
  }
}

function validateSessions(result) {
  const expectedPrefix = `${result.runId}-`;
  const sortedSeats = result.players
    .map((player) => player.seat)
    .sort((left, right) => left - right);
  if (sortedSeats.some((seat, index) => seat !== index)) {
    fail('player seats must be contiguous from zero');
  }

  const playerSessions = result.players.map((player) => player.sessionName);
  requireUnique(playerSessions, 'players[].sessionName');
  for (const player of result.players) {
    const expectedSession =
      player.role === 'host'
        ? `${result.runId}-host`
        : `${result.runId}-player-${player.seat}`;
    if (player.sessionName !== expectedSession) {
      fail(`player sessionName must equal ${expectedSession}`);
    }
  }

  const verifier = result.verification.verifierSessionName;
  if (verifier !== null && verifier !== `${result.runId}-verifier`) {
    fail('verification.verifierSessionName must belong to the run');
  }

  const cleaned = result.verification.sessionsCleanedUp ?? [];
  requireUnique(cleaned, 'verification.sessionsCleanedUp');
  for (const sessionName of cleaned) {
    if (!sessionName.startsWith(expectedPrefix)) {
      fail('every cleaned session must belong to the run');
    }
  }

  if (result.verification.allSessionsCleanedUp) {
    const expected =
      verifier === null ? playerSessions : [...playerSessions, verifier];
    for (const sessionName of expected) {
      if (!cleaned.includes(sessionName)) {
        fail(`cleaned sessions must include ${sessionName}`);
      }
    }
  }
}

function validatePassedResult(result) {
  if (result.status !== 'passed') return;

  if (result.verification.verifierSessionName === null) {
    fail('passed run requires a fresh verifier session');
  }
  if (result.roundsCompleted !== 9) fail('passed run must complete 9 rounds');
  if (result.players.some((player) => player.roundsSubmitted !== 9)) {
    fail('passed run requires 9 submissions from every player');
  }
  if (result.players.some((player) => !player.revealedPoem)) {
    fail('passed run requires every player to complete reveal');
  }
  if (result.players.some((player) => player.status !== 'passed')) {
    fail('passed run requires every player status to be passed');
  }
  if (
    !result.verification.roomClosed ||
    !result.verification.closedRoomJoinRejected ||
    !result.verification.allSessionsCleanedUp
  ) {
    fail('passed run requires closure, join rejection, and session cleanup');
  }
  if ((result.runtimeErrors?.length ?? 0) !== 0 || result.error !== null) {
    fail('passed run cannot contain runtime or aggregate errors');
  }
}

export function validatePlayLinejamResult(result, schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(result)) {
    const details = validate.errors
      ?.map((error) => `${error.instancePath || '/'} ${error.message}`)
      .join('; ');
    fail(details || 'schema validation failed');
  }

  validateTarget(result.target);
  if (result.playerCount !== result.players.length) {
    fail('playerCount must equal players.length');
  }
  requireUnique(
    result.players.map((player) => player.seat),
    'players[].seat'
  );
  if (result.players.filter((player) => player.role === 'host').length !== 1) {
    fail('players must contain exactly one host');
  }
  validateArtifactPaths(result);
  validateSessions(result);
  validatePassedResult(result);
  return result;
}

export async function writePlayLinejamResult(rawInput) {
  const schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
  let result;
  try {
    result = JSON.parse(rawInput);
  } catch {
    fail('candidate is not valid JSON');
  }
  validatePlayLinejamResult(result, schema);
  await validateArtifactFiles(result);

  const outputPath = resolve(
    REPO_ROOT,
    '.qa',
    'runs',
    result.runId,
    'result.json'
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  return outputPath;
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const rawInput = Buffer.concat(chunks).toString('utf8');
  if (!rawInput.trim()) fail('expected a JSON candidate on stdin');
  const outputPath = await writePlayLinejamResult(rawInput);
  process.stdout.write(`${outputPath}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
