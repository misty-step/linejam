import { makeFunctionReference } from 'convex/server';
import { httpRouter } from 'convex/server';
import type { Id } from './_generated/dataModel';
import { httpAction } from './_generated/server';
import { getConvexEnvHealthReport } from './lib/env';

export const SENTRY_WEBHOOK_MAX_BODY_BYTES = 256 * 1024;
export const SENTRY_AGENT_MAX_BODY_BYTES = 4 * 1024;
const SENTRY_AGENT_MAX_CLOCK_SKEW_MS = 60_000;

type WebhookProjection = {
  dedupKey: string;
  canonicalKey: string;
  installationUuid: string;
  projectId: string;
  sentryIssueId: string;
  sentryEventId: string;
};

const admitWebhookRef = makeFunctionReference<
  'action',
  WebhookProjection,
  'accepted' | 'rejected'
>('sentryGithub:admitWebhook');

type AgentClaim = {
  _id: Id<'sentryGithubReceipts'>;
  dedupKey: string;
  projectId: string;
  sentryIssueId: string;
  githubIssueNumber: number;
  environment: 'preview' | 'production';
  release: string;
  operation:
    | 'sweepAbandonedGames'
    | 'finishAbandonedGame'
    | 'previewSmoke'
    | 'productionSmoke';
  agentAttempts: number;
  agentLeaseExpiresAt: number;
};

const claimAgentReceiptRef = makeFunctionReference<
  'mutation',
  { leaseId: string; now: number },
  AgentClaim | null
>('sentryGithub:claimAgentReceipt');

const completeAgentReceiptRef = makeFunctionReference<
  'mutation',
  {
    receiptId: Id<'sentryGithubReceipts'>;
    leaseId: string;
    outcome: 'completed' | 'retry' | 'issue_closed' | 'issue_invalid';
    now: number;
  },
  boolean
>('sentryGithub:completeAgentReceipt');

const authorizeAgentReceiptRef = makeFunctionReference<
  'query',
  {
    receiptId: Id<'sentryGithubReceipts'>;
    leaseId: string;
    now: number;
  },
  boolean
>('sentryGithub:authorizeAgentReceipt');

