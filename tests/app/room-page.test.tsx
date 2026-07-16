// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { getFunctionName } from 'convex/server';

const mockReactUse = vi.fn();
const mockUseClerkUser = vi.fn();
const mockUseQuery = vi.fn();
const mockConnectionState = vi.fn();
const mockPush = vi.fn();
const mockPhaseFailure = vi.hoisted(() => ({
  writing: false,
  reveal: false,
}));
const mockWritingView = vi.hoisted(() => ({
  value: 'writing' as 'writing' | 'waiting',
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    use: (value: unknown) => mockReactUse(value),
  };
});

vi.mock('next/navigation', async () => {
  const actual =
    await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    useRouter: () => ({ push: mockPush }),
  };
});

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: () => vi.fn().mockResolvedValue(undefined),
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: false }),
  useConvexConnectionState: () => mockConnectionState(),
}));

vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseClerkUser(),
}));

vi.mock('@/components/Lobby', () => ({
  Lobby: () => <div>Lobby view</div>,
}));

vi.mock('@/components/WritingScreen', () => ({
  WritingScreen: ({
    roomCode,
    showChrome,
  }: {
    roomCode: string;
    showChrome?: boolean;
  }) => {
    if (mockPhaseFailure.writing) {
      throw new Error('assignment query failed');
    }

    return (
      <div>
        {mockWritingView.value === 'waiting' ? 'Waiting view' : 'Writing view'}{' '}
        {roomCode} {showChrome ? 'chrome on' : 'chrome off'}
      </div>
    );
  },
}));

vi.mock('@/components/RevealPhase', () => ({
  RevealPhase: ({
    roomCode,
    showChrome,
  }: {
    roomCode: string;
    showChrome?: boolean;
  }) => {
    if (mockPhaseFailure.reveal) {
      throw new Error('reveal query failed');
    }

    return (
      <div>
        Reveal view {roomCode} {showChrome ? 'chrome on' : 'chrome off'}
      </div>
    );
  },
}));

import RoomPage from '@/app/room/[code]/page';
import { ThemeProvider } from '@/lib/themes';

