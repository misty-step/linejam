import { resolveService } from './service.mjs';
import { CANARY_AUTOMATION_EVENT_TYPES_QUERY } from './events.mjs';

const DEFAULT_ENDPOINT = 'https://canary.mistystep.io';
const DEFAULT_SERVICE = process.env.LINEJAM_CANARY_SERVICE || 'linejam';
const DEFAULT_TIMEOUT_MS = 5_000;

function getCanaryEndpoint() {
  return (
    process.env.CANARY_ENDPOINT?.trim() ||
    process.env.NEXT_PUBLIC_CANARY_ENDPOINT?.trim() ||
    DEFAULT_ENDPOINT
  ).replace(/\/$/, '');
}

function getCanaryApiKey() {
  return process.env.CANARY_API_KEY?.trim() || '';
}

function getContextTimeoutMs() {
  const parsed = Number.parseInt(
    process.env.LINEJAM_CANARY_CONTEXT_TIMEOUT_MS ||
      String(DEFAULT_TIMEOUT_MS),
    10
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

async function canaryGet(pathname, searchParams) {
  const apiKey = getCanaryApiKey();

  if (!apiKey) {
    throw new Error('CANARY_API_KEY is required for responder context fetches');
  }

  const url = new URL(`${getCanaryEndpoint()}${pathname}`);

  for (const [key, value] of Object.entries(searchParams)) {
    if (value) url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(getContextTimeoutMs()),
  });

  if (!response.ok) {
    throw new Error(
      `Canary API ${pathname} returned ${response.status} ${response.statusText}`.trim()
    );
  }

  return response.json();
}

export function filterIncidentsForService(
  incidents,
  service = DEFAULT_SERVICE
) {
  const rows = Array.isArray(incidents?.incidents) ? incidents.incidents : [];

  return {
    ...incidents,
    incidents: rows.filter((incident) => resolveService(incident) === service),
  };
}

export function filterReportForService(report, service = DEFAULT_SERVICE) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return report;
  }

  const next = { ...report };
  for (const key of ['error_groups', 'errorGroups', 'incidents']) {
    if (!Array.isArray(next[key])) {
      continue;
    }

    next[key] = next[key].filter((row) => resolveService(row) === service);
  }

  for (const key of ['recent_transitions', 'recentTransitions']) {
    if (!Array.isArray(next[key])) {
      continue;
    }

    next[key] = next[key].filter((row) => {
      const rowService = resolveService(row);
      return rowService === undefined || rowService === service;
    });
  }

  return next;
}

export async function fetchCanaryContext(service = DEFAULT_SERVICE) {
  const [report, timeline, incidents] = await Promise.all([
    canaryGet('/api/v1/report', { window: '1h' }),
    canaryGet('/api/v1/timeline', {
      service,
      window: '24h',
      event_type: CANARY_AUTOMATION_EVENT_TYPES_QUERY,
    }),
    canaryGet('/api/v1/incidents', {}),
  ]);

  return {
    service,
    report: filterReportForService(report, service),
    timeline,
    incidents: filterIncidentsForService(incidents, service),
  };
}
