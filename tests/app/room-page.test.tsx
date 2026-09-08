// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  RoomPage,
  type RoomPageDependencies,
} from '@/app/room/[code]/RoomPage';
import { ColorModeProvider } from '@/lib/colorMode';
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
const roomActions = {
  endGame: vi.fn().mockResolvedValue(undefined),
  closeRoom: vi.fn().mockResolvedValue(undefined),
  leaveLobby: vi.fn().mockResolvedValue(undefined),
};
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

function TestWritingScreen({ roomCode }: { roomCode: string }) {
  if (writingPhaseFails) {
    throw new Error('assignment query failed');
  }

  return (
    <>
      <span>1 word</span>
      <span>Write the first line.</span>
      <span>
        {writingView === 'waiting' ? 'Waiting view' : 'Writing view'} {roomCode}
      </span>
    </>
  );
}

function TestRevealPhase({ roomCode }: { roomCode: string }) {
  return (
    <>
      <h1>The reading circle</h1>
      <span>Reveal view {roomCode}</span>
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
  useRoomActions: () => roomActions,
  usePresence: mockUsePresence,
  captureError: mockCaptureError,
  LobbyComponent: TestLobby,
  WritingScreenComponent: TestWritingScreen,
  RevealPhaseComponent: TestRevealPhase,
  ConnectionStatusComponent: TestConnectionStatus,
};

function renderRoomPage() {
  return render(
    <ColorModeProvider>
      <RoomPage code="ABCD" dependencies={dependencies} />
    </ColorModeProvider>
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

  it('offers join recovery when the requested room is missing', async () => {
    mockUseRoomState.mockReturnValue(null);

    renderRoomPage();

    const recovery = screen.getByRole('button', { name: /return to join/i });
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
    expect(screen.queryByText(/Writing view ABCD/i)).not.toBeInTheDocument();
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
      <ColorModeProvider>
        <RoomPage code="ABCD" dependencies={dependencies} />
      </ColorModeProvider>
    );

    expect(await screen.findByText(/Reveal view ABCD/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/this room panel needs a refresh/i)
    ).not.toBeInTheDocument();
  });

  it('keeps every room phase mounted across a transient disconnect', async () => {
    const phaseCases = [
      ['lobby', 'LOBBY', /Lobby view/i],
      ['writing', 'IN_PROGRESS', /Writing view ABCD/i],
      ['waiting', 'IN_PROGRESS', /Waiting view ABCD/i],
      ['reveal', 'COMPLETED', /Reveal view ABCD/i],
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
        <ColorModeProvider>
          <RoomPage code="ABCD" dependencies={dependencies} />
        </ColorModeProvider>
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
        <ColorModeProvider>
          <RoomPage code="ABCD" dependencies={dependencies} />
        </ColorModeProvider>
      );
      expect(screen.getByText(phaseCopy)).toBeInTheDocument();
      expect(
        await screen.findByText(/connection restored/i)
      ).toBeInTheDocument();
      view.unmount();
    }
  });

  it('limits active-game ending to the current host', async () => {
    const user = userEvent.setup();
    mockUseRoomState.mockReturnValue({
      ...createRoomState('IN_PROGRESS'),
      isHost: false,
    });
    const guest = renderRoomPage();
    await user.click(screen.getByRole('button', { name: 'Room options' }));
    expect(screen.queryByRole('button', { name: 'End game' })).toBeNull();
    guest.unmount();

    mockUseRoomState.mockReturnValue(createRoomState('IN_PROGRESS'));
    renderRoomPage();
    await user.click(screen.getByRole('button', { name: 'Room options' }));
    await user.click(screen.getByRole('button', { name: 'End game' }));
    expect(roomActions.endGame).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'End game' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(roomActions.endGame).toHaveBeenCalledWith({
      roomCode: 'ABCD',
      guestToken: 'guest-token',
    });
    expect(roomActions.closeRoom).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('lets a lobby guest leave without offering the host close operation', async () => {
    const user = userEvent.setup();
    mockUseRoomState.mockReturnValue({
      ...createRoomState('LOBBY'),
      isHost: false,
    });
    renderRoomPage();
    await user.click(screen.getByRole('button', { name: 'Room options' }));
    expect(screen.queryByRole('button', { name: 'Close room' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Leave room' }));
    expect(mockPush).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Leave room' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    expect(roomActions.leaveLobby).toHaveBeenCalledWith({
      roomCode: 'ABCD',
      guestToken: 'guest-token',
    });
    expect(roomActions.closeRoom).not.toHaveBeenCalled();
  });
});
