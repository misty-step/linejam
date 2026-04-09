#!/usr/bin/env node

import { CANARY_AUTOMATION_EVENT_TYPES_JSON } from './events.mjs';

const endpoint =
  (process.env.CANARY_ENDPOINT || 'https://canary-obs.fly.dev')
    .trim()
    .replace(/\/$/, '');
const apiKey = process.env.CANARY_API_KEY?.trim() || '';
const webhookUrl = process.env.LINEJAM_CANARY_WEBHOOK_URL?.trim() || '';
const sendTest = process.env.CANARY_WEBHOOK_SEND_TEST === '1';

if (!apiKey) {
  throw new Error('CANARY_API_KEY is required');
}

if (!webhookUrl) {
  throw new Error('LINEJAM_CANARY_WEBHOOK_URL is required');
}

let desiredEvents;
try {
  desiredEvents = JSON.parse(
    process.env.CANARY_WEBHOOK_EVENTS || CANARY_AUTOMATION_EVENT_TYPES_JSON
  );
} catch (error) {
  throw new Error(
    `CANARY_WEBHOOK_EVENTS must be valid JSON: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
}

if (
  !Array.isArray(desiredEvents) ||
  desiredEvents.some((event) => typeof event !== 'string')
) {
  throw new Error('CANARY_WEBHOOK_EVENTS must be a JSON array of strings');
}

function normalizeUrl(value) {
  return value.trim().replace(/\/$/, '');
}

function eventKey(events) {
  return JSON.stringify([...events].sort());
}

async function canaryRequest(method, path, body) {
  const response = await fetch(`${endpoint}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      `Canary API ${method} ${path} returned ${response.status} ${response.statusText}: ${
        text || '<empty response>'
      }`
    );
  }

  return parsed;
}

const normalizedUrl = normalizeUrl(webhookUrl);
const desiredEventKey = eventKey(desiredEvents);
const listed = await canaryRequest('GET', '/api/v1/webhooks');
const webhooks = Array.isArray(listed?.webhooks) ? listed.webhooks : [];
const sameUrl = webhooks.filter((webhook) => {
  if (!webhook || typeof webhook !== 'object' || typeof webhook.url !== 'string') {
    return false;
  }

  return normalizeUrl(webhook.url) === normalizedUrl;
});

let status = 'existing';
let replacedIds = [];
let createdSecret = null;
let webhook;

const exactActive =
  sameUrl.length === 1 &&
  sameUrl[0]?.active === true &&
  Array.isArray(sameUrl[0]?.events) &&
  eventKey(sameUrl[0].events) === desiredEventKey;

if (exactActive) {
  webhook = sameUrl[0];
} else {
  replacedIds = sameUrl
    .map((candidate) => candidate?.id)
    .filter((id) => typeof id === 'string' && id.length > 0);

  for (const webhookId of replacedIds) {
    await canaryRequest('DELETE', `/api/v1/webhooks/${webhookId}`);
  }

  const created = await canaryRequest('POST', '/api/v1/webhooks', {
    url: webhookUrl,
    events: desiredEvents,
  });

  status = replacedIds.length > 0 ? 'replaced' : 'created';
  createdSecret = typeof created?.secret === 'string' ? created.secret : null;
  webhook = created;
}

let test = null;
if (sendTest) {
  test = await canaryRequest('POST', `/api/v1/webhooks/${webhook.id}/test`);
}

process.stdout.write(
  `${JSON.stringify(
    {
      status,
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        active: webhook.active ?? true,
        created_at: webhook.created_at ?? null,
      },
      replaced_ids: replacedIds,
      secret: createdSecret,
      test,
    },
    null,
    2
  )}\n`
);

if (createdSecret) {
  process.stderr.write(
    'Save the returned secret as LINEJAM_CANARY_WEBHOOK_SECRET.\n'
  );
}
