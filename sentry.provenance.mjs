const EVENT_ID_PATTERN = /^[0-9a-f]{32}$/;
const RELEASE_PATTERN = /^[0-9a-f]{40}$/;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;
const MIN_SECRET_BYTES = 32;
const MAX_SECRET_BYTES = 256;

function isString(value) {
  return Object.prototype.toString.call(value) === '[object String]';
}

function utf8(value) {
  return new TextEncoder().encode(value);
}

function validateSecret(secret) {
  if (!isString(secret)) {
    throw new Error('Invalid Sentry automation provenance secret');
  }
  const bytes = utf8(secret);
  if (bytes.length < MIN_SECRET_BYTES || bytes.length > MAX_SECRET_BYTES) {
    throw new Error(
      `Sentry automation provenance secret must be ${MIN_SECRET_BYTES}-${MAX_SECRET_BYTES} bytes`
    );
  }
  return bytes;
}

function validateField(value, pattern, name) {
  if (!isString(value) || !pattern.test(value)) {
    throw new Error(`Invalid Sentry provenance ${name}`);
  }
  return value;
}

/**
 * Build the versioned, unambiguous message signed by trusted automation
 * producers and verified by the Sentry-to-GitHub bridge.
 *
 * @param {{
 *   eventId: string,
 *   runtime: string,
 *   environment: string,
 *   release: string,
 *   level: string,
 *   operation: string,
 *   failureCode: string,
 * }} fields
 */
export function sentryAutomationProvenanceMessage(fields) {
  const values = [
    validateField(fields.eventId, EVENT_ID_PATTERN, 'event ID'),
    fields.runtime,
    fields.environment,
    validateField(fields.release, RELEASE_PATTERN, 'release'),
    fields.level,
    fields.operation,
    fields.failureCode,
  ];
  if (
    values.slice(1).some((value) => !isString(value) || value.includes('\n'))
  ) {
    throw new Error('Invalid Sentry provenance field');
  }
  return ['linejam-sentry-automation-v1', ...values].join('\n');
}
/**
 * Build a secret-derived grouping identity that public-DSN writers cannot
 * predict and pre-poison.
 *
 * @param {{
 *   runtime: string,
 *   environment: string,
 *   level: string,
 *   operation: string,
 *   failureCode: string,
 * }} fields
 */
export function sentryAutomationGroupMessage(fields) {
  const values = [
    fields.runtime,
    fields.environment,
    fields.level,
    fields.operation,
    fields.failureCode,
  ];
  if (
    values.some(
      (value) => !isString(value) || value.length === 0 || value.includes('\n')
    )
  ) {
    throw new Error('Invalid Sentry automation group field');
  }
  return ['linejam-sentry-automation-group-v1', ...values].join('\n');
}

function hex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}

async function signMessage(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    validateSecret(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, utf8(message));
  return hex(new Uint8Array(signature));
}

/** @param {string} secret @param {Parameters<typeof sentryAutomationProvenanceMessage>[0]} fields */
export function signSentryAutomationProvenance(secret, fields) {
  return signMessage(secret, sentryAutomationProvenanceMessage(fields));
}

/** @param {string} secret @param {Parameters<typeof sentryAutomationGroupMessage>[0]} fields */
export function signSentryAutomationGroup(secret, fields) {
  return signMessage(secret, sentryAutomationGroupMessage(fields));
}

function constantTimeHexEqual(left, right) {
  if (!SIGNATURE_PATTERN.test(left) || !SIGNATURE_PATTERN.test(right))
    return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * @param {string} secret
 * @param {Parameters<typeof sentryAutomationProvenanceMessage>[0]} fields
 * @param {string} supplied
 */
export async function verifySentryAutomationProvenance(
  secret,
  fields,
  supplied
) {
  if (!isString(supplied) || !SIGNATURE_PATTERN.test(supplied)) {
    return false;
  }
  const expected = await signSentryAutomationProvenance(secret, fields);
  return constantTimeHexEqual(expected, supplied);
}
