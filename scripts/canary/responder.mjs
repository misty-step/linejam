#!/usr/bin/env node

import http from 'node:http';
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { fetchCanaryContext } from './context.mjs';
import {
  deliveryExists,
  fingerprintExists,
  listPendingSmokeDeliveries,
  persistDelivery,
  persistFingerprint,
  persistJson,
  pruneExpiredArtifacts,
  persistSummary,
} from './store.mjs';
import { resolveService } from './service.mjs';
import { runSmoke, shouldTriggerSmoke } from './trigger-smoke.mjs';

const DEFAULT_PORT = 8787;
const DEFAULT_PATH = '/canary/webhook';
const DEFAULT_MAX_IN_FLIGHT_SMOKES = 2;
const DEFAULT_MAX_PENDING_SMOKES = 20;
const DEFAULT_MAX_BODY_BYTES = 256 * 1024;
const DEFAULT_PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const SAFE_HEADER_KEYS = new Set([
  'content-type',
  'user-agent',
  'x-delivery-id',
  'x-event',
  'x-sequence',
  'x-webhook-version',
]);
let inFlightSmokeCount = 0;
let lastPruneStartedAt = 0;
const pendingSmokeQueue = [];

function resetSmokeSchedulerState() {
  inFlightSmokeCount = 0;
  pendingSmokeQueue.length = 0;
}

function getWebhookPath() {
  return process.env.LINEJAM_CANARY_WEBHOOK_PATH || DEFAULT_PATH;
}

function getConfiguredService() {
  return process.env.LINEJAM_CANARY_SERVICE || 'linejam';
}

function normalizeString(value) {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeDeliveryId(value) {
  return normalizeString(value);
}

function getWebhookSecret() {
  const secret = normalizeString(process.env.LINEJAM_CANARY_WEBHOOK_SECRET);

  if (!secret) {
    throw new Error('LINEJAM_CANARY_WEBHOOK_SECRET is required');
  }

  return secret;
}

function getCanaryApiKey() {
  const apiKey = normalizeString(process.env.CANARY_API_KEY);

  if (!apiKey) {
    throw new Error('CANARY_API_KEY is required');
  }

  return apiKey;
}

class RequestTooLargeError extends Error {}

export function resolvePayloadService(payload) {
  return resolveService(payload);
}

function getReadinessStatus() {
  try {
    getWebhookSecret();
    getCanaryApiKey();
    return {
      statusCode: 200,
      body: { status: 'ok' },
    };
  } catch (error) {
    return {
      statusCode: 503,
      body: {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function getHealthStatus() {
  const readiness = getReadinessStatus();

  return {
    statusCode: 200,
    body: {
      status: 'ok',
      ready: readiness.statusCode === 200,
      readiness: readiness.body,
    },
  };
}

function smokeTriggersEnabled() {
  return process.env.CANARY_SMOKE_TRIGGER_ENABLED !== '0';
}

function getMaxInFlightSmokes() {
  const parsed = Number.parseInt(
    process.env.CANARY_SMOKE_MAX_IN_FLIGHT ||
      String(DEFAULT_MAX_IN_FLIGHT_SMOKES),
    10
  );

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MAX_IN_FLIGHT_SMOKES;
}

function getMaxPendingSmokes() {
  const parsed = Number.parseInt(
    process.env.CANARY_SMOKE_MAX_PENDING || String(DEFAULT_MAX_PENDING_SMOKES),
    10
  );

  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_MAX_PENDING_SMOKES;
}

function getRequestPathname(requestUrl) {
  try {
    return new URL(requestUrl || '/', 'http://127.0.0.1').pathname;
  } catch {
    return '';
  }
}

function getMaxBodyBytes() {
  const parsed = Number.parseInt(
    process.env.LINEJAM_CANARY_MAX_BODY_BYTES || String(DEFAULT_MAX_BODY_BYTES),
    10
  );

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MAX_BODY_BYTES;
}

function getPruneIntervalMs() {
  const parsed = Number.parseInt(
    process.env.LINEJAM_CANARY_PRUNE_INTERVAL_MS ||
      String(DEFAULT_PRUNE_INTERVAL_MS),
    10
  );

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_PRUNE_INTERVAL_MS;
}

function readRequestBody(request, maxBodyBytes = getMaxBodyBytes()) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    const cleanup = () => {
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('error', onError);
    };

    const rejectTooLarge = (message) => {
      if (settled) return;
      settled = true;
      cleanup();
      request.resume();
      reject(new RequestTooLargeError(message));
    };

    const onData = (chunk) => {
      if (settled) return;

      const buffer = Buffer.from(chunk);
      totalBytes += buffer.length;

      if (totalBytes > maxBodyBytes) {
        rejectTooLarge(`request body exceeded ${maxBodyBytes} bytes`);
        return;
      }

      chunks.push(buffer);
    };

    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks));
    };

    const onError = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    request.on('data', onData);
    request.on('end', onEnd);
    request.on('error', onError);
  });
}

