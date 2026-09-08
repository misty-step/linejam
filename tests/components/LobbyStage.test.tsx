// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

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

  it('updates the displayed roster as players join and leave', () => {
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

    expect(screen.getByText('Late Poet')).toBeInTheDocument();

    rerender(
      <LobbyStage room={room} players={[latePlayer]} onExit={vi.fn()} />
    );

    expect(screen.queryByText('Host Player')).not.toBeInTheDocument();
    expect(screen.getByText('Late Poet')).toBeInTheDocument();
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

    const awayPlayer = screen.getByText('Late Poet').closest('li');
    const hostPlayerItem = screen.getByText('Host Player').closest('li');
    expect(within(awayPlayer!).getByText('Away')).toBeInTheDocument();
    expect(within(hostPlayerItem!).queryByText('Away')).not.toBeInTheDocument();
  });
});
