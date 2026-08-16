// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import {
  RoomPage,
  type RoomPageDependencies,
} from '@/app/room/[code]/RoomPage';
import { ThemeProvider } from '@/lib/themes';
import {
  ConnectionStatus,
  type ConnectionStatusDependencies,
} from '@/components/ConnectionStatus';

const mockPush = vi.fn();
const mockUseRoomState = vi.fn();
const mockRetryAuth = vi.fn();
const mockUsePresence = vi.fn<RoomPageDependencies['usePresence']>();
const mockCaptureError = vi.fn<RoomPageDependencies['captureError']>();
const mockRouter = { push: mockPush };
let authError: string | null = null;
let writingPhaseFails = false;
let writingView: 'writing' | 'waiting' = 'writing';
let connectionState = {
  isWebSocketConnected: true,
  hasEverConnected: true,
  connectionRetries: 0,
};

const connectionDependencies: ConnectionStatusDependencies = {
  useConnectionState: () => connectionState,
};

function TestLobby() {
  return <div>Lobby view</div>;
}

function TestWritingScreen({
  roomCode,
  showChrome,
}: {
  roomCode: string;
  showChrome?: boolean;
}) {
  if (writingPhaseFails) {
    throw new Error('assignment query failed');
  }

  return (
    <>
      <span>1 word</span>
      <span>Write the first line.</span>
      <span>
        {writingView === 'waiting' ? 'Waiting view' : 'Writing view'} {roomCode}{' '}
        {showChrome ? 'chrome on' : 'chrome off'}
      </span>
    </>
  );
}

function TestRevealPhase({
  roomCode,
  showChrome,
}: {
  roomCode: string;
  showChrome?: boolean;
}) {
  return (
    <>
      <h1>The reading circle</h1>
      <span>
        Reveal view {roomCode} {showChrome ? 'chrome on' : 'chrome off'}
      </span>
    </>
  );
}

function TestConnectionStatus() {
  return <ConnectionStatus dependencies={connectionDependencies} />;
}

function createRoomState(status: 'LOBBY' | 'IN_PROGRESS' | 'COMPLETED') {
  return {
    room: {
      _id: 'room_1',
      _creationTime: Date.now(),
      code: 'ABCD',
      hostUserId: 'user_1',
      createdAt: Date.now(),
      status,
    },
    players: [],
    isHost: true,
  };
}

const dependencies: RoomPageDependencies = {
  useRouter: () => mockRouter,
  useUser: () => ({
    isLoading: false,
    guestToken: 'guest-token',
    authError,
    retryAuth: mockRetryAuth,
  }),
  useRoomState: () => mockUseRoomState(),
  usePresence: mockUsePresence,
  captureError: mockCaptureError,
  LobbyComponent: TestLobby,
  WritingScreenComponent: TestWritingScreen,
  RevealPhaseComponent: TestRevealPhase,
  ConnectionStatusComponent: TestConnectionStatus,
};

function renderRoomPage() {
  return render(
    <ThemeProvider>
      <RoomPage code="ABCD" dependencies={dependencies} />
    </ThemeProvider>
  );
}