function jsonResponse(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function summarizeHeaders(headers) {
  const next = {};

  for (const [key, value] of Object.entries(headers)) {
    if (!SAFE_HEADER_KEYS.has(key)) continue;
    if (!value) continue;
    next[key] = value;
  }

  next.signaturePresent = typeof headers['x-signature'] === 'string';
  return next;
}

function summarizeNestedEntity(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const next = {};

  for (const key of keys) {
    const nestedValue = normalizeString(value[key]);
    if (nestedValue) {
      next[key] = nestedValue;
    }
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function summarizePayload(payload) {
  const summary = {
    event: normalizeString(payload.event),
    service: resolvePayloadService(payload),
    deliveryId: normalizeDeliveryId(payload.delivery_id),
    error: summarizeNestedEntity(payload.error, [
      'id',
      'service',
      'error_class',
      'group_hash',
      'severity',
    ]),
    incident: summarizeNestedEntity(payload.incident, [
      'id',
      'service',
      'state',
      'severity',
    ]),
    target: summarizeNestedEntity(payload.target, ['id', 'service', 'name']),
    check: summarizeNestedEntity(payload.check, ['id', 'service', 'status']),
  };

  const parsedSequence =
    typeof payload.sequence === 'number' ? payload.sequence : undefined;

  if (typeof parsedSequence === 'number' && Number.isFinite(parsedSequence)) {
    summary.sequence = parsedSequence;
  }

  return Object.fromEntries(
    Object.entries(summary).filter(([, value]) => value !== undefined)
  );
}

export function verifySignature(rawBody, signature, secret) {
  if (!signature?.startsWith('sha256=')) return false;

  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function summarizeProcessing({
  eventName,
  deliveryId,
  sequence,
  service,
  contextStatus,
  contextError,
  smokeResult,
  deliveryPath,
  contextPath,
}) {
  const lines = [
    `# Canary Delivery ${deliveryId}`,
    '',
    `- Event: \`${eventName}\``,
    `- Sequence: \`${sequence}\``,
    `- Service: \`${service}\``,
    `- Stored delivery: \`${deliveryPath}\``,
  ];

  if (contextPath) {
    lines.push(`- Stored context: \`${contextPath}\``);
  }
  if (contextStatus) {
    lines.push(`- Context status: \`${contextStatus}\``);
  }
  if (contextError) {
    lines.push(`- Context error: \`${contextError}\``);
  }

  if (smokeResult) {
    lines.push(
      `- Smoke triggered: \`${smokeResult.skipped ? 'skipped' : 'yes'}\``
    );
    if (smokeResult.reason) {
      lines.push(`- Smoke reason: \`${smokeResult.reason}\``);
    }
    if (smokeResult.baseUrl) {
      lines.push(`- Smoke base URL: \`${smokeResult.baseUrl}\``);
    }
    if (!smokeResult.skipped) {
      lines.push(`- Smoke exit code: \`${smokeResult.code}\``);
    }
    if (smokeResult.agenticQa) {
      lines.push(
        `- Agentic QA: \`${smokeResult.agenticQa.skipped ? 'skipped' : smokeResult.agenticQa.ok ? 'passed' : 'failed'}\``
      );
      if (smokeResult.agenticQa.reason) {
        lines.push(`- Agentic QA reason: \`${smokeResult.agenticQa.reason}\``);
      }
      if (smokeResult.agenticQa.manifest) {
        lines.push(
          `- Agentic QA manifest: \`${smokeResult.agenticQa.manifest}\``
        );
      }
      if (smokeResult.agenticQa.criticSummary) {
        lines.push(
          `- Agentic QA critic summary: \`${smokeResult.agenticQa.criticSummary}\``
        );
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

function createPendingSmoke() {
  return { status: 'pending', queued: true };
}

function createSkippedSmoke(reason) {
  return {
    status: 'skipped',
    queued: false,
    reason,
  };
}

function createSmokeFailureResult(error) {
  return {
    ok: false,
    skipped: false,
    code: null,
    timedOut: false,
    reason: error instanceof Error ? error.message : String(error),
  };
}

function createTerminalSmoke(smokeResult) {
  return {
    status: smokeResult.skipped
      ? 'skipped'
      : smokeResult.ok
        ? 'succeeded'
        : 'failed',
    queued: false,
    result: smokeResult,
    finishedAt: new Date().toISOString(),
  };
}

function getInitialSmoke({
  shouldRunSmoke,
  eventName,
  serviceMatched,
  serviceKnown,
}) {
  if (shouldRunSmoke) {
    return createPendingSmoke();
  }

  const reason =
    !serviceMatched && eventName !== 'canary.ping'
      ? serviceKnown
        ? 'service_mismatch'
        : 'service_unknown'
      : 'not_triggered';

  return createSkippedSmoke(reason);
}

function createSmokeSummaryResult({ shouldRunSmoke, smoke, smokeQueued }) {
  if (shouldRunSmoke && smokeQueued) {
    return { skipped: false };
  }

  if (smoke?.reason) {
    return { skipped: true, reason: smoke.reason };
  }

  return undefined;
}

function defaultDependencies() {
  return {
    deliveryExists,
    fingerprintExists,
    listPendingSmokeDeliveries,
    fetchCanaryContext,
    persistDelivery,
    persistFingerprint,
    persistJson,
    pruneExpiredArtifacts,
    persistSummary,
    runSmoke,
    shouldTriggerSmoke,
    smokeTriggersEnabled,
    scheduleSmoke: scheduleSmokeFollowup,
  };
}

async function maybePruneArtifacts(dependencies) {
  if (typeof dependencies.pruneExpiredArtifacts !== 'function') {
    return;
  }

  const now = Date.now();
  if (now - lastPruneStartedAt < getPruneIntervalMs()) {
    return;
  }

  lastPruneStartedAt = now;

  try {
    await dependencies.pruneExpiredArtifacts();
  } catch (error) {
    lastPruneStartedAt = 0;
    console.error('Canary store prune failed', error);
  }
}

async function persistSmokeFollowup({
  deliveryId,
  eventName,
  service,
  sequence,
  deliveryRecord,
  dependencies,
}) {
  try {
    const smokeResult = await dependencies.runSmoke({ eventName, deliveryId });
    await dependencies.persistJson(
      'smoke',
      `${deliveryId}-${eventName}`,
      smokeResult
    );

    const updatedDeliveryPath = await dependencies.persistDelivery(
      deliveryId,
      sequence,
      {
        ...deliveryRecord,
        smoke: createTerminalSmoke(smokeResult),
      }
    );

    await dependencies.persistSummary(
      `${deliveryId}-${eventName}-smoke`,
      summarizeProcessing({
        eventName,
        deliveryId,
        sequence,
        service,
        smokeResult,
        deliveryPath: updatedDeliveryPath,
        contextPath: deliveryRecord.contextPath,
      })
    );
  } catch (error) {
    const smokeFailure = createSmokeFailureResult(error);

    await dependencies.persistDelivery(deliveryId, sequence, {
      ...deliveryRecord,
      smoke: createTerminalSmoke(smokeFailure),
    });

    console.error('Canary smoke follow-up failed', error);
  }
}

function drainSmokeQueue() {
  while (
    pendingSmokeQueue.length > 0 &&
    inFlightSmokeCount < getMaxInFlightSmokes()
  ) {
    const next = pendingSmokeQueue.shift();
    if (!next) continue;
    queueSmokeFollowup(next);
  }
}

function queueSmokeFollowup(args) {
  inFlightSmokeCount += 1;
  queueMicrotask(() => {
    void persistSmokeFollowup(args).finally(() => {
      inFlightSmokeCount = Math.max(0, inFlightSmokeCount - 1);
      drainSmokeQueue();
    });
  });
}

function restoreSmokeFollowup(args) {
  if (inFlightSmokeCount >= getMaxInFlightSmokes()) {
    if (pendingSmokeQueue.length >= getMaxPendingSmokes()) {
      return false;
    }

    pendingSmokeQueue.push(args);
    return true;
  }

  queueSmokeFollowup(args);
  return true;
}

function scheduleSmokeFollowup(args) {
  return restoreSmokeFollowup(args);
}

export async function reconcilePendingSmoke(dependencies) {
  const activeDependencies = dependencies || defaultDependencies();

  if (typeof activeDependencies.listPendingSmokeDeliveries !== 'function') {
    return { replayed: 0 };
  }

  const pending = await activeDependencies.listPendingSmokeDeliveries();
  let replayed = 0;

  for (const delivery of pending) {
    if (
      !delivery ||
      typeof delivery.deliveryId !== 'string' ||
      typeof delivery.eventName !== 'string'
    ) {
      continue;
    }

    const scheduled = restoreSmokeFollowup({
      deliveryId: delivery.deliveryId,
      eventName: delivery.eventName,
      service:
        typeof delivery.service === 'string' && delivery.service.length > 0
          ? delivery.service
          : 'unknown',
      sequence:
        typeof delivery.sequence === 'number' &&
        Number.isFinite(delivery.sequence)
          ? delivery.sequence
          : 0,
      deliveryRecord: delivery.deliveryRecord,
      dependencies: activeDependencies,
    });
    if (scheduled) {
      replayed += 1;
    }
  }

  return { replayed };
}

export function createEventFingerprint({ eventName, rawBodySha256, sequence }) {
  return createHash('sha256')
    .update(eventName)
    .update('\n')
    .update(String(sequence))
    .update('\n')
    .update(rawBodySha256)
    .digest('hex');
}

export async function processDelivery(args) {
  const { headers, rawBody, payload, dependencies } = args;
  const activeDependencies = dependencies || defaultDependencies();
  await maybePruneArtifacts(activeDependencies);

  const eventName =
    normalizeString(payload.event) || headers['x-event'] || 'unknown';
  const headerDeliveryId = normalizeDeliveryId(headers['x-delivery-id']);
  const payloadDeliveryId = normalizeDeliveryId(payload.delivery_id);
  const originalDeliveryId = payloadDeliveryId || headerDeliveryId;
  const deliveryIdMissing = !originalDeliveryId;
  const deliveryId = originalDeliveryId || `missing-${randomUUID()}`;
  const payloadSequence =
    typeof payload.sequence === 'number' && Number.isFinite(payload.sequence)
      ? payload.sequence
      : undefined;
  const parsedSequence = Number.parseInt(
    payloadSequence !== undefined
      ? String(payloadSequence)
      : headers['x-sequence'] || '0',
    10
  );
  const sequence = Number.isFinite(parsedSequence) ? parsedSequence : 0;
  const rawBodySha256 = createHash('sha256').update(rawBody).digest('hex');
  const eventFingerprint = createEventFingerprint({
    eventName,
    rawBodySha256,
    sequence,
  });

  if (
    !deliveryIdMissing &&
    (await activeDependencies.deliveryExists(deliveryId, sequence))
  ) {
    return {
      statusCode: 200,
      body: { status: 'duplicate', event: eventName, deliveryId, sequence },
    };
  }

  if (await activeDependencies.fingerprintExists(eventFingerprint)) {
    return {
      statusCode: 200,
      body: {
        status: 'duplicate',
        event: eventName,
        deliveryId,
        deliveryIdMissing,
        sequence,
        fingerprint: eventFingerprint,
      },
    };
  }

  const configuredService = getConfiguredService();
  const resolvedService = resolvePayloadService(payload);
  const serviceKnown = eventName === 'canary.ping' || Boolean(resolvedService);
  const service =
    resolvedService ||
    (eventName === 'canary.ping' ? configuredService : 'unknown');
  const serviceMatched =
    eventName === 'canary.ping' || resolvedService === configuredService;
  const shouldCollectContext = eventName !== 'canary.ping' && serviceMatched;

  const shouldRunSmoke =
    shouldCollectContext &&
    activeDependencies.smokeTriggersEnabled() &&
    activeDependencies.shouldTriggerSmoke(eventName);

  let contextPath;
  let contextStatus =
    eventName === 'canary.ping'
      ? 'skipped'
      : serviceMatched
        ? 'pending'
        : serviceKnown
          ? 'skipped_service_mismatch'
          : 'skipped_service_unknown';
  let contextError;
  let smoke = getInitialSmoke({
    shouldRunSmoke,
    eventName,
    serviceMatched,
    serviceKnown,
  });

  let deliveryRecord = {
    receivedAt: new Date().toISOString(),
    eventName,
    deliveryId,
    deliveryIdMissing,
    originalDeliveryId: originalDeliveryId || null,
    sequence,
    headerSummary: summarizeHeaders(headers),
    payloadSummary: summarizePayload(payload),
    rawBodySha256,
    rawBodyBytes: rawBody.length,
    eventFingerprint,
    configuredService,
    service,
    serviceMatched,
    contextPath,
    contextStatus,
    smoke,
  };

  let deliveryPath = await activeDependencies.persistDelivery(
    deliveryId,
    sequence,
    deliveryRecord
  );
  await activeDependencies.persistFingerprint(eventFingerprint, {
    deliveryId,
    deliveryIdMissing,
    originalDeliveryId: originalDeliveryId || null,
    eventName,
    sequence,
    rawBodySha256,
    recordedAt: deliveryRecord.receivedAt,
  });

  if (shouldCollectContext) {
    try {
      const context = await activeDependencies.fetchCanaryContext(service);
      contextPath = await activeDependencies.persistJson(
        'contexts',
        `${deliveryId}-${eventName}`,
        {
          eventName,
          deliveryId,
          sequence,
          service,
          context,
        }
      );
      contextStatus = 'ok';
    } catch (error) {
      contextStatus = 'failed';
      contextError = error instanceof Error ? error.message : String(error);
    }
  }

  deliveryRecord = {
    ...deliveryRecord,
    contextPath,
    contextStatus,
    contextError,
  };

  let smokeQueued = false;
  if (shouldRunSmoke) {
    smokeQueued = activeDependencies.scheduleSmoke({
      deliveryId,
      eventName,
      service,
      sequence,
      deliveryRecord,
      dependencies: activeDependencies,
    });
    if (!smokeQueued) {
      smoke = createSkippedSmoke('smoke queue saturated');
    }
  }

  deliveryRecord = {
    ...deliveryRecord,
    smoke,
  };
  deliveryPath = await activeDependencies.persistDelivery(
    deliveryId,
    sequence,
    deliveryRecord
  );

  const smokeResult = createSmokeSummaryResult({
    shouldRunSmoke,
    smoke,
    smokeQueued,
  });

  const summaryPath = await activeDependencies.persistSummary(
    `${deliveryId}-${eventName}`,
    summarizeProcessing({
      eventName,
      deliveryId,
      sequence,
      service,
      contextStatus,
      contextError,
      smokeResult,
      deliveryPath,
      contextPath,
    })
  );

  return {
    statusCode: 202,
    body: {
      status: 'accepted',
      event: eventName,
      deliveryId,
      deliveryIdMissing,
      sequence,
      service,
      serviceMatched,
      paths: {
        delivery: deliveryPath,
        context: contextPath,
        summary: summaryPath,
      },
      smokeTriggered: shouldRunSmoke,
      smokeQueued,
    },
  };
}

async function handleRequest(
  request,
  response,
  dependencies = defaultDependencies()
) {
  const pathname = getRequestPathname(request.url);

  if (request.method === 'GET' && pathname === '/healthz') {
    const health = getHealthStatus();
    return jsonResponse(response, health.statusCode, health.body);
  }

  if (request.method === 'GET' && pathname === '/readyz') {
    const readiness = getReadinessStatus();
    return jsonResponse(response, readiness.statusCode, readiness.body);
  }

  if (request.method !== 'POST' || pathname !== getWebhookPath()) {
    return jsonResponse(response, 404, { error: 'not_found' });
  }

  try {
    const rawBody = await readRequestBody(request);
    const signature = request.headers['x-signature'];

    if (typeof signature !== 'string') {
      return jsonResponse(response, 400, { error: 'missing_signature' });
    }

    if (!verifySignature(rawBody, signature, getWebhookSecret())) {
      return jsonResponse(response, 401, { error: 'invalid_signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return jsonResponse(response, 400, { error: 'invalid_json' });
    }

    const normalizedHeaders = Object.fromEntries(
      Object.entries(request.headers).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(',') : value || '',
      ])
    );

    const result = await processDelivery({
      headers: normalizedHeaders,
      rawBody,
      payload,
      dependencies,
    });
    return jsonResponse(response, result.statusCode, result.body);
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return jsonResponse(response, 413, {
        error: 'payload_too_large',
        message: error.message,
      });
    }

    console.error('Canary responder failed', error);
    return jsonResponse(response, 500, {
      error: 'processing_failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startServer(dependencies = defaultDependencies()) {
  const port = Number.parseInt(
    process.env.LINEJAM_CANARY_RESPONDER_PORT ||
      process.env.PORT ||
      String(DEFAULT_PORT),
    10
  );
  resetSmokeSchedulerState();
  void maybePruneArtifacts(dependencies);
  void reconcilePendingSmoke(dependencies).catch((error) => {
    console.error('Canary smoke replay failed', error);
  });

  const server = http.createServer((request, response) => {
    void handleRequest(request, response, dependencies);
  });

  server.listen(port, () => {
    const address = server.address();
    const boundPort =
      typeof address === 'object' && address ? address.port : port;
    console.log(
      `Canary responder listening on http://127.0.0.1:${boundPort}${getWebhookPath()}`
    );
  });

  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
