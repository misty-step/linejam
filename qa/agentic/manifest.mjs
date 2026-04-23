export const AGENTIC_MANIFEST_VERSION = 1;
export const GENERIC_ERROR_PATTERNS = Object.freeze([
  /unexpected error occurred/i,
  /something went wrong/i,
  /application error/i,
  /generic join error/i,
]);

export function createAgenticManifest({
  baseUrl,
  mission,
  runId,
  startedAt = new Date().toISOString(),
  target,
}) {
  return {
    version: AGENTIC_MANIFEST_VERSION,
    runId,
    target,
    baseUrl,
    mission: {
      id: mission.id,
      title: mission.title,
      goal: mission.goal,
    },
    startedAt,
    finishedAt: null,
    status: 'RUNNING',
    checks: [],
    observations: [],
    runtimeErrors: [],
    screenshots: [],
    transcript: [],
  };
}

export function detectGenericErrors(values) {
  return values
    .map((value) => String(value ?? ''))
    .flatMap((value) =>
      GENERIC_ERROR_PATTERNS.filter((pattern) => pattern.test(value)).map(
        (pattern) => ({
          pattern: pattern.source,
          excerpt: excerpt(value),
        })
      )
    );
}

export function validateAgenticManifest(manifest, mission) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, errors: ['manifest must be an object'] };
  }

  if (manifest.version !== AGENTIC_MANIFEST_VERSION) {
    errors.push(`manifest version must be ${AGENTIC_MANIFEST_VERSION}`);
  }

  if (!manifest.runId) errors.push('runId is required');
  if (!manifest.baseUrl) errors.push('baseUrl is required');
  if (!manifest.mission?.id) errors.push('mission.id is required');
  if (!['RUNNING', 'PASS', 'FAIL'].includes(manifest.status)) {
    errors.push('status must be RUNNING, PASS, or FAIL');
  }

  const requiredScreenshots = mission?.requiredScreenshots ?? [];
  const screenshotLabels = new Set(
    Array.isArray(manifest.screenshots)
      ? manifest.screenshots.map((screenshot) => screenshot.label)
      : []
  );

  for (const label of requiredScreenshots) {
    if (!screenshotLabels.has(label)) {
      errors.push(`missing required screenshot: ${label}`);
    }
  }

  const checkFailures = Array.isArray(manifest.checks)
    ? manifest.checks.filter((check) => check.status === 'FAIL')
    : [];
  for (const check of checkFailures) {
    errors.push(`check failed: ${check.name}`);
  }

  const observationText = Array.isArray(manifest.observations)
    ? manifest.observations.map((observation) => observation.text)
    : [];
  const genericErrors = detectGenericErrors(observationText);
  for (const genericError of genericErrors) {
    errors.push(`generic error UI detected: ${genericError.excerpt}`);
  }

  if (
    Array.isArray(manifest.runtimeErrors) &&
    manifest.runtimeErrors.length > 0
  ) {
    errors.push(`runtime errors captured: ${manifest.runtimeErrors.length}`);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function markAgenticManifestFinished(
  manifest,
  status,
  now = new Date()
) {
  manifest.status = status;
  manifest.finishedAt = now.toISOString();
  return manifest;
}

function excerpt(value) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= 160
    ? normalized
    : `${normalized.slice(0, 157)}...`;
}