describe('RoomPage', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    authError = null;
    writingPhaseFails = false;
    writingView = 'writing';
    connectionState = {
      isWebSocketConnected: true,
      hasEverConnected: true,
      connectionRetries: 0,
    };
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
    localStorage.clear();
  });

  it('keeps the missing-room state centered inside safe mobile spacing', async () => {
    mockUseRoomState.mockReturnValue(null);

    renderRoomPage();

    const title = await screen.findByText('Room not found');
    const detail = screen.getByText(/room code is incorrect/i);
    const recovery = screen.getByRole('button', { name: /return to join/i });
    expect(title.parentElement).toHaveClass('lj-safe-inline', 'text-center');
    expect(detail).toHaveClass('max-w-md');
    expect(recovery).toHaveClass('min-h-11', 'w-full');
    recovery.click();
    expect(mockPush).toHaveBeenCalledWith('/join');
  });

  it('renders an explicit recovery state when room status is unknown', async () => {
    mockUseRoomState.mockReturnValue({
      room: {
        code: 'ABCD',
        status: 'BROKEN_STATE',
      },
      players: [],
      isHost: false,
    });

    renderRoomPage();

    expect(
      await screen.findByText(/we lost track of this room state/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/this client received a state it does not understand/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /go home/i })
    ).toBeInTheDocument();
  });

  it('renders the shared auth recovery state when guest bootstrap fails', async () => {
    mockUseRoomState.mockReturnValue(undefined);
    authError = 'Unable to connect. Please check your connection.';

    renderRoomPage();

    await waitFor(() => {
      expect(screen.getByText(/connection error/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/unable to connect. please check your connection./i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /try again/i })
    ).toBeInTheDocument();
  });

  it('renders the room chrome copy for the lobby state', async () => {
    mockUseRoomState.mockReturnValue({
      room: {
        _id: 'room_1',
        _creationTime: Date.now(),
        code: 'ABCD',
        hostUserId: 'user_1',
        createdAt: Date.now(),
        status: 'LOBBY',
      },
      players: [
        {
          _id: 'player_1',
          _creationTime: Date.now(),
          roomId: 'room_1',
          userId: 'user_1',
          joinedAt: Date.now(),
          stableId: 'stable-1',
          displayName: 'Player 1',
        },
      ],
      isHost: true,
    });

    renderRoomPage();

    expect(await screen.findByText(/Room AB CD/i)).toBeInTheDocument();
    expect(screen.getByText(/need 1 more player/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAccessibleName(
      'Need 1 more player. Share AB CD to start.'
    );
  });

  it('routes in-progress rooms through the writing phase with shared chrome enabled', async () => {
    mockUseRoomState.mockReturnValue({
      room: {
        _id: 'room_1',
        _creationTime: Date.now(),
        code: 'ABCD',
        hostUserId: 'user_1',
        createdAt: Date.now(),
        status: 'IN_PROGRESS',
      },
      players: [],
      isHost: true,
    });

    renderRoomPage();

    expect(await screen.findByText('1 word')).toBeInTheDocument();
    expect(screen.getByText('Write the first line.')).toBeInTheDocument();
  });

  it('keeps a writing query failure inside the room panel fallback', async () => {
    writingPhaseFails = true;
    mockUseRoomState.mockReturnValue(createRoomState('IN_PROGRESS'));

    renderRoomPage();

    expect(
      await screen.findByText(/this room panel needs a refresh/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/failed while syncing live data/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Writing view ABCD chrome on/i)
    ).not.toBeInTheDocument();
  });

  it('recovers from a failed writing panel when the room moves to reveal', async () => {
    let status: 'IN_PROGRESS' | 'COMPLETED' = 'IN_PROGRESS';
    writingPhaseFails = true;
    mockUseRoomState.mockImplementation(() => createRoomState(status));

    const view = renderRoomPage();
    expect(
      await screen.findByText(/this room panel needs a refresh/i)
    ).toBeInTheDocument();

    status = 'COMPLETED';
    view.rerender(
      <ThemeProvider>
        <RoomPage code="ABCD" dependencies={dependencies} />
      </ThemeProvider>
    );

    expect(
      await screen.findByText(/Reveal view ABCD chrome on/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/this room panel needs a refresh/i)
    ).not.toBeInTheDocument();
  });

  it('routes completed rooms through the reveal phase with shared chrome enabled', async () => {
    mockUseRoomState.mockReturnValue({
      room: {
        _id: 'room_1',
        _creationTime: Date.now(),
        code: 'ABCD',
        hostUserId: 'user_1',
        createdAt: Date.now(),
        status: 'COMPLETED',
      },
      players: [],
      isHost: true,
    });

    renderRoomPage();

    expect(
      await screen.findByRole('heading', { name: /The reading circle/i })
    ).toBeInTheDocument();
  });

  it('keeps every room phase mounted across a transient disconnect', async () => {
    const phaseCases = [
      ['lobby', 'LOBBY', /Lobby view/i],
      ['writing', 'IN_PROGRESS', /Writing view ABCD chrome on/i],
      ['waiting', 'IN_PROGRESS', /Waiting view ABCD chrome on/i],
      ['reveal', 'COMPLETED', /Reveal view ABCD chrome on/i],
    ] as const;

    for (const [name, status, phaseCopy] of phaseCases) {
      writingView = name === 'waiting' ? 'waiting' : 'writing';
      mockUseRoomState.mockReturnValue(createRoomState(status));
      const view = renderRoomPage();
      expect(await screen.findByText(phaseCopy)).toBeInTheDocument();

      connectionState = {
        isWebSocketConnected: false,
        hasEverConnected: true,
        connectionRetries: 1,
      };
      act(() => window.dispatchEvent(new Event('offline')));
      view.rerender(
        <ThemeProvider>
          <RoomPage code="ABCD" dependencies={dependencies} />
        </ThemeProvider>
      );
      expect(screen.getByText(phaseCopy)).toBeInTheDocument();
      expect(screen.getByText(/you are offline/i)).toBeInTheDocument();

      connectionState = {
        isWebSocketConnected: true,
        hasEverConnected: true,
        connectionRetries: 0,
      };
      act(() => window.dispatchEvent(new Event('online')));
      view.rerender(
        <ThemeProvider>
          <RoomPage code="ABCD" dependencies={dependencies} />
        </ThemeProvider>
      );
      expect(screen.getByText(phaseCopy)).toBeInTheDocument();
      expect(
        await screen.findByText(/connection restored/i)
      ).toBeInTheDocument();
      view.unmount();
    }
  });
});
