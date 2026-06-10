import { getMission } from './missions.mjs';

const GENERIC_ERROR_PATTERN =
  /unexpected error occurred|application error|something went wrong|generic join error/i;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function artifactNames(manifest) {
  return asArray(manifest?.artifacts).map((artifact) =>
    typeof artifact?.path === 'string' ? artifact.path : ''
  );
}

function hasScreenshot(manifest) {
  return artifactNames(manifest).some((name) =>
    /\.(png|jpg|jpeg)$/i.test(name)
  );
}

export function gradeAgenticManifest(manifest) {
  const findings = [];
  const deterministicChecks = asArray(manifest?.deterministicChecks);
  const runtimeErrors = asArray(manifest?.runtimeErrors);
  const transcript = asArray(manifest?.transcript);

  if (!manifest || typeof manifest !== 'object') {
    return {
      verdict: 'fail',
      score: 0,
      findings: ['Manifest is missing or malformed.'],
    };
  }

  if (manifest.result !== 'pass') {
    findings.push(`Mission result is ${manifest.result || 'missing'}.`);
  }

  if (!manifest.stagehand || manifest.stagehand.ok !== true) {
    findings.push(
      `Stagehand exploration did not pass: ${
        manifest.stagehand?.reason || 'missing stagehand result'
      }.`
    );
  }

  let mission = null;
  try {
    mission = getMission(manifest.mission);
  } catch (error) {
    findings.push(error instanceof Error ? error.message : String(error));
  }

  if (deterministicChecks.length === 0) {
    findings.push('No deterministic checks were recorded.');
  }

  const failedChecks = deterministicChecks.filter(
    (check) => check?.status !== 'pass'
  );
  for (const check of failedChecks) {
    findings.push(`Deterministic check failed: ${check.name || 'unnamed'}.`);
  }

  if (mission) {
    const passedCheckNames = new Set(
      deterministicChecks
        .filter((check) => check?.status === 'pass')
        .map((check) => check.name)
    );
    for (const expectedCheck of mission.expectedChecks) {
      if (!passedCheckNames.has(expectedCheck)) {
        findings.push(`Missing expected check: ${expectedCheck}.`);
      }
    }

    const artifactSet = new Set(artifactNames(manifest));
    for (const expectedScreenshot of mission.expectedScreenshots) {
      if (!artifactSet.has(expectedScreenshot)) {
        findings.push(`Missing expected screenshot: ${expectedScreenshot}.`);
      }
    }
  }

  const genericError = [
    ...runtimeErrors,
    ...transcript.map((entry) => entry.text),
  ]
    .filter(Boolean)
    .find((text) => GENERIC_ERROR_PATTERN.test(String(text)));
  if (genericError) {
    findings.push(`Generic error surfaced during mission: ${genericError}`);
  }

  if (!hasScreenshot(manifest)) {
    findings.push('No screenshot artifact was recorded.');
  }

  const score = Math.max(0, 1 - findings.length * 0.25);
  return {
    verdict: findings.length === 0 ? 'pass' : 'fail',
    score,
    findings,
  };
}

export function renderCriticSummary({ manifest, critic }) {
  const lines = [
    '# Agentic QA Critic Summary',
    '',
    `- Mission: \`${manifest.mission}\``,
    `- Target: \`${manifest.target}\``,
    `- Base URL: \`${manifest.baseUrl}\``,
    `- Verdict: \`${critic.verdict}\``,
    `- Score: \`${critic.score.toFixed(2)}\``,
    '',
    '## Findings',
    ...(critic.findings.length === 0
      ? ['- None. Deterministic checks and artifact contract passed.']
      : critic.findings.map((finding) => `- ${finding}`)),
    '',
    '## Advisory Model Critic',
    '- Promptfoo/model grading is configured separately in `qa/agentic/promptfoo.yaml`; deterministic checks remain the merge-safe baseline.',
    '',
  ];

  return lines.join('\n');
}
