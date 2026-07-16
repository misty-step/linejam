import { afterEach, beforeEach } from 'vitest';

const CANARY_ENV_PREFIXES = [
  'CANARY_',
  'NEXT_PUBLIC_CANARY_',
  'LINEJAM_CANARY_',
];

function isCanaryEnvKey(key: string) {
  return CANARY_ENV_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Remove ambient Canary configuration before each test and after cleanup. */
export function scrubAmbientCanaryEnv() {
  for (const key of Object.keys(process.env)) {
    if (isCanaryEnvKey(key)) {
      delete process.env[key];
    }
  }

  // The responder falls back to PORT, so an operator's shared dev port must
  // not change the test server's binding either.
  delete process.env.PORT;
}

/**
 * Keep Canary tests isolated from operator shell configuration. The module
 * side effect runs before sibling imports in each test file, while the hooks
 * cover values written by individual tests.
 */
scrubAmbientCanaryEnv();
beforeEach(scrubAmbientCanaryEnv);
afterEach(scrubAmbientCanaryEnv);

/**
 * Build a minimal environment for Canary subprocess tests. Only runtime
 * lookup paths are inherited; all Canary configuration must be explicit.
 */
export function buildCanarySubprocessEnv(
  overrides: Record<string, string | undefined> = {}
): NodeJS.ProcessEnv {
  const env = {} as NodeJS.ProcessEnv;

  for (const key of ['PATH', 'HOME', 'NODE_PATH', 'TMPDIR']) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }

  return env;
}
