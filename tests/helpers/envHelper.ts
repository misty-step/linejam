/**
 * Temporarily sets environment variables for a test, restoring original values after.
 * Useful for testing code that depends on environment configuration.
 *
 * @param envVars - Object mapping environment variable names to values
 * @param fn - Test function to run with modified environment
 * @returns Promise resolving to the test function's return value
 *
 * @example
 * ```typescript
 * await withEnv({ NODE_ENV: 'production' }, async () => {
 *   // Test code that reads process.env.NODE_ENV
 *   expect(process.env.NODE_ENV).toBe('production');
 * });
 * // NODE_ENV restored to original value
 * ```
 */
export async function withEnv<T>(
  envVars: Record<string, string | undefined>,
  fn: () => T | Promise<T>
): Promise<T> {
  const originalEnv: Record<string, string | undefined> = {};

  // Save original values
  for (const key of Object.keys(envVars)) {
    originalEnv[key] = process.env[key];
  }

  try {
    // Set new values
    for (const [key, value] of Object.entries(envVars)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    // Run test function
    return await fn();
  } finally {
    // Restore original values
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
