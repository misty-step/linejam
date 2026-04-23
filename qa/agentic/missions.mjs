export const DEFAULT_AGENTIC_MISSION = 'guest-host-signed-in-join';
export const DEFAULT_LOCAL_BASE_URL = 'http://localhost:3000';

export const AGENTIC_MISSIONS = Object.freeze([
  {
    id: 'guest-host-signed-in-join',
    title: 'Guest host, signed-in joiner',
    requiresAuth: true,
    actors: ['guest-host', 'signed-in-joiner'],
    requiredScreenshots: ['host-lobby', 'signed-in-joined'],
    goal: 'A guest host creates a room and a signed-in Clerk user joins it without generic error UI.',
  },
  {
    id: 'signed-in-host-guest-join',
    title: 'Signed-in host, guest joiner',
    requiresAuth: true,
    actors: ['signed-in-host', 'guest-joiner'],
    requiredScreenshots: ['host-lobby', 'guest-joined'],
    goal: 'A signed-in Clerk host creates a room and a guest user joins it without generic error UI.',
  },
]);

export function listAgenticMissions() {
  return AGENTIC_MISSIONS.map((mission) => ({ ...mission }));
}

export function resolveAgenticMission(
  missionId = process.env.LINEJAM_AGENTIC_MISSION || DEFAULT_AGENTIC_MISSION
) {
  const mission = AGENTIC_MISSIONS.find(
    (candidate) => candidate.id === missionId
  );

  if (!mission) {
    throw new Error(
      `Unknown agentic QA mission: ${missionId}. Expected one of ${AGENTIC_MISSIONS.map(
        (candidate) => candidate.id
      ).join(', ')}.`
    );
  }

  return mission;
}

export function normalizeAgenticTarget(value = 'local') {
  const target = String(value).trim().toLowerCase();

  if (target === 'local' || target === 'preview') {
    return target;
  }

  throw new Error(
    `Unknown agentic QA target: ${value}. Expected local or preview.`
  );
}

export function resolveAgenticBaseUrl({
  baseUrl = process.env.PLAYWRIGHT_BASE_URL || process.env.LINEJAM_BASE_URL,
  target = 'local',
} = {}) {
  const resolvedTarget = normalizeAgenticTarget(target);
  const trimmedBaseUrl = typeof baseUrl === 'string' ? baseUrl.trim() : '';

  if (trimmedBaseUrl) {
    return trimTrailingSlash(trimmedBaseUrl);
  }

  if (resolvedTarget === 'local') {
    return DEFAULT_LOCAL_BASE_URL;
  }

  throw new Error(
    'PLAYWRIGHT_BASE_URL or --base-url is required for preview agentic QA runs.'
  );
}

export function assertAgenticMissionEnvironment(mission, env = process.env) {
  if (!mission.requiresAuth) {
    return;
  }

  const missing = [];
  if (!env.CLERK_SECRET_KEY?.trim()) {
    missing.push('CLERK_SECRET_KEY');
  }
  if (
    !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() &&
    !env.CLERK_PUBLISHABLE_KEY?.trim()
  ) {
    missing.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_PUBLISHABLE_KEY');
  }

  if (missing.length > 0) {
    throw new Error(
      `${mission.id} requires authenticated Clerk coverage. Set ${missing.join(
        ', '
      )} before running this mission.`
    );
  }
}

export function createAgenticRunId({
  missionId,
  now = new Date(),
  target = 'local',
}) {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `${stamp}-${target}-${missionId}`;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}
