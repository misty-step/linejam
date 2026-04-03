type ConvexEnvCheck = {
  configured: boolean;
  required: boolean;
};

const CONVEX_PRODUCTION_HOST = 'convex.cloud';

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getGuestTokenSecretFromEnv(): string | undefined {
  return readEnv('GUEST_TOKEN_SECRET');
}

export function getOpenRouterApiKeyFromEnv(): string | undefined {
  return readEnv('OPENROUTER_API_KEY');
}

export function isProductionConvexEnv(): boolean {
  return readEnv('CONVEX_CLOUD_URL')?.includes(CONVEX_PRODUCTION_HOST) ?? false;
}

export function getConvexEnvHealthReport() {
  const isProduction = isProductionConvexEnv();
  const checks: Record<string, ConvexEnvCheck> = {
    guestTokenSecret: {
      configured: !!getGuestTokenSecretFromEnv(),
      required: isProduction,
    },
    openRouterApiKey: {
      configured: !!getOpenRouterApiKeyFromEnv(),
      required: isProduction,
    },
  };

  const missing = Object.entries(checks)
    .filter(([, check]) => check.required && !check.configured)
    .map(([name]) => name);

  return {
    ok: missing.length === 0,
    status: missing.length === 0 ? 200 : 500,
    environment: isProduction ? 'production' : 'development',
    missing,
    checks,
  };
}
