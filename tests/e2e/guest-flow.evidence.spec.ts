import { promises as fs } from 'node:fs';
import path from 'node:path';

import { test } from '@playwright/test';

import {
  CANONICAL_GUEST_FLOW_LINES,
  GuestFlowSession,
  GUEST_FLOW_EVIDENCE_FILES,
} from '@/tests/e2e/support/guestFlow';

type GuestFlowEvidenceResult = {
  baseUrl: string;
  checks: string[];
  flowError: string | null;
  rawVideoPath: string | null;
  roomCode: string;
  runtimeErrors: string[];
  screenshots: string[];
};

test.describe.configure({ mode: 'serial' });

const missingGuestTokenSecret =
  !process.env.GUEST_TOKEN_SECRET && !process.env.E2E_BASE_URL;

test.skip(
  missingGuestTokenSecret,
  'Set GUEST_TOKEN_SECRET for local E2E, or E2E_BASE_URL for a remote target'
);

test('captures canonical guest-flow evidence @evidence', async ({
  browser,
}, testInfo) => {
  const outDir = process.env.LINEJAM_EVIDENCE_DIR;
  const resultFile = process.env.LINEJAM_EVIDENCE_RESULT_FILE;

  if (!outDir || !resultFile) {
    throw new Error(
      'Set LINEJAM_EVIDENCE_DIR and LINEJAM_EVIDENCE_RESULT_FILE before running guest-flow evidence.'
    );
  }

  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(path.join(outDir, 'raw-video'), { recursive: true });

  const runtimeErrors: string[] = [];
  const checks: string[] = [];
  const screenshots: string[] = [];
  let session: GuestFlowSession | null = null;
  let flowError: Error | null = null;

  try {
    session = await GuestFlowSession.create(browser, {
      recordHostVideoDir: path.join(outDir, 'raw-video'),
      runtimeErrors,
    });
    const activeSession = session;

    await activeSession.createRoom();
    checks.push('Host can create a room and land in the lobby.');
    screenshots.push(
      path.basename(
        await activeSession.capture(
          'host',
          path.join(outDir, GUEST_FLOW_EVIDENCE_FILES.hostLobby)
        )
      )
    );

    await activeSession.openHelpModal();
    checks.push('Lobby help modal opens from room chrome.');
    screenshots.push(
      path.basename(
        await activeSession.capture(
          'host',
          path.join(outDir, GUEST_FLOW_EVIDENCE_FILES.helpModal)
        )
      )
    );
    await activeSession.closeHelpModal();

    await activeSession.chooseHyperTheme();
    checks.push(
      'Theme picker can switch the room to Hyper without breaking the lobby.'
    );
    screenshots.push(
      path.basename(
        await activeSession.capture(
          'host',
          path.join(outDir, GUEST_FLOW_EVIDENCE_FILES.themeHyperLobby)
        )
      )
    );

    await activeSession.joinRoom();
    checks.push(
      'Guest can join from a separate browser context and appears in real time.'
    );
    screenshots.push(
      path.basename(
        await activeSession.capture(
          'host',
          path.join(outDir, GUEST_FLOW_EVIDENCE_FILES.twoPlayerLobby)
        )
      )
    );

    await activeSession.startGame();
    checks.push('Host can start a live 2-player game.');

    await activeSession.verifyRoundOneValidation('host');
    checks.push(
      'Word-count validation disables invalid submissions and enables exact matches.'
    );
    screenshots.push(
      path.basename(
        await activeSession.capture(
          'host',
          path.join(outDir, GUEST_FLOW_EVIDENCE_FILES.writingValid)
        )
      )
    );

    await activeSession.playCanonicalGame(CANONICAL_GUEST_FLOW_LINES, {
      onHostWaiting: async (roundIndex) => {
        if (roundIndex !== 0) {
          return;
        }

        screenshots.push(
          path.basename(
            await activeSession.capture(
              'host',
              path.join(outDir, GUEST_FLOW_EVIDENCE_FILES.waiting)
            )
          )
        );
      },
    });
    checks.push(
      'A full 9-round game reaches the reading phase for both players.'
    );

    await activeSession.revealAssignedPoem('host', CANONICAL_GUEST_FLOW_LINES);
    screenshots.push(
      path.basename(
        await activeSession.capture(
          'host',
          path.join(outDir, GUEST_FLOW_EVIDENCE_FILES.reveal)
        )
      )
    );

    await activeSession.revealAssignedPoem('guest', CANONICAL_GUEST_FLOW_LINES);
    await activeSession.expectSessionComplete();
    checks.push('Both players can finish reveal and reach Session Complete.');
    screenshots.push(
      path.basename(
        await session.capture(
          'host',
          path.join(outDir, GUEST_FLOW_EVIDENCE_FILES.sessionComplete)
        )
      )
    );
  } catch (error) {
    flowError = error instanceof Error ? error : new Error(String(error));
  } finally {
    try {
      await session?.close();
    } catch (error) {
      const closeError =
        error instanceof Error ? error : new Error(String(error));

      if (!flowError) {
        flowError = closeError;
      } else {
        runtimeErrors.push(`[teardown] ${closeError.message}`);
      }
    }

    const hostVideo = session?.recordedHostVideo ?? null;
    let rawVideoPath: string | null = null;

    if (hostVideo) {
      try {
        rawVideoPath = await hostVideo.path();
      } catch (error) {
        runtimeErrors.push(
          `[artifact] ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    const result: GuestFlowEvidenceResult = {
      baseUrl: (testInfo.project.use.baseURL as string | undefined) ?? '',
      checks,
      flowError: flowError?.message ?? null,
      rawVideoPath,
      roomCode: session?.roomCode ?? '',
      runtimeErrors,
      screenshots,
    };

    await fs.writeFile(
      resultFile,
      `${JSON.stringify(result, null, 2)}\n`,
      'utf8'
    );
  }

  if (flowError) {
    throw flowError;
  }
});
