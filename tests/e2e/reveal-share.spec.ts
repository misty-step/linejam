import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

import {
  CANONICAL_GUEST_FLOW_LINES,
  GuestFlowSession,
} from '@/tests/e2e/support/guestFlow';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';

const missingGuestTokenSecret =
  !process.env.GUEST_TOKEN_SECRET && !process.env.E2E_BASE_URL;
test.skip(
  missingGuestTokenSecret,
  'Set GUEST_TOKEN_SECRET for local E2E, or E2E_BASE_URL for a remote target'
);

test('mobile reveal ceremony produces a one-tap shareable recap artifact', async ({
  browser,
  request,
}, testInfo) => {
  const evidenceDir =
    process.env.LINEJAM_PRODUCT_EVIDENCE_DIR ??
    testInfo.outputPath('linejam-product-evidence');
  await mkdir(evidenceDir, { recursive: true });

  const session = await GuestFlowSession.create(browser, {
    guestName: 'Guest Poet',
    hostName: 'Host Poet',
    recordHostVideoDir: evidenceDir,
    viewport: { width: 390, height: 844 },
  });

  try {
    await session.hostContext.grantPermissions(['clipboard-write']);

    const roomCode = await session.createRoom();
    await session.joinRoom();
    await session.startGame();

    await expect(
      session.hostPage.getByText(/You only see one carried line/i)
    ).toBeVisible();
    await session.capture(
      'host',
      `${evidenceDir}/mobile-writing-coachmark.png`
    );

    await session.playCanonicalGame(CANONICAL_GUEST_FLOW_LINES);

    await session.hostPage
      .getByRole('button', { name: /Reveal & Read/i })
      .click();
    await expect(
      session.hostPage.getByRole('button', { name: /Mute ceremony sound/i })
    ).toBeVisible();
    await expect(session.hostPage.getByText('poetry').first()).toBeVisible({
      timeout: 10000,
    });
    await expect(session.hostPage.getByText('end').first()).toBeVisible({
      timeout: 12000,
    });
    await session.capture('host', `${evidenceDir}/mobile-reveal-ceremony.png`);
    await session.hostPage
      .getByRole('button', { name: /Favorite this poem/i })
      .click();
    // "Close" became the plain-verb "Done" (DESIGN.md Law 4); target the
    // stable testid so future copy changes can't strand this spec.
    await session.hostPage.getByTestId(E2E_TEST_IDS.poemDoneButton).click();

    await session.revealAssignedPoem('guest', CANONICAL_GUEST_FLOW_LINES);

    await expect(
      session.hostPage.getByRole('heading', { name: /Session complete/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      session.hostPage.getByTestId('room-favorite-crown')
    ).toBeVisible();
    await expect(
      session.hostPage.getByRole('button', { name: /Share the whole set/i })
    ).toHaveCount(1);
    await expect(
      session.hostPage.getByRole('link', { name: /Open Shared Recap/i })
    ).toHaveCount(0);
    await session.capture('host', `${evidenceDir}/mobile-session-recap.png`);

    await session.hostPage
      .getByRole('button', { name: /Share the whole set/i })
      .click();
    await expect(session.hostPage.getByText(/Copied!|Shared!/i)).toBeVisible({
      timeout: 10000,
    });

    const baseUrl = new URL(session.hostPage.url()).origin;
    const ogResponse = await request.get(
      `${baseUrl}/recap/${roomCode}/opengraph-image`
    );
    expect(ogResponse.ok()).toBe(true);
    expect(ogResponse.headers()['content-type']).toContain('image/png');

    const ogImage = await ogResponse.body();
    const ogPath = `${evidenceDir}/recap-opengraph-image.png`;
    await writeFile(ogPath, ogImage);
    await testInfo.attach('recap-opengraph-image', {
      body: ogImage,
      contentType: 'image/png',
    });
  } finally {
    const video = session.recordedHostVideo;
    await session.close();
    if (video) {
      await testInfo.attach('host-mobile-video', {
        path: await video.path(),
        contentType: 'video/webm',
      });
    }
  }
});
