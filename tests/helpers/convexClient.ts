import { ConvexReactClient } from 'convex/react';

/**
 * Creates a real, inert Convex client for provider tests.
 *
 * ConvexReactClient opens its transport lazily, so tests can replace only the
 * exercised public methods with spies before rendering without creating a
 * network connection or fabricating the client's private state.
 */
export function createTestConvexClient(): ConvexReactClient {
  return new ConvexReactClient('https://test.linejam.invalid', {
    logger: false,
    unsavedChangesWarning: false,
  });
}
