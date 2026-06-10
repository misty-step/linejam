import path from 'node:path';
import { getMission } from './missions.mjs';

export const AGENTIC_MANIFEST_SCHEMA_VERSION = 1;

function relativeArtifact(runDir, filePath, kind) {
  return {
    kind,
    path: path.relative(runDir, filePath),
  };
}

export function createAgenticManifest({
  artifacts = /** @type {Array<{kind: string, path: string}>} */ ([]),
  baseUrl,
  deterministicChecks = /** @type {Array<{name: string, status: string, detail?: string}>} */ ([]),
  executor = {
    name: 'stagehand-plus-playwright',
    stagehandPackage: '@browserbasehq/stagehand',
    mode: 'stagehand-exploration-with-deterministic-playwright-baseline',
  },
  finishedAt,
  mission,
  result,
  runDir,
  runId,
  runtimeErrors = /** @type {string[]} */ ([]),
  stagehand = /** @type {unknown} */ (null),
  startedAt,
  target,
  transcript = /** @type {Array<{actor: string, text: string}>} */ ([]),
}) {
  const missionDefinition = getMission(mission);

  return {
    schemaVersion: AGENTIC_MANIFEST_SCHEMA_VERSION,
    runId,
    mission,
    missionDescription: missionDefinition.description,
    target,
    baseUrl,
    startedAt,
    finishedAt,
    result,
    requiresAuth: missionDefinition.requiresAuth,
    executor,
    stagehand,
    deterministicChecks,
    runtimeErrors,
    transcript,
    consoleSummary: {
      errors: runtimeErrors.length,
    },
    networkSummary: {
      failures: 0,
    },
    artifacts: artifacts.map((artifact) =>
      relativeArtifact(runDir, artifact.path, artifact.kind)
    ),
  };
}

export function createFailedManifest({
  artifacts = /** @type {Array<{kind: string, path: string}>} */ ([]),
  baseUrl,
  error,
  finishedAt,
  mission,
  runId,
  stagehand,
  startedAt,
  target,
  runDir,
}) {
  getMission(mission);
  return {
    schemaVersion: AGENTIC_MANIFEST_SCHEMA_VERSION,
    runId,
    mission,
    target,
    baseUrl,
    startedAt,
    finishedAt,
    result: 'fail',
    requiresAuth: true,
    executor: {
      name: 'stagehand-plus-playwright',
      stagehandPackage: '@browserbasehq/stagehand',
      mode: 'stagehand-exploration-with-deterministic-playwright-baseline',
    },
    stagehand,
    deterministicChecks: [
      {
        name: 'agentic mission completed',
        status: 'fail',
        detail: error instanceof Error ? error.message : String(error),
      },
    ],
    runtimeErrors: [error instanceof Error ? error.message : String(error)],
    transcript: [],
    consoleSummary: {
      errors: 1,
    },
    networkSummary: {
      failures: 0,
    },
    artifacts: artifacts.map((artifact) =>
      runDir ? relativeArtifact(runDir, artifact.path, artifact.kind) : artifact
    ),
  };
}
