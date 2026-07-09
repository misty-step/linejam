import { log } from './errors';

type ConvexEnvironment = 'production' | 'development';
type CapabilityStatus = 'ready' | 'disabled' | 'missing_required';

type ConvexCapabilityHealth = {
  status: CapabilityStatus;
  available: boolean;
  required: boolean;
};

export type ConvexRuntimeConfig = {
  environment: ConvexEnvironment;
  guestTokenSecret?: string;
  openRouterApiKey?: string;
};

export type ConvexEnvHealthReport = {
  ok: boolean;
  status: 200 | 500;
  environment: ConvexEnvironment;
  capabilities: {
    guestTokenVerification: ConvexCapabilityHealth;
    aiLineGeneration: ConvexCapabilityHealth;
  };
};

const CONVEX_PRODUCTION_HOST = 'convex.cloud';

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readEnvironment(): ConvexEnvironment {
  return readEnv('CONVEX_CLOUD_URL')?.includes(CONVEX_PRODUCTION_HOST)
    ? 'production'
    : 'development';
}

function loadConvexRuntimeConfig(): ConvexRuntimeConfig {
  return {
    environment: readEnvironment(),
    guestTokenSecret: readEnv('GUEST_TOKEN_SECRET'),
    openRouterApiKey: readEnv('OPENROUTER_API_KEY'),
  };
}

function evaluateCapability(
  available: boolean,
  required: boolean
): ConvexCapabilityHealth {
  if (available) {
    return { status: 'ready', available: true, required };
  }

  if (required) {
    return { status: 'missing_required', available: false, required: true };
  }

  return { status: 'disabled', available: false, required: false };
}

const convexRuntimeConfig = Object.freeze(loadConvexRuntimeConfig());

if (
  convexRuntimeConfig.environment === 'production' &&
  !convexRuntimeConfig.openRouterApiKey
) {
  log.error('OPENROUTER_API_KEY not configured at module load', {
    source: 'convex/env',
  });
}

export function getConvexRuntimeConfig(): ConvexRuntimeConfig {
  return convexRuntimeConfig;
}

export function getConvexEnvHealthReport(): ConvexEnvHealthReport {
  const required = convexRuntimeConfig.environment === 'production';
  const guestTokenVerification = evaluateCapability(
    Boolean(convexRuntimeConfig.guestTokenSecret),
    required
  );
  const aiLineGeneration = evaluateCapability(
    Boolean(convexRuntimeConfig.openRouterApiKey),
    required
  );
  const ok =
    guestTokenVerification.status !== 'missing_required' &&
    aiLineGeneration.status !== 'missing_required';

  return {
    ok,
    status: ok ? 200 : 500,
    environment: convexRuntimeConfig.environment,
    capabilities: {
      guestTokenVerification,
      aiLineGeneration,
    },
  };
}
