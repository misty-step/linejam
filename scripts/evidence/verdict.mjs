const VALID_ARTIFACTS = new Set([
  'gif',
  'manifest',
  'screenshot',
  'serverLog',
  'summary',
  'video',
]);

function parseExpiryDate(expiresOn) {
  if (typeof expiresOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) {
    return null;
  }

  const timestampMs = Date.parse(`${expiresOn}T23:59:59.999Z`);
  return Number.isNaN(timestampMs) ? null : timestampMs;
}

function normalizeRuntimeWaiver(waiver, index, now) {
  if (!waiver || typeof waiver !== 'object') {
    throw new Error(`runtimeErrors[${index}] waiver must be an object.`);
  }

  const pattern = String(waiver.pattern || '').trim();
  const reason = String(waiver.reason || '').trim();
  const expiresOn = String(waiver.expiresOn || '').trim();
  const expiresAt = parseExpiryDate(expiresOn);

  if (!pattern || !reason || !expiresAt) {
    throw new Error(
      `runtimeErrors[${index}] waiver requires pattern, reason, and expiresOn (YYYY-MM-DD).`
    );
  }

  try {
    new RegExp(pattern);
  } catch (error) {
    throw new Error(
      `runtimeErrors[${index}] waiver pattern is not a valid regular expression: ${errorMessage(error)}`
    );
  }

  if (expiresAt < now.getTime()) {
    throw new Error(`runtimeErrors[${index}] waiver expired on ${expiresOn}.`);
  }

  return { pattern, reason, expiresOn };
}

function normalizeArtifactWaiver(waiver, index, now) {
  if (!waiver || typeof waiver !== 'object') {
    throw new Error(`artifactErrors[${index}] waiver must be an object.`);
  }

  const artifact = String(waiver.artifact || '').trim();
  const reason = String(waiver.reason || '').trim();
  const expiresOn = String(waiver.expiresOn || '').trim();
  const expiresAt = parseExpiryDate(expiresOn);

  if (!VALID_ARTIFACTS.has(artifact) || !reason || !expiresAt) {
    throw new Error(
      `artifactErrors[${index}] waiver requires artifact, reason, and expiresOn (YYYY-MM-DD).`
    );
  }

  if (expiresAt < now.getTime()) {
    throw new Error(`artifactErrors[${index}] waiver expired on ${expiresOn}.`);
  }

  return { artifact, reason, expiresOn };
}

export function artifactIssue(artifact, message) {
  return { artifact, message };
}

export function issueArtifact(issue) {
  return typeof issue === 'string' ? 'artifact' : issue.artifact;
}

export function issueMessage(issue) {
  return typeof issue === 'string' ? issue : issue.message;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function parseEvidenceWaivers(payload, { now = new Date() } = {}) {
  if (!payload) {
    return { runtimeErrors: [], artifactErrors: [] };
  }

  if (typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Evidence waiver file must contain a JSON object.');
  }

  const runtimeErrors = Array.isArray(payload.runtimeErrors)
    ? payload.runtimeErrors.map((waiver, index) =>
        normalizeRuntimeWaiver(waiver, index, now)
      )
    : [];
  const artifactErrors = Array.isArray(payload.artifactErrors)
    ? payload.artifactErrors.map((waiver, index) =>
        normalizeArtifactWaiver(waiver, index, now)
      )
    : [];

  return { runtimeErrors, artifactErrors };
}

function matchesRuntimeWaiver(runtimeError, waiver) {
  return new RegExp(waiver.pattern).test(runtimeError);
}

function matchesArtifactWaiver(artifactError, waiver) {
  return artifactError.artifact === waiver.artifact;
}

/**
 * @param {{
 *   artifactErrors?: Array<{ artifact: string, message: string }>,
 *   flowError?: string | null,
 *   runtimeErrors?: string[],
 *   waivers?: {
 *     runtimeErrors: Array<{ pattern: string, reason: string, expiresOn: string }>,
 *     artifactErrors: Array<{ artifact: string, reason: string, expiresOn: string }>,
 *   },
 * }} input
 */
export function resolveEvidenceVerdict({
  artifactErrors = [],
  flowError = null,
  runtimeErrors = [],
  waivers = { artifactErrors: [], runtimeErrors: [] },
}) {
  const waivedRuntimeErrors = [];
  const unwaivedRuntimeErrors = [];
  const waivedArtifactErrors = [];
  const unwaivedArtifactErrors = [];

  for (const runtimeError of runtimeErrors) {
    const waiver = waivers.runtimeErrors.find((candidate) =>
      matchesRuntimeWaiver(runtimeError, candidate)
    );

    if (waiver) {
      waivedRuntimeErrors.push({ error: runtimeError, waiver });
    } else {
      unwaivedRuntimeErrors.push(runtimeError);
    }
  }

  for (const artifactError of artifactErrors) {
    const waiver = waivers.artifactErrors.find((candidate) =>
      matchesArtifactWaiver(artifactError, candidate)
    );

    if (waiver) {
      waivedArtifactErrors.push({ error: artifactError, waiver });
    } else {
      unwaivedArtifactErrors.push(artifactError);
    }
  }

  const failed =
    Boolean(flowError) ||
    unwaivedRuntimeErrors.length > 0 ||
    unwaivedArtifactErrors.length > 0;
  const waived =
    waivedRuntimeErrors.length > 0 || waivedArtifactErrors.length > 0;

  return {
    result: failed ? 'FAIL' : waived ? 'PASS_WITH_WAIVERS' : 'PASS',
    unwaivedRuntimeErrors,
    waivedRuntimeErrors,
    unwaivedArtifactErrors,
    waivedArtifactErrors,
  };
}
