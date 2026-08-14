import { makeFunctionReference } from 'convex/server';
import { httpRouter } from 'convex/server';
import type { Id } from './_generated/dataModel';
import { httpAction } from './_generated/server';
import { getConvexEnvHealthReport } from './lib/env';

export const SENTRY_WEBHOOK_MAX_BODY_BYTES = 256 * 1024;

type WebhookProjection = {
  dedupKey: string;
  installationUuid: string;
  projectId: string;
  sentryIssueId: string;
  sentryEventId: string;
};

const acceptWebhookRef = makeFunctionReference<
  'mutation',
  WebhookProjection,
  { receiptId: Id<'sentryGithubReceipts'>; inserted: boolean }
>('sentryGithub:acceptWebhook');

function fixedError(status: 400 | 503): Response {
  return new Response(status === 400 ? 'Invalid webhook' : 'Unavailable', {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

function decodeHexSignature(value: string): {
  bytes: Uint8Array;
  valid: boolean;
} {
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

function boundedId(
  value: unknown,
  pattern: RegExp,
  maximumLength: number
): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    value = String(value);
  }
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximumLength ||
    !pattern.test(value)
  ) {
    return null;
  }
  return value;
}

export function projectSentryWebhook(
  value: unknown,
  requestIdValue: string | null,
  expectedInstallationUuid: string,
  expectedProjectId: string
): WebhookProjection | null {
  if (!isRecord(value) || value.action !== 'triggered') return null;
  if (!isRecord(value.installation) || !isRecord(value.data)) return null;
  const event = value.data.event;
  if (!isRecord(event)) return null;

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
  return {
    dedupKey: `v1:${installationUuid}:${projectId}:${sentryIssueId}`,
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
        const parsed: unknown = JSON.parse(decoded);
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
      await ctx.runMutation(acceptWebhookRef, projection);
      return new Response(null, {
        status: 202,
        headers: { 'Cache-Control': 'no-store' },
      });
    } catch {
      return fixedError(503);
    }
  }),
});

export default http;
