import { expect, test } from '@playwright/test';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import { isolateGuestSessionIp } from './support/guestFlow';

const sentryEnvelopes: string[] = [];

test.describe('Clerk frontend outage', () => {
  test('guest Host and Join fail open and report the bounded fallback', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await isolateGuestSessionIp(context);
    sentryEnvelopes.length = 0;
    const abortedClerkScriptRequests: string[] = [];

    // Match Clerk's runtime script path rather than a configured hostname so
    // the same doctor covers custom-domain production keys and
    // <slug>.clerk.accounts.dev development keys.
    await context.route('**/npm/@clerk/**', (route) => {
      abortedClerkScriptRequests.push(route.request().url());
      return route.abort('failed');
    });
    await context.route('**/api/*/envelope/**', async (route) => {
      const body = route.request().postData();
      if (body) sentryEnvelopes.push(body);
      await route.fulfill({ status: 200, body: '' });
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
            sentryEnvelopes.some(
              (envelope) =>
                envelope.includes('ClerkLoadTimeoutError') &&
                envelope.includes(
                  'Clerk did not load in time; continuing with guest play'
                ) &&
                envelope.includes('clerkLoadTimeout')
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
