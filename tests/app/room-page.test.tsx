// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { getFunctionName } from 'convex/server';

const mockReactUse = vi.fn();
const mockUseClerkUser = vi.fn();
const mockUseQuery = vi.fn();
const mockPush = vi.fn();

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
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: false }),
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
  }) => (
    <div>
      Writing view {roomCode} {showChrome ? 'chrome on' : 'chrome off'}
    </div>
  ),
}));

vi.mock('@/components/RevealPhase', () => ({
  RevealPhase: ({
    roomCode,
    showChrome,
  }: {
    roomCode: string;
    showChrome?: boolean;
  }) => (
    <div>
      Reveal view {roomCode} {showChrome ? 'chrome on' : 'chrome off'}
    </div>
  ),
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
    expect(screen.getByText(/room open/i)).toBeInTheDocument();
    expect(
      screen.getByText(/share AB CD and gather 1 more poet/i)
    ).toBeInTheDocument();
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
});