describe('RoomPage', () => {
  const originalFetch = global.fetch;
  const originalMatchMedia = window.matchMedia;
  let mockFetch: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    process.env.NEXT_PUBLIC_CANARY_API_KEY = '';
    mockPhaseFailure.writing = false;
    mockPhaseFailure.reveal = false;
    mockWritingView.value = 'writing';
    mockConnectionState.mockReturnValue({
      hasInflightRequests: false,
      isWebSocketConnected: true,
      timeOfOldestInflightRequest: null,
      hasEverConnected: true,
      connectionCount: 1,
      connectionRetries: 0,
      inflightMutations: 0,
      inflightActions: 0,
    });
    mockReactUse.mockReturnValue({ code: 'ABCD' });
    mockUseClerkUser.mockReturnValue({
      user: null,
      isLoaded: true,
    });
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ guestId: 'guest-123', token: 'guest-token' }),
    });
    global.fetch = mockFetch as typeof fetch;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
    consoleErrorSpy.mockRestore();
    localStorage.clear();
  });

  function renderRoomPage() {
    return render(
      <ThemeProvider>
        <RoomPage params={Promise.resolve({ code: 'ABCD' })} />
      </ThemeProvider>
    );
  }

  it('keeps the missing-room state centered inside safe mobile spacing', async () => {
    mockUseQuery.mockImplementation((query) => {
      const functionName = getFunctionName(
        query as Parameters<typeof getFunctionName>[0]
      );
      return functionName === 'rooms:getRoomState' ? null : undefined;
    });

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
    mockUseQuery.mockImplementation((query) => {
      const functionName = getFunctionName(
        query as Parameters<typeof getFunctionName>[0]
      );

      if (functionName === 'rooms:getRoomState') {
        return {
          room: {
            code: 'ABCD',
            status: 'BROKEN_STATE',
          },
          players: [],
          isHost: false,
        };
      }

      return null;
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
    mockUseQuery.mockImplementation((query) => {
      const functionName = getFunctionName(
        query as Parameters<typeof getFunctionName>[0]
      );
      if (functionName === 'rooms:getRoomState') {
        return undefined;
      }
      return null;
    });
    mockFetch.mockRejectedValue(new Error('Network error'));

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
    mockUseQuery.mockImplementation((query) => {
      const functionName = getFunctionName(
        query as Parameters<typeof getFunctionName>[0]
      );

      if (functionName === 'rooms:getRoomState') {
        return {
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
            },
          ],
          isHost: true,
        };
      }

      return null;
    });

    renderRoomPage();

    expect(await screen.findByText(/Room AB CD/i)).toBeInTheDocument();
    expect(screen.getByText(/need 1 more player/i)).toBeInTheDocument();
    expect(screen.getByText(/share AB CD to start/i)).toBeInTheDocument();
  });

  it('routes in-progress rooms through the writing phase with shared chrome enabled', async () => {
    mockUseQuery.mockImplementation((query) => {
      const functionName = getFunctionName(
        query as Parameters<typeof getFunctionName>[0]
      );

      if (functionName === 'rooms:getRoomState') {
        return {
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
        };
      }

      return null;
    });

    renderRoomPage();

    expect(
      await screen.findByText(/Writing view ABCD chrome on/i)
    ).toBeInTheDocument();
  });

  it('keeps a writing query failure inside the room panel fallback', async () => {
    mockPhaseFailure.writing = true;
    mockUseQuery.mockImplementation((query) => {
      const functionName = getFunctionName(
        query as Parameters<typeof getFunctionName>[0]
      );

      if (functionName === 'rooms:getRoomState') {
        return {
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
        };
      }

      return null;
    });

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
    mockPhaseFailure.writing = true;
    mockUseQuery.mockImplementation((query) => {
      const functionName = getFunctionName(
        query as Parameters<typeof getFunctionName>[0]
      );

      if (functionName === 'rooms:getRoomState') {
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

      return null;
    });

    const { rerender } = renderRoomPage();
    expect(
      await screen.findByText(/this room panel needs a refresh/i)
    ).toBeInTheDocument();

    status = 'COMPLETED';
    rerender(
      <ThemeProvider>
        <RoomPage params={Promise.resolve({ code: 'ABCD' })} />
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
    mockUseQuery.mockImplementation((query) => {
      const functionName = getFunctionName(
        query as Parameters<typeof getFunctionName>[0]
      );

      if (functionName === 'rooms:getRoomState') {
        return {
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
        };
      }

      return null;
    });

    renderRoomPage();

    expect(
      await screen.findByText(/Reveal view ABCD chrome on/i)
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
      mockWritingView.value = name === 'waiting' ? 'waiting' : 'writing';
      mockUseQuery.mockImplementation((query) => {
        const functionName = getFunctionName(
          query as Parameters<typeof getFunctionName>[0]
        );
        if (functionName === 'rooms:getRoomState') {
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
        return null;
      });
      const view = renderRoomPage();
      expect(await screen.findByText(phaseCopy)).toBeInTheDocument();
      mockConnectionState.mockReturnValue({
        hasInflightRequests: true,
        isWebSocketConnected: false,
        timeOfOldestInflightRequest: Date.now(),
        hasEverConnected: true,
        connectionCount: 1,
        connectionRetries: 1,
        inflightMutations: 0,
        inflightActions: 0,
      });
      act(() => window.dispatchEvent(new Event('offline')));
      view.rerender(
        <ThemeProvider>
          <RoomPage params={Promise.resolve({ code: 'ABCD' })} />
        </ThemeProvider>
      );
      expect(screen.getByText(phaseCopy)).toBeInTheDocument();
      expect(screen.getByText(/you are offline/i)).toBeInTheDocument();
      mockConnectionState.mockReturnValue({
        hasInflightRequests: false,
        isWebSocketConnected: true,
        timeOfOldestInflightRequest: null,
        hasEverConnected: true,
        connectionCount: 2,
        connectionRetries: 0,
        inflightMutations: 0,
        inflightActions: 0,
      });
      act(() => window.dispatchEvent(new Event('online')));
      view.rerender(
        <ThemeProvider>
          <RoomPage params={Promise.resolve({ code: 'ABCD' })} />
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
