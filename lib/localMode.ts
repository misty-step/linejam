const LOOPBACK_HOSTS = {
  '127.0.0.1': true,
  localhost: true,
  '[::1]': true,
};

function isLocalOrigin(value: string | undefined, allowContainer: boolean) {
  if (!value || value !== value.trim()) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (Object.hasOwn(LOOPBACK_HOSTS, url.hostname) ||
        (allowContainer && url.hostname === 'convex')) &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

/** Public build flag; the server validates the matching private opt-in. */
export function isLocalBrowserMode(): boolean {
  if (process.env.NEXT_PUBLIC_LINEJAM_LOCAL !== '1') return false;
  if (!isLocalOrigin(process.env.NEXT_PUBLIC_CONVEX_URL, false)) {
    throw new Error('Local mode requires a loopback NEXT_PUBLIC_CONVEX_URL');
  }
  return true;
}

/** NODE_ENV=production is allowed for an isolated local production build. */
export function isLocalServerMode(): boolean {
  const serverLocal = process.env.LINEJAM_LOCAL === '1';
  const browserLocal = process.env.NEXT_PUBLIC_LINEJAM_LOCAL === '1';
  if (!serverLocal && !browserLocal) return false;
  if (
    !serverLocal ||
    !browserLocal ||
    process.env.LINEJAM_DEPLOY_ENVIRONMENT !== 'development' ||
    (process.env.CONVEX_DEPLOYMENT &&
      !process.env.CONVEX_DEPLOYMENT.startsWith('local:'))
  ) {
    throw new Error(
      'Local mode requires matching local flags and an isolated development deployment'
    );
  }
  isLocalBrowserMode();
  if (
    process.env.CONVEX_SERVER_URL &&
    !isLocalOrigin(process.env.CONVEX_SERVER_URL, true)
  ) {
    throw new Error('Local mode requires a local CONVEX_SERVER_URL');
  }
  return true;
}

/** Private transport override is supported only in the isolated local mode. */
export function getConvexServerUrl(): string | undefined {
  return isLocalServerMode()
    ? process.env.CONVEX_SERVER_URL || process.env.NEXT_PUBLIC_CONVEX_URL
    : process.env.NEXT_PUBLIC_CONVEX_URL;
}
