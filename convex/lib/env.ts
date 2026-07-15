import { log } from './errors';
import convexEnvManifest from '../../config/convex-env-manifest.json';

type ConvexEnvironment = 'production' | 'preview' | 'development';
type CapabilityStatus = 'ready' | 'disabled' | 'missing_required';

type ConvexCapabilityHealth = {
  status: CapabilityStatus;
  available: boolean;
  required: boolean;
};

export type ConvexRuntimeConfig = {
  environment: ConvexEnvironment;
  deploymentMarkerValid: boolean;
  deploymentUrl?: string;
  guestTokenSecret?: string;
  openRouterApiKey?: string;
  requiredEnvironmentVariables: Readonly<Record<string, boolean>>;
};

export type ConvexEnvHealthReport = {
  ok: boolean;
  status: 200 | 500;
  environment: ConvexEnvironment;
  deployment: {
    markerValid: boolean;
    url: string | null;
  };
  capabilities: {
    guestTokenVerification: ConvexCapabilityHealth;
    aiLineGeneration: ConvexCapabilityHealth;
  };
  configuration: {
    missingRequired: string[];
  };
};

const DEV_GUEST_TOKEN_SECRET = 'dev-only-insecure-secret-change-in-production';

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readEnvironment(): {
  environment: ConvexEnvironment;
  markerValid: boolean;
} {
  const declared = readEnv('LINEJAM_DEPLOY_ENVIRONMENT');
  if (!declared) {
    return {
      environment: 'development',
      markerValid: !readEnv('CONVEX_CLOUD_URL'),
    };
  }
  if (
    declared === 'production' ||
    declared === 'preview' ||
    declared === 'development'
  ) {
    return { environment: declared, markerValid: true };
  }
  return { environment: 'development', markerValid: false };
}

function loadConvexRuntimeConfig(): ConvexRuntimeConfig {
  const { environment, markerValid: deploymentMarkerValid } = readEnvironment();
  const manifestEnvironment = environment;
  const requiredEnvironmentVariables = Object.fromEntries(
    convexEnvManifest.environments[manifestEnvironment].required.map((name) => [
      name,
      Boolean(readEnv(name)),
    ])
  );

  return {
    environment,
    deploymentMarkerValid,
    deploymentUrl: readEnv('CONVEX_CLOUD_URL'),
    guestTokenSecret: readEnv('GUEST_TOKEN_SECRET'),
    openRouterApiKey: readEnv('OPENROUTER_API_KEY'),
    requiredEnvironmentVariables: Object.freeze(requiredEnvironmentVariables),
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
  convexRuntimeConfig.environment !== 'development' &&
  !convexRuntimeConfig.openRouterApiKey
) {
  log.error('OPENROUTER_API_KEY not configured at module load', {
    source: 'convex/env',
  });
}

export function getConvexRuntimeConfig(): ConvexRuntimeConfig {
  return convexRuntimeConfig;
}

export function getConvexGuestTokenSecret(): string {
  if (convexRuntimeConfig.guestTokenSecret) {
    return convexRuntimeConfig.guestTokenSecret;
  }

  if (
    convexRuntimeConfig.environment !== 'development' ||
    convexRuntimeConfig.deploymentUrl
  ) {
    throw new Error(
      'GUEST_TOKEN_SECRET must be set in Convex environment. ' +
        'Set it on the current Convex deployment before retrying.'
    );
  }

  return DEV_GUEST_TOKEN_SECRET;
}

export function getConvexEnvHealthReport(): ConvexEnvHealthReport {
  const required = convexRuntimeConfig.environment !== 'development';
  const guestTokenVerification = evaluateCapability(
    Boolean(convexRuntimeConfig.guestTokenSecret),
    required
  );
  const aiLineGeneration = evaluateCapability(
    Boolean(convexRuntimeConfig.openRouterApiKey),
    required
  );
  const missingRequired = Object.entries(
    convexRuntimeConfig.requiredEnvironmentVariables
  )
    .filter(([, available]) => !available)
    .map(([name]) => name)
    .sort();
  const ok =
    convexRuntimeConfig.deploymentMarkerValid &&
    missingRequired.length === 0 &&
    guestTokenVerification.status !== 'missing_required' &&
    aiLineGeneration.status !== 'missing_required';

  return {
    ok,
    status: ok ? 200 : 500,
    environment: convexRuntimeConfig.environment,
    deployment: {
      markerValid: convexRuntimeConfig.deploymentMarkerValid,
      url: convexRuntimeConfig.deploymentUrl ?? null,
    },
    capabilities: {
      guestTokenVerification,
      aiLineGeneration,
    },
    configuration: {
      missingRequired,
    },
  };
}