function fixedError(status: 400 | 503): Response {
  return new Response(status === 400 ? 'Invalid webhook' : 'Unavailable', {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

export interface DecodedHexSignature {
  bytes: Uint8Array;
  valid: boolean;
}

function fixedAgentError(status: 400 | 401 | 409 | 503): Response {
  const body =
    status === 401
      ? 'Unauthorized'
      : status === 409
        ? 'Stale lease'
        : status === 400
          ? 'Invalid request'
          : 'Unavailable';
  return new Response(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

export interface SentryWebhookEventData {
  project?: string | number;
  issue_id?: string | number;
  event_id?: string;
}

export interface SentryWebhookData {
  event?: SentryWebhookEventData;
}

export interface SentryWebhookInstallation {
  uuid?: string;
}

export interface SentryWebhookPayload {
  action?: string;
  installation?: SentryWebhookInstallation;
  data?: SentryWebhookData;
}

type RawIdentifier = string | number | null | undefined;
async function readBoundedBody(
  request: Request,
  maximumBytes = SENTRY_WEBHOOK_MAX_BODY_BYTES
): Promise<Uint8Array | null> {
  const contentLength = request.headers.get('Content-Length');
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength) || Number(contentLength) > maximumBytes) {
      return null;
    }
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function decodeHexSignature(value: string): DecodedHexSignature {
  const valid = /^[0-9a-fA-F]{64}$/.test(value);
  const bytes = new Uint8Array(32);
  if (!valid) return { bytes, valid: false };
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return { bytes, valid: true };
}

export async function verifySentrySignature(
  body: Uint8Array,
  signature: string,
  secret: string
): Promise<boolean> {
  const exactBody = new ArrayBuffer(body.byteLength);
  new Uint8Array(exactBody).set(body);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, exactBody)
  );
  const supplied = decodeHexSignature(signature);
  let difference = supplied.valid ? 0 : 1;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected[index] ^ supplied.bytes[index];
  }
  return difference === 0;
}

export async function verifyAgentSignature(
  timestamp: string,
  body: Uint8Array,
  signature: string,
  secret: string,
  now = Date.now()
): Promise<boolean> {
  if (
    !/^\d{10,13}$/.test(timestamp) ||
    secret.length < 32 ||
    body.byteLength > SENTRY_AGENT_MAX_BODY_BYTES
  ) {
    return false;
  }
  const parsedTimestamp = Number(timestamp);
  const timestampMs =
    timestamp.length === 10 ? parsedTimestamp * 1000 : parsedTimestamp;
  if (
    !Number.isSafeInteger(timestampMs) ||
    Math.abs(now - timestampMs) > SENTRY_AGENT_MAX_CLOCK_SKEW_MS
  ) {
    return false;
  }
  const prefix = new TextEncoder().encode(`${timestamp}\n`);
  const canonical = new Uint8Array(prefix.byteLength + body.byteLength);
  canonical.set(prefix);
  canonical.set(body, prefix.byteLength);
  return verifySentrySignature(canonical, signature, secret);
}
interface AgentRequestPayload {
  action?: RawIdentifier;
  leaseId?: RawIdentifier;
  outcome?: RawIdentifier;
  receiptId?: RawIdentifier;
}

type AgentRequest =
  | { action: 'claim'; leaseId: string }
  | {
      action: 'authorize';
      receiptId: Id<'sentryGithubReceipts'>;
      leaseId: string;
    }
  | {
      action: 'complete';
      receiptId: Id<'sentryGithubReceipts'>;
      leaseId: string;
      outcome: 'completed' | 'retry' | 'issue_closed' | 'issue_invalid';
    };

function projectAgentRequest(value: AgentRequestPayload): AgentRequest | null {
  const leaseCandidate = value.leaseId;
  const leaseId = boundedId(
    leaseCandidate,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    36
  );
  if (!leaseId) return null;
  if (value.action === 'claim') return { action: 'claim', leaseId };
  if (value.action !== 'authorize' && value.action !== 'complete') return null;
  const receiptCandidate = value.receiptId;
  const receiptId = boundedId(receiptCandidate, /^[a-zA-Z0-9_-]+$/, 64);
  if (!receiptId) return null;
  if (value.action === 'authorize') {
    // SAFETY: boundedId accepted only a non-empty identifier-safe string.
    return {
      action: 'authorize',
      receiptId: receiptId as Id<'sentryGithubReceipts'>,
      leaseId,
    };
  }
  if (
    value.outcome !== 'completed' &&
    value.outcome !== 'retry' &&
    value.outcome !== 'issue_closed' &&
    value.outcome !== 'issue_invalid'
  ) {
    return null;
  }
  // SAFETY: boundedId accepted only a non-empty identifier-safe string.
  return {
    action: 'complete',
    receiptId: receiptId as Id<'sentryGithubReceipts'>,
    leaseId,
    outcome: value.outcome,
  };
}

function boundedId(
  value: RawIdentifier,
  pattern: RegExp,
  maximumLength: number
): string | null {
  if (value === null || value === undefined) return null;
  const representation = Object.prototype.toString.call(value);
  let str: string | null = null;
  if (representation === '[object Number]') {
    const numeric = Number(value);
    if (Number.isSafeInteger(numeric) && numeric >= 0) {
      str = String(numeric);
    }
  } else if (representation === '[object String]') {
    str = String(value);
  }
  if (
    str === null ||
    str.length === 0 ||
    str.length > maximumLength ||
    !pattern.test(str)
  ) {
    return null;
  }
  return str;
}

export function projectSentryWebhook(
  value: SentryWebhookPayload | null | undefined,
  requestIdValue: string | null,
  expectedInstallationUuid: string,
  expectedProjectId: string
): WebhookProjection | null {
  if (!value || value.action !== 'triggered') return null;
  if (!value.installation || !value.data) return null;
  const event = value.data.event;
  if (!event) return null;

  const installationUuid = boundedId(
    value.installation.uuid,
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    36
  );
  const projectId = boundedId(event.project, /^\d+$/, 32);
  const sentryIssueId = boundedId(event.issue_id, /^\d+$/, 32);
  const sentryEventId = boundedId(event.event_id, /^[0-9a-f]{32}$/, 32);
  const requestId = boundedId(requestIdValue, /^[0-9a-fA-F]{32}$/, 32);
  if (
    !installationUuid ||
    !projectId ||
    !sentryIssueId ||
    !sentryEventId ||
    !requestId ||
    installationUuid !== expectedInstallationUuid ||
    projectId !== expectedProjectId
  ) {
    return null;
  }
  const canonicalKey = `v1:${installationUuid}:${projectId}:${sentryIssueId}`;
  return {
    dedupKey: `v2:${installationUuid}:${projectId}:${sentryIssueId}:${sentryEventId}`,
    canonicalKey,
    installationUuid,
    projectId,
    sentryIssueId,
    sentryEventId,
  };
}

const http = httpRouter();

http.route({
  path: '/api/health',
  method: 'GET',
  handler: httpAction(async () => {
    const report = getConvexEnvHealthReport();

    return Response.json(report, {
      status: report.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }),
});

http.route({
  path: '/api/webhooks/sentry',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.SENTRY_WEBHOOK_SECRET;
    const expectedAppId = process.env.SENTRY_EXPECTED_APP_ID;
    const expectedInstallationUuid =
      process.env.SENTRY_EXPECTED_INSTALLATION_UUID;
    const expectedProjectId = process.env.SENTRY_EXPECTED_PROJECT_ID;
    const deploymentEnvironment = process.env.LINEJAM_DEPLOY_ENVIRONMENT;
    if (
      (deploymentEnvironment !== 'preview' &&
        deploymentEnvironment !== 'production') ||
      !secret ||
      expectedAppId !== '160944' ||
      !expectedInstallationUuid ||
      !expectedProjectId ||
      request.headers.get('Sentry-Hook-Resource') !== 'event_alert' ||
      request.headers.get('Content-Type')?.split(';', 1)[0].trim() !==
        'application/json'
    ) {
      return fixedError(400);
    }

    let projection: WebhookProjection | null = null;
    try {
      const body = await readBoundedBody(request);
      const signature = request.headers.get('Sentry-Hook-Signature');
      if (
        body &&
        signature &&
        (await verifySentrySignature(body, signature, secret))
      ) {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(body);
        // SAFETY: JSON.parse output from cryptographically verified webhook payload is decoded and field-checked in projectSentryWebhook.
        const parsed = JSON.parse(decoded) as SentryWebhookPayload;
        projection = projectSentryWebhook(
          parsed,
          request.headers.get('Request-ID'),
          expectedInstallationUuid,
          expectedProjectId
        );
      }
    } catch {
      projection = null;
    }
    if (!projection) return fixedError(400);

    try {
      const disposition = await ctx.runAction(admitWebhookRef, projection);
      if (disposition !== 'accepted' && disposition !== 'rejected') {
        return fixedError(503);
      }
      return new Response(null, {
        status: 202,
        headers: { 'Cache-Control': 'no-store' },
      });
    } catch {
      return fixedError(503);
    }
  }),
});

http.route({
  path: '/api/agents/sentry',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.SENTRY_AGENT_LOOP_SECRET;
    const webhookSecret = process.env.SENTRY_WEBHOOK_SECRET;
    if (
      process.env.LINEJAM_DEPLOY_ENVIRONMENT !== 'production' ||
      !secret ||
      secret.length < 32 ||
      secret === webhookSecret ||
      request.headers.get('Content-Type')?.split(';', 1)[0].trim() !==
        'application/json'
    ) {
      return fixedAgentError(401);
    }

    let projection: AgentRequest | null = null;
    try {
      const body = await readBoundedBody(request, SENTRY_AGENT_MAX_BODY_BYTES);
      const timestamp = request.headers.get('Linejam-Agent-Timestamp');
      const signature = request.headers.get('Linejam-Agent-Signature');
      if (
        body &&
        timestamp &&
        signature &&
        (await verifyAgentSignature(timestamp, body, signature, secret))
      ) {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(body);
        // SAFETY: projectAgentRequest validates the parsed object's action and identifier fields against closed vocabularies before use.
        const parsed = JSON.parse(decoded) as AgentRequestPayload;
        projection = projectAgentRequest(parsed);
      }
    } catch {
      projection = null;
    }
    if (!projection) return fixedAgentError(400);

    try {
      const now = Date.now();
      if (projection.action === 'claim') {
        const claim = await ctx.runMutation(claimAgentReceiptRef, {
          leaseId: projection.leaseId,
          now,
        });
        if (!claim) {
          return new Response(null, {
            status: 204,
            headers: { 'Cache-Control': 'no-store' },
          });
        }
        return Response.json(claim, {
          status: 200,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
      if (projection.action === 'authorize') {
        const authorized = await ctx.runQuery(authorizeAgentReceiptRef, {
          receiptId: projection.receiptId,
          leaseId: projection.leaseId,
          now,
        });
        if (!authorized) return fixedAgentError(409);
        return new Response(null, {
          status: 204,
          headers: { 'Cache-Control': 'no-store' },
        });
      }

      const completed = await ctx.runMutation(completeAgentReceiptRef, {
        receiptId: projection.receiptId,
        leaseId: projection.leaseId,
        outcome: projection.outcome,
        now,
      });
      if (!completed) return fixedAgentError(409);
      return new Response(null, {
        status: 202,
        headers: { 'Cache-Control': 'no-store' },
      });
    } catch {
      return fixedAgentError(503);
    }
  }),
});

export default http;
