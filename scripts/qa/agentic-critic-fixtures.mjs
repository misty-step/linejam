#!/usr/bin/env node

import {
  DEFAULT_AGENTIC_MISSION,
  resolveAgenticMission,
} from '../../qa/agentic/missions.mjs';
import { scoreAgenticManifest } from '../../qa/agentic/critic.mjs';

const mission = resolveAgenticMission(DEFAULT_AGENTIC_MISSION);
const healthyManifest = {
  version: 1,
  runId: 'fixture-pass',
  target: 'local',
  baseUrl: 'http://localhost:3000',
  mission,
  startedAt: '2026-04-23T00:00:00.000Z',
  finishedAt: '2026-04-23T00:00:01.000Z',
  status: 'PASS',
  checks: [{ name: 'join completed', status: 'PASS' }],
  observations: [{ actor: 'host', label: 'lobby', text: 'Canary Clerk User' }],
  runtimeErrors: [],
  screenshots: mission.requiredScreenshots.map((label) => ({
    label,
    file: `${label}.png`,
  })),
  transcript: [],
};
const genericJoinErrorManifest = {
  ...healthyManifest,
  runId: 'fixture-fail',
  observations: [
    {
      actor: 'joiner',
      label: 'join error',
      text: 'An unexpected error occurred while joining the room.',
    },
  ],
};

const healthyResult = scoreAgenticManifest(healthyManifest, mission);
const genericErrorResult = scoreAgenticManifest(
  genericJoinErrorManifest,
  mission
);

if (healthyResult.verdict !== 'pass') {
  throw new Error(`Healthy fixture should pass: ${healthyResult.summary}`);
}

if (genericErrorResult.verdict !== 'fail') {
  throw new Error('Generic join error fixture should fail.');
}

process.stdout.write(
  `${JSON.stringify(
    {
      healthy: healthyResult.verdict,
      genericJoinError: genericErrorResult.verdict,
    },
    null,
    2
  )}\n`
);
