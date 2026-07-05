import { test, expect, devices, type Page } from '@playwright/test';

/**
 * linejam-910 (application-floor real-engine tier b): smoke-load every
 * major page at desktop and ~390px mobile, asserting zero unexpected
 * console errors / pageerrors and at least one visible state per page.
 *
 * This is deliberately broad-and-shallow rather than deep: existing specs
 * (game-flow, auth, favorites, room-chrome-layout, ...) already cover
 * behavioral golden paths. This spec's job is coverage of the page
 * *surface* -- the class of bug the floor doctrine exists for is a page
 * that fails to even parse/render cleanly while every behavioral test
 * (which drives past the broken bit) stays green.
 */

const missingGuestTokenSecret = !process.env.GUEST_TOKEN_SECRET;
test.skip(
  missingGuestTokenSecret,
  'Set GUEST_TOKEN_SECRET for local E2E, or E2E_BASE_URL for a remote target'
);

const VIEWPORTS = [
  {
    name: 'desktop',
    contextOptions: { viewport: { width: 1440, height: 900 } },
  },
  { name: 'mobile', contextOptions: { ...devices['iPhone 14'] } },
] as const;

type PageCase = {
  path: string;
  /** What must be visible once the page has settled -- proves the page
   *  actually rendered its intended content, not just "didn't 500". */
  assertVisible: (page: Page) => Promise<void>;
};

const PAGES: PageCase[] = [
  {
    path: '/',
    assertVisible: async (page) => {
      await expect(
        page.getByRole('link', { name: /host/i }).first()
      ).toBeVisible();
    },
  },
  {
    path: '/host',
    assertVisible: async (page) => {
      await expect(page.locator('input#name')).toBeVisible();
    },
  },
  {
    path: '/join',
    assertVisible: async (page) => {
      await expect(page.locator('form')).toBeVisible();
    },
  },
  {
    path: '/releases',
    assertVisible: async (page) => {
      await expect(
        page.getByRole('heading', { name: /releases/i })
      ).toBeVisible();
    },
  },
  {
    path: '/poem/smoke-test-nonexistent-id',
    assertVisible: async (page) => {
      // Not-found shape: assert the page settled on *some* visible content
      // rather than a blank/crashed screen.
      await expect(page.locator('body')).not.toBeEmpty();
    },
  },
  {
    path: '/recap/ZZZZ',
    assertVisible: async (page) => {
      await expect(page.locator('body')).not.toBeEmpty();
    },
  },
  {
    path: '/me/poems',
    assertVisible: async (page) => {
      // Protected route: an unauthenticated guest must land somewhere other
      // than the raw /me/poems content -- redirected home or to sign-in --
      // never a blank/crashed protected page.
      await expect(page).not.toHaveURL(/\/me\/poems$/);
    },
  },
];

for (const { name, contextOptions } of VIEWPORTS) {
  test.describe(`major page smoke @ ${name}`, () => {
    for (const { path, assertVisible } of PAGES) {
      test(`${path} loads clean`, async ({ browser }) => {
        const context = await browser.newContext(contextOptions);
        const page = await context.newPage();

        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];
        page.on('console', (message) => {
          if (message.type() === 'error') consoleErrors.push(message.text());
        });
        page.on('pageerror', (error) => pageErrors.push(error.message));

        await page.goto(path, { waitUntil: 'networkidle' });
        await assertVisible(page);

        expect(pageErrors, `pageerror events on ${path}`).toEqual([]);
        expect(consoleErrors, `console.error messages on ${path}`).toEqual([]);

        await context.close();
      });
    }
  });
}
