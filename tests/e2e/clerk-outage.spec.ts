import { expect, test } from '@playwright/test';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import { isolateGuestSessionIp } from './support/guestFlow';

type CanaryErrorPayload = {
  error_class?: string;
  message?: string;
  context?: { operation?: string };
};

test.describe('Clerk frontend outage', () => {
  test('guest Host and Join fail open and report the bounded fallback', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await isolateGuestSessionIp(context);
    const alerts: CanaryErrorPayload[] = [];
    const abortedClerkScriptRequests: string[] = [];

    // Match Clerk's runtime script path rather than a configured hostname so
    // the same doctor covers custom-domain production keys and
    // <slug>.clerk.accounts.dev development keys.
    await context.route('**/npm/@clerk/**', (route) => {
      abortedClerkScriptRequests.push(route.request().url());
      return route.abort('failed');
    });
    await context.route('**/api/v1/errors', async (route) => {
      const body = route.request().postData();
      if (body) alerts.push(JSON.parse(body) as CanaryErrorPayload);
      await route.fulfill({ status: 202, body: '' });
    });

    const page = await context.newPage();

    try {
      await page.goto('/host');
      await expect(page.getByTestId(E2E_TEST_IDS.hostNameInput)).toBeVisible({
        timeout: 8_000,
      });
      expect(abortedClerkScriptRequests.length).toBeGreaterThan(0);

      await expect
        .poll(
          () =>
            alerts.some(
              (payload) =>
                payload.error_class === 'ClerkLoadTimeoutError' &&
                payload.message ===
                  'Clerk did not load in time; continuing with guest play' &&
                payload.context?.operation === 'clerkLoadTimeout'
            ),
          { timeout: 8_000 }
        )
        .toBe(true);

      await page.goto('/join');
      await expect(
        page.getByTestId(E2E_TEST_IDS.joinRoomCodeInput)
      ).toBeVisible({ timeout: 8_000 });
      await expect(page.getByTestId(E2E_TEST_IDS.joinNameInput)).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
