import { test, expect, devices, type Page } from '@playwright/test';
import { isolateGuestSessionIp } from './support/guestFlow';

/**
 * linejam-910 (application-floor): broad-and-shallow coverage of each
 * user-facing route at desktop and ~390px mobile. Existing E2E specs own
 * multi-step game, auth, and accessibility behavior; this matrix catches a
 * route that stops rendering cleanly before those flows can begin.
 *
 * The callback route is intentionally excluded: it is a Clerk hand-off
 * endpoint with no stable unauthenticated page state. It stays outside this
 * broad route matrix so its redirect/migration behavior remains a separate concern.
 *
 * Local pnpm dev emits one known React hydration diagnostic because the
 * development middleware nonce is regenerated between the server document
 * and the client refresh. The filter is disabled under CI so production
 * smoke remains strict for every console error.
 */

const missingGuestTokenSecret =
  !process.env.GUEST_TOKEN_SECRET && !process.env.E2E_BASE_URL;
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
  /** Proves the route rendered its intended state, not just a non-500 page. */
  assertVisible: (page: Page) => Promise<void>;
  expectedConsoleErrors?: RegExp[];
};

const PAGES: PageCase[] = [
  {
    path: '/',
    assertVisible: async (page) => {
      await expect(
        page.getByRole('heading', { name: /^Linejam$/ })
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
      await expect(page.locator('input#code')).toBeVisible();
    },
  },
  {
    path: '/releases',
    assertVisible: async (page) => {
      await expect(
        page.getByRole('heading', { name: /^Releases$/ })
      ).toBeVisible();
    },
  },
  {
    path: '/themes',
    assertVisible: async (page) => {
      await expect(page.getByTestId('themes-page')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /pick a look/i })
      ).toBeVisible();
    },
  },
  {
    path: '/sign-in',
    assertVisible: async (page) => {
      await expect(
        page.getByRole('heading', {
          name: /welcome back|authentication unavailable/i,
        })
      ).toBeVisible();
    },
  },
  {
    path: '/sign-up',
    assertVisible: async (page) => {
      await expect(
        page.getByRole('heading', {
          name: /join the jam|authentication unavailable/i,
        })
      ).toBeVisible();
    },
  },
  {
    path: '/poem/jh7eb5qfqeth6kmny4ppbwtsc58aqqc9',
    assertVisible: async (page) => {
      await expect(
        page.getByRole('heading', { name: /private or unavailable/i })
      ).toBeVisible();
    },
  },
  {
    path: '/recap/ZZZZ',
    // This route intentionally returns Next's 404 document. Chromium reports
    // that expected document status and Next dev's inline-script diagnostic;
    // no other console error is permitted.
    expectedConsoleErrors: [
      /Failed to load resource: the server responded with a status of 404 \(Not Found\)/,
      ...(process.env.CI
        ? []
        : [/Encountered a script tag while rendering React component/]),
    ],
    assertVisible: async (page) => {
      await expect(
        page.getByRole('heading', { name: /page not found/i })
      ).toBeVisible();
    },
  },
  {
    path: '/me/poems',
    assertVisible: async (page) => {
      await expect(
        page.getByRole('heading', { name: /^Archive$/ })
      ).toBeVisible();
    },
  },
  {
    path: '/me/profile',
    assertVisible: async (page) => {
      await expect(
        page.getByRole('heading', { name: /^Identity$/ })
      ).toBeVisible();
    },
  },
  {
    path: '/room/ZZZZ',
    assertVisible: async (page) => {
      await expect(
        page.getByText('Room not found', { exact: true })
      ).toBeVisible();
    },
  },
];

const expectedDevHydrationDiagnostic = process.env.CI
  ? undefined
  : /A tree hydrated but some attributes of the server rendered HTML didn't match the client properties/;
const expectedDevHydrationPageError = process.env.CI
  ? undefined
  : /Hydration failed because the server rendered HTML didn't match the client/;

for (const { name, contextOptions } of VIEWPORTS) {
  test.describe('major page smoke @ ' + name, () => {
    for (const { path, assertVisible, expectedConsoleErrors = [] } of PAGES) {
      test(path + ' loads clean', async ({ browser }) => {
        const context = await browser.newContext(contextOptions);
        await isolateGuestSessionIp(context);
        const page = await context.newPage();
        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];

        page.on('console', (message) => {
          if (message.type() === 'error') consoleErrors.push(message.text());
        });
        page.on('pageerror', (error) => pageErrors.push(error.message));

        try {
          await page.goto(path, { waitUntil: 'networkidle' });
          await assertVisible(page);

          const allowedConsoleErrors = [
            ...(expectedDevHydrationDiagnostic
              ? [expectedDevHydrationDiagnostic]
              : []),
            ...expectedConsoleErrors,
          ];
          const unexpectedConsoleErrors = consoleErrors.filter(
            (message) =>
              !allowedConsoleErrors.some((pattern) => pattern.test(message))
          );
          const unexpectedPageErrors = pageErrors.filter(
            (message) => !expectedDevHydrationPageError?.test(message)
          );
          expect(unexpectedPageErrors, 'pageerror events on ' + path).toEqual(
            []
          );
          expect(
            unexpectedConsoleErrors,
            'console.error messages on ' + path
          ).toEqual([]);
        } finally {
          await context.close();
        }
      });
    }
  });
}
