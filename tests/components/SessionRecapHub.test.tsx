// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Id } from '@/convex/_generated/dataModel';
import {
  SessionRecapHub,
  type SessionRecapHubDependencies,
} from '@/components/SessionRecapHub';
import type { ShareLinkClient } from '@/hooks/useShareLink';

const mockEnablePublicSessionRecapShare = vi.fn().mockResolvedValue(null);
const mockSessionFavorites = vi.fn();
const mockTrackRoomInviteShared = vi.fn();
const mockTrackArtifactAction = vi.fn();
const mockWriteText = vi.fn().mockResolvedValue(undefined);
const shareClient: ShareLinkClient = {};
const shareDependencies: SessionRecapHubDependencies = {
  useEnablePublicShare: () => mockEnablePublicSessionRecapShare,
  useSessionFavorites: () => mockSessionFavorites(),
  shareClient,
  trackRoomInviteShared: mockTrackRoomInviteShared,
  trackArtifactAction: mockTrackArtifactAction,
  hashRoomId: () => 'test-room-hash',
  getRecapUrl: (roomCode) => `https://example.com/recap/${roomCode}`,
};

function renderSessionRecapHub(ui: React.ReactElement) {
  return render(ui);
}

describe('SessionRecapHub', () => {
  const defaultProps = {
    roomCode: 'ABCD',
    playerCount: 2,
    onStartNextRound: vi.fn(),
    onBackToLobby: vi.fn(),
    poems: [
      {
        // SAFETY: Synthetic Convex document id fixture for SessionRecapHub tests.
        _id: 'poem_2' as Id<'poems'>,
        indexInRoom: 1,
        preview: '',
        readerName: 'Bob',
      },
      {
        // SAFETY: Synthetic Convex document id fixture for SessionRecapHub tests.
        _id: 'poem_1' as Id<'poems'>,
        indexInRoom: 0,
        preview: 'The moon hums',
        readerName: 'Alice',
      },
    ],
    dependencies: shareDependencies,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockEnablePublicSessionRecapShare.mockResolvedValue(null);
    // Default: no hearts given → no room-favorite crown
    mockSessionFavorites.mockReturnValue(null);
    mockWriteText.mockResolvedValue(undefined);
    shareClient.writeClipboardText = mockWriteText;
    delete shareClient.nativeShare;

    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('offsets the headline scroll target below the sticky room chrome (linejam-946)', () => {
    renderSessionRecapHub(<SessionRecapHub {...defaultProps} />);

    const heading = screen.getByRole('heading', { name: 'Session complete' });
    expect(heading).toHaveClass('scroll-mt-28');
  });

  it('renders sorted poem replay links and host controls', async () => {
    const user = userEvent.setup();
    renderSessionRecapHub(<SessionRecapHub {...defaultProps} />);

    expect(screen.getByText('2 poems')).toBeInTheDocument();
    expect(screen.getByText('2 poets')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /Replay poem/i });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/poem/poem_1',
      '/poem/poem_2',
    ]);
    expect(
      screen.getByRole('link', { name: /Replay poem 2: Untitled poem/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Open Shared Recap/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start Next Round' }));
    await user.click(screen.getByRole('button', { name: 'Back to Lobby' }));

    expect(defaultProps.onStartNextRound).toHaveBeenCalledTimes(1);
    expect(defaultProps.onBackToLobby).toHaveBeenCalledTimes(1);
  });

  it('discloses recap publication before the share control', () => {
    renderSessionRecapHub(<SessionRecapHub {...defaultProps} />);

    const disclosure = screen.getByText(
      'Sharing makes the full session recap public to anyone with the link.'
    );
    const shareButton = screen.getByRole('button', {
      name: /Share the whole set/i,
    });
    expect(
      disclosure.compareDocumentPosition(shareButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('copies the session recap link when native share is unavailable', async () => {
    const user = userEvent.setup();
    renderSessionRecapHub(
      <SessionRecapHub {...defaultProps} playerCount={1} />
    );

    await user.click(
      screen.getByRole('button', { name: /Share the whole set/i })
    );

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
      expect(screen.getByText('1 poet')).toBeInTheDocument();
      expect(mockWriteText).toHaveBeenCalledWith(
        'https://example.com/recap/ABCD'
      );
      expect(mockEnablePublicSessionRecapShare).toHaveBeenCalledWith({
        roomCode: 'ABCD',
        guestToken: undefined,
      });
      expect(mockTrackRoomInviteShared).toHaveBeenCalledWith({
        method: 'clipboard',
        roomCode: 'ABCD',
      });
      expect(mockTrackArtifactAction).toHaveBeenCalledWith({
        roomIdHash: 'test-room-hash',
        cycle: 1,
        round: 8,
        action: 'share',
      });
    });
  });

  it('uses native share when the browser supports it', async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    shareClient.nativeShare = nativeShare;
    const user = userEvent.setup();

    renderSessionRecapHub(
      <SessionRecapHub
        {...defaultProps}
        isStartingNextRound
        error="Could not start a new round."
      />
    );

    expect(
      screen.getByText('Could not start a new round.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Starting...' })).toBeDisabled();

    await user.click(
      screen.getByRole('button', { name: /Share the whole set/i })
    );

    await waitFor(() => {
      expect(nativeShare).toHaveBeenCalledWith({
        title: 'Linejam session recap',
        text: 'Share the whole set from Linejam room ABCD.',
        url: 'https://example.com/recap/ABCD',
      });
      expect(mockEnablePublicSessionRecapShare).toHaveBeenCalledWith({
        roomCode: 'ABCD',
        guestToken: undefined,
      });
      expect(mockWriteText).not.toHaveBeenCalled();
      expect(screen.getByText('Shared!')).toBeInTheDocument();
      expect(mockTrackRoomInviteShared).toHaveBeenCalledWith({
        method: 'native-share',
        roomCode: 'ABCD',
      });
    });
  });

  it('crowns the room favorite when hearts were given', () => {
    mockSessionFavorites.mockReturnValue({
      counts: [
        { poemId: 'poem_1', indexInRoom: 0, count: 3 },
        { poemId: 'poem_2', indexInRoom: 1, count: 1 },
      ],
      totalHearts: 4,
      leaderPoemId: 'poem_1',
      leaderCount: 3,
    });

    renderSessionRecapHub(<SessionRecapHub {...defaultProps} />);

    const crown = screen.getByText(/Room favorite/i).closest('.border-primary');
    expect(crown).toBeInTheDocument();
    expect(screen.getByTestId('room-favorite-crown')).toHaveClass(
      'animate-crown-settle'
    );
    expect(screen.getByText(/3 hearts/i)).toBeInTheDocument();
    expect(crown).toHaveTextContent(/The moon hums/i);
  });

  it('shows no crown when the room gave no hearts', () => {
    mockSessionFavorites.mockReturnValue({
      counts: [],
      totalHearts: 0,
      leaderPoemId: null,
      leaderCount: 0,
    });

    renderSessionRecapHub(<SessionRecapHub {...defaultProps} />);

    expect(screen.queryByText(/Room favorite/i)).not.toBeInTheDocument();
  });

  it('does not re-punctuate the crown ceremony on an unrelated re-render', () => {
    mockSessionFavorites.mockReturnValue({
      counts: [{ poemId: 'poem_1', indexInRoom: 0, count: 3 }],
      totalHearts: 3,
      leaderPoemId: 'poem_1',
      leaderCount: 3,
    });

    const { rerender } = renderSessionRecapHub(
      <SessionRecapHub {...defaultProps} />
    );
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);

    rerender(<SessionRecapHub {...defaultProps} playerCount={3} />);
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);
  });

  it('shows the singular "heart" label when exactly one heart was given', () => {
    mockSessionFavorites.mockReturnValue({
      counts: [{ poemId: 'poem_1', indexInRoom: 0, count: 1 }],
      totalHearts: 1,
      leaderPoemId: 'poem_1',
      leaderCount: 1,
    });

    renderSessionRecapHub(<SessionRecapHub {...defaultProps} />);

    expect(screen.getByText(/1 heart\b/i)).toBeInTheDocument();
    expect(screen.queryByText(/1 hearts/i)).not.toBeInTheDocument();
  });

  it('falls back to "Untitled poem" when the crowned poem has no preview', () => {
    mockSessionFavorites.mockReturnValue({
      counts: [{ poemId: 'poem_2', indexInRoom: 1, count: 2 }],
      totalHearts: 2,
      leaderPoemId: 'poem_2',
      leaderCount: 2,
    });

    renderSessionRecapHub(<SessionRecapHub {...defaultProps} />);

    const crown = screen.getByText(/Room favorite/i).closest('.border-primary');
    expect(crown).toHaveTextContent(/Untitled poem/i);
  });

  it('shows the share error alone when there is no separate room error', async () => {
    mockEnablePublicSessionRecapShare.mockRejectedValueOnce(
      new Error('Network down')
    );
    const user = userEvent.setup();
    renderSessionRecapHub(<SessionRecapHub {...defaultProps} />);

    await user.click(
      screen.getByRole('button', { name: /Share the whole set/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText('Failed to share recap. Please try again.')
      ).toBeInTheDocument();
      expect(mockWriteText).toHaveBeenCalledWith(
        'https://example.com/recap/ABCD'
      );
      expect(mockTrackRoomInviteShared).not.toHaveBeenCalled();
      expect(mockTrackArtifactAction).not.toHaveBeenCalled();
    });
  });

  it('toggles ceremony sound and persists the preference across mount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSessionRecapHub(
      <SessionRecapHub {...defaultProps} />
    );

    const muteButton = screen.getByRole('button', {
      name: 'Mute ceremony sound',
    });
    expect(screen.getByText('Sound')).toBeInTheDocument();

    await user.click(muteButton);

    expect(
      screen.getByRole('button', { name: 'Turn ceremony sound on' })
    ).toBeInTheDocument();
    expect(screen.getByText('Muted')).toBeInTheDocument();
    expect(localStorage.getItem('linejam:ceremony-muted')).toBe('1');

    unmount();

    // A remount should read the persisted preference back as muted.
    renderSessionRecapHub(<SessionRecapHub {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: 'Turn ceremony sound on' })
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Turn ceremony sound on' })
    );

    expect(
      screen.getByRole('button', { name: 'Mute ceremony sound' })
    ).toBeInTheDocument();
    expect(screen.getByText('Sound')).toBeInTheDocument();
    expect(localStorage.getItem('linejam:ceremony-muted')).toBeNull();
  });

  it('lets anyone in the room continue (no host gating)', async () => {
    const user = userEvent.setup();
    renderSessionRecapHub(<SessionRecapHub {...defaultProps} />);

    const startButton = screen.getByRole('button', {
      name: 'Start Next Round',
    });
    const lobbyButton = screen.getByRole('button', { name: 'Back to Lobby' });
    expect(startButton).toBeInTheDocument();
    expect(lobbyButton).toBeInTheDocument();

    expect(
      screen.queryByText(/while the host starts the next round/i)
    ).not.toBeInTheDocument();

    await user.click(startButton);
    expect(defaultProps.onStartNextRound).toHaveBeenCalledTimes(1);
  });
});
