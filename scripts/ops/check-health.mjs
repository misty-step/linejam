#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

export const DEFAULT_HEALTH_URL = 'https://www.linejam.app/api/health';
export const DEFAULT_TIMEOUT_MS = 10_000;

export async function runHealthCheck({
  url = DEFAULT_HEALTH_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available in this Node runtime');
  }

  const response = await fetchWithTimeout(fetchImpl, url, timeoutMs);
  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Health check failed: HTTP ${response.status} from ${url}: ${truncate(bodyText)}`
    );
  }

  const body = parseHealthBody(bodyText);
  if (body.status !== 'ok') {
    throw new Error(
      `Health check failed: body status ${JSON.stringify(body.status)} from ${url}`
    );
  }

  return {
    ok: true,
    url,
    httpStatus: response.status,
    bodyStatus: body.status,
    convex: body.convex,
    observabilityStatus: body.observability?.status,
    timestamp: body.timestamp,
  };
}

async function fetchWithTimeout(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Health check timed out after ${timeoutMs}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseHealthBody(bodyText) {
  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error(
      `Health check failed: response was not JSON: ${truncate(bodyText)}`
    );
  }
}

function truncate(value) {
  if (!value) return '<empty>';
  return value.length > 500 ? `${value.slice(0, 500)}...` : value;
}

function readTimeoutMs() {
  const raw = process.env.LINEJAM_HEALTH_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : DEFAULT_TIMEOUT_MS;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runHealthCheck({
    url: process.env.LINEJAM_HEALTH_URL || DEFAULT_HEALTH_URL,
    timeoutMs: readTimeoutMs(),
  })
    .then((result) => {
      console.log(JSON.stringify(result));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
