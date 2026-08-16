// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

import { LobbyJoinQr, LobbyStage } from '@/components/stage/LobbyStage';
import { Doc, Id } from '@/convex/_generated/dataModel';

describe('LobbyStage', () => {
  // SAFETY: Synthetic room document fixture for LobbyStage tests.
  const room: Doc<'rooms'> = {
    // SAFETY: Synthetic Convex room ID for test fixture.
    _id: 'room_123' as Id<'rooms'>,
    _creationTime: Date.now(),
    createdAt: Date.now(),
    code: 'ABCD',
    // SAFETY: Synthetic Convex user ID for test fixture.
    hostUserId: 'user_host' as Id<'users'>,
    status: 'LOBBY',
  };

  const hostPlayer = {
    // SAFETY: Synthetic Convex roomPlayer ID for test fixture.
    _id: 'player_1' as Id<'roomPlayers'>,
    _creationTime: Date.now(),
    // SAFETY: Synthetic Convex room ID for test fixture.
    roomId: 'room_123' as Id<'rooms'>,
    // SAFETY: Synthetic Convex user ID for test fixture.
    userId: 'user_host' as Id<'users'>,
    displayName: 'Host Player',
    joinedAt: Date.now(),
    stableId: 'stable_host_123',
  };

  const latePlayer = {
    // SAFETY: Synthetic Convex roomPlayer ID for test fixture.
    _id: 'player_2' as Id<'roomPlayers'>,
    _creationTime: Date.now(),
    // SAFETY: Synthetic Convex room ID for test fixture.
    roomId: 'room_123' as Id<'rooms'>,
    // SAFETY: Synthetic Convex user ID for test fixture.
    userId: 'user_late' as Id<'users'>,
    displayName: 'Late Poet',
    joinedAt: Date.now(),
    stableId: 'stable_late_456',
  };
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the join QR and direct link without entering presentation mode', () => {
    render(<LobbyJoinQr room={room} />);

    expect(screen.getByTestId('lobby-join-qr')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'QR code for joining room AB CD' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open join link' })
    ).toHaveAttribute('href', expect.stringContaining('/join?code=ABCD'));
  });

  it('pins exit beside the stage heading instead of wrapping below scaled copy', () => {
    render(<LobbyStage room={room} players={[hostPlayer]} onExit={vi.fn()} />);

    const exit = screen.getByRole('button', { name: 'Exit presentation' });
    expect(exit.closest('header')).toHaveClass(
      'grid',
      'grid-cols-[minmax(0,1fr)_auto]'
    );
    expect(exit.closest('header')).not.toHaveClass('flex-wrap');
  });

  it('clears the just-joined badge after the join moment completes', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <LobbyStage room={room} players={[hostPlayer]} onExit={vi.fn()} />
    );

    rerender(
      <LobbyStage
        room={room}
        players={[hostPlayer, latePlayer]}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText(/Just joined/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(screen.queryByText(/Just joined/i)).not.toBeInTheDocument();
  });

  it('renders away player state on the stage roster', () => {
    render(
      <LobbyStage
        room={room}
        players={[
          hostPlayer,
          {
            ...latePlayer,
            isAway: true,
          },
        ]}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText(/Away/i)).toBeInTheDocument();
  });
});
