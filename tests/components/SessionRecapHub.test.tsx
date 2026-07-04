// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Id } from '@/convex/_generated/dataModel';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  }) => {
    const prefetchProps =
      prefetch === undefined ? {} : { 'data-prefetch': String(prefetch) };

    return (
      <a href={href} {...prefetchProps} {...props}>
        {children}
      </a>
    );
  },
}));

const mockTrackRoomInviteShared = vi.fn();

vi.mock('@/lib/analytics', () => ({
  trackRoomInviteShared: (props: unknown) => mockTrackRoomInviteShared(props),
}));

const mockEnablePublicSessionRecapShare = vi.fn().mockResolvedValue(undefined);
const mockSessionFavorites = vi.fn();
vi.mock('convex/react', () => ({
  useMutation: () => mockEnablePublicSessionRecapShare,
  useQuery: () => mockSessionFavorites(),
}));

import { SessionRecapHub } from '@/components/SessionRecapHub';

describe('SessionRecapHub', () => {
  let originalClipboard: Clipboard;
  let originalLocation: Location;
  let originalShare: Navigator['share'];
  const defaultProps = {
    roomCode: 'ABCD',
    playerCount: 2,
    onStartNextRound: vi.fn(),
    onBackToLobby: vi.fn(),
    poems: [
      {
        _id: 'poem_2' as Id<'poems'>,
        indexInRoom: 1,
        preview: '',
        readerName: 'Bob',
      },
      {
        _id: 'poem_1' as Id<'poems'>,
        indexInRoom: 0,
        preview: 'The moon hums',
        readerName: 'Alice',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockEnablePublicSessionRecapShare.mockResolvedValue(undefined);
    // Default: no hearts given → no room-favorite crown
    mockSessionFavorites.mockReturnValue(null);
    originalClipboard = navigator.clipboard;
    originalLocation = window.location;
    originalShare = navigator.share;

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(navigator, 'share', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn(),
      configurable: true,
    });

    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://example.com',
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
    });
    Object.defineProperty(navigator, 'share', {
      value: originalShare,
      configurable: true,
    });
    localStorage.clear();
  });

  it('renders sorted poem replay links and host controls', async () => {
    const user = userEvent.setup();
    render(<SessionRecapHub {...defaultProps} />);

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

  it('copies the session recap link when native share is unavailable', async () => {
    const user = userEvent.setup();
    render(<SessionRecapHub {...defaultProps} playerCount={1} />);

    await user.click(
      screen.getByRole('button', { name: /Share the whole set/i })
    );

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
      expect(screen.getByText('1 poet')).toBeInTheDocument();
      expect(mockEnablePublicSessionRecapShare).toHaveBeenCalledWith({
        roomCode: 'ABCD',
        guestToken: undefined,
      });
      expect(mockTrackRoomInviteShared).toHaveBeenCalledWith({
        method: 'clipboard',
        roomCode: 'ABCD',
      });
    });
  });

  it('uses native share when the browser supports it', async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: nativeShare,
      writable: true,
      configurable: true,
    });
    const user = userEvent.setup();

    render(
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

    render(<SessionRecapHub {...defaultProps} />);

    const crown = screen.getByText(/Room favorite/i).closest('.border-primary');
    expect(crown).toBeInTheDocument();
    expect(screen.getByTestId('room-favorite-crown')).toHaveClass(
      'animate-crown-settle'
    );
    expect(screen.getByText(/3 hearts/i)).toBeInTheDocument();
    // The crowned poem's preview appears inside the crown card
    expect(crown).toHaveTextContent(/The moon hums/i);
  });

  it('shows no crown when the room gave no hearts', () => {
    mockSessionFavorites.mockReturnValue({
      counts: [],
      totalHearts: 0,
      leaderPoemId: null,
      leaderCount: 0,
    });

    render(<SessionRecapHub {...defaultProps} />);

    expect(screen.queryByText(/Room favorite/i)).not.toBeInTheDocument();
  });

  it('lets anyone in the room continue (no host gating)', async () => {
    // A vanished host must never strand the recap: every participant gets
    // the continuation controls.
    const user = userEvent.setup();
    render(<SessionRecapHub {...defaultProps} />);

    const startButton = screen.getByRole('button', {
      name: 'Start Next Round',
    });
    const lobbyButton = screen.getByRole('button', { name: 'Back to Lobby' });
    expect(startButton).toBeInTheDocument();
    expect(lobbyButton).toBeInTheDocument();

    // No "wait for the host" guidance remains
    expect(
      screen.queryByText(/while the host starts the next round/i)
    ).not.toBeInTheDocument();

    await user.click(startButton);
    expect(defaultProps.onStartNextRound).toHaveBeenCalledTimes(1);
  });
});
