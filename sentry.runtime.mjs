/** @typedef {Record<string, string | undefined>} SentryEnvironment */

const SENTRY_ENVIRONMENTS = {
  development: true,
  preview: true,
  production: true,
  test: true,
};

const COMMIT_RELEASE = /^[a-f0-9]{40}$/;

function clean(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** @param {SentryEnvironment} [env] */
export function resolveSentryEnvironment(env = process.env) {
  const configured = clean(
    env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || env.LINEJAM_DEPLOY_ENVIRONMENT
  );
  if (configured && Object.hasOwn(SENTRY_ENVIRONMENTS, configured)) {
    return configured;
  }

  const nodeEnvironment = clean(env.NODE_ENV);
  return nodeEnvironment && Object.hasOwn(SENTRY_ENVIRONMENTS, nodeEnvironment)
    ? nodeEnvironment
    : 'development';
}

/** @param {SentryEnvironment} [env] */
export function resolveSentryRelease(env = process.env) {
  const release = clean(
    env.NEXT_PUBLIC_SENTRY_RELEASE || env.NEXT_DEPLOYMENT_ID
  );
  return release && COMMIT_RELEASE.test(release) ? release : undefined;
}

/**
 * Shared options for Next.js runtime entrypoints and plain Node monitor scripts.
 * Runtime entrypoints add their privacy hooks and bounded runtime tag.
 * @param {SentryEnvironment} [env]
 */
export function getSentryRuntimeOptions(env = process.env) {
  const dsn = clean(env.NEXT_PUBLIC_SENTRY_DSN);
  const ingestEnabled = env.NEXT_PUBLIC_SENTRY_ENABLED === '1';
  const environment = resolveSentryEnvironment(env);

  return {
    dsn,
    enabled: ingestEnabled && Boolean(dsn),
    environment,
    release: resolveSentryRelease(env),
    sendDefaultPii: false,
    enableLogs: false,
    tracesSampleRate:
      environment === 'preview' ? 1 : environment === 'production' ? 0.05 : 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  };
}
