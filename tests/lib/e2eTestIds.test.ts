import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { E2E_TEST_IDS } from '@/lib/e2eTestIds';

const EXPECTED_TEST_IDS = {
  hostNameInput: 'host-name-input',
  hostCreateRoomButton: 'host-create-room-button',
  joinRoomCodeInput: 'join-room-code-input',
  joinNameInput: 'join-name-input',
  joinRoomButton: 'join-room-button',
  joinErrorAlert: 'join-error-alert',
  hostErrorAlert: 'host-error-alert',
  lobbyStartGameButton: 'lobby-start-game-button',
  lobbyWaitingForHostButton: 'lobby-waiting-for-host-button',
  lobbyPresentationButton: 'lobby-presentation-button',
  lobbyPresentationStage: 'lobby-presentation-stage',
  writingPhase: 'writing-phase',
  writingLineInput: 'writing-line-input',
  writingWordSlots: 'writing-word-slots',
  writingSubmitLineButton: 'writing-submit-line-button',
  waitingPhase: 'waiting-phase',
  revealPhase: 'reveal-phase',
  revealPoemButton: 'reveal-poem-button',
  revealPresentationButton: 'reveal-presentation-button',
  revealPresentationStage: 'reveal-presentation-stage',
  revealStageNextLineButton: 'reveal-stage-next-line-button',
  poemActions: 'poem-actions',
  poemDoneButton: 'poem-done-button',
  sessionComplete: 'session-complete',
  roomFavoriteCrown: 'room-favorite-crown',
  sessionRecapShareButton: 'session-recap-share-button',
  poemSaveImageButton: 'poem-save-image-button',
  recapExportButton: 'recap-export-button',
} as const;

const SOURCE_FILES = [
  'app/host/page.tsx',
  'app/join/page.tsx',
  'components/Lobby.tsx',
  'components/stage/LobbyStage.tsx',
  'components/stage/RevealStage.tsx',
  'components/WritingScreen.tsx',
  'components/WaitingScreen.tsx',
  'components/RevealPhase.tsx',
  'components/PoemDisplay.tsx',
  'components/SessionRecapHub.tsx',
  'components/RecapExportButton.tsx',
  'components/ui/WordSlots.tsx',
];

describe('E2E selector contract', () => {
  it('keeps load-bearing selectors frozen', () => {
    expect(E2E_TEST_IDS).toEqual(EXPECTED_TEST_IDS);
  });

  it('binds every contract selector to source markup', () => {
    const source = SOURCE_FILES.map((path) => readFileSync(path, 'utf8')).join(
      '\n'
    );

    for (const key of Object.keys(EXPECTED_TEST_IDS)) {
      expect(source, `missing data-testid binding for ${key}`).toMatch(
        new RegExp(`(?:data-testid|testId)=\\{E2E_TEST_IDS\\.${key}\\}`)
      );
    }
  });
});
