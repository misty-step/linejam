import { promises as fs } from 'node:fs';
import path from 'node:path';

import { validateAgenticManifest } from './manifest.mjs';

export function scoreAgenticManifest(manifest, mission) {
  const validation = validateAgenticManifest(manifest, mission);
  const blockingReasons = [...validation.errors];
  const completedChecks = Array.isArray(manifest?.checks)
    ? manifest.checks.filter((check) => check.status === 'PASS').length
    : 0;
  const totalChecks = Array.isArray(manifest?.checks)
    ? manifest.checks.length
    : 0;
  const score =
    blockingReasons.length === 0
      ? 1
      : Math.max(0, Math.min(0.75, completedChecks / Math.max(totalChecks, 1)));

  return {
    verdict: blockingReasons.length === 0 ? 'pass' : 'fail',
    score,
    blockingReasons,
    summary:
      blockingReasons.length === 0
        ? `Mission ${manifest.mission.id} passed deterministic QA checks.`
        : `Mission ${manifest?.mission?.id ?? 'unknown'} failed: ${blockingReasons.join('; ')}`,
  };
}

export async function writeAgenticCriticArtifacts({
  manifest,
  mission,
  outDir,
}) {
  const result = scoreAgenticManifest(manifest, mission);
  const resultPath = path.join(outDir, 'critic-result.json');
  const summaryPath = path.join(outDir, 'critic-summary.md');

  await fs.writeFile(
    resultPath,
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8'
  );
  await fs.writeFile(
    summaryPath,
    renderCriticSummary(result, manifest),
    'utf8'
  );

  return {
    ...result,
    resultPath,
    summaryPath,
  };
}

function renderCriticSummary(result, manifest) {
  const lines = [
    '# Linejam Agentic QA Critic',
    '',
    `- Mission: ${manifest?.mission?.id ?? 'unknown'}`,
    `- Verdict: ${result.verdict}`,
    `- Score: ${result.score.toFixed(2)}`,
    '',
    '## Blocking Reasons',
    ...(result.blockingReasons.length === 0
      ? ['- None']
      : result.blockingReasons.map((reason) => `- ${reason}`)),
    '',
  ];

  return `${lines.join('\n')}\n`;
}
