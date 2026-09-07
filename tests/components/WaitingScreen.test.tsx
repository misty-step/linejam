// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import {
  WaitingScreen,
  type WaitingScreenDependencies,
} from '@/components/WaitingScreen';

const progressQuery = vi.fn();
const endGame = vi.fn();
const dependencies: WaitingScreenDependencies = {
  useRoomQueryArgs: (roomCode, token) => ({
    guestToken: token ?? 'guest-token',
    shouldSkip: false,
    queryArgs: { roomCode, guestToken: token ?? 'guest-token' },
  }),
  useRoundProgress: () => progressQuery(),
  useEndGame: () => endGame,
};
const players = [
  {
    userId: 'alice',
    stableId: 'alice',
    displayName: 'Alice',
    avatarId: 'pip' as const,
    submitted: true,
  },
  {
    userId: 'bob',
    stableId: 'bob',
    displayName: 'Bob',
    avatarId: 'moss' as const,
    submitted: false,
  },
];
const progress = { round: 3, totalRounds: 9, isHost: false, players };

function renderWaiting(
  props: Partial<React.ComponentProps<typeof WaitingScreen>> = {}
) {
  return render(
    <WaitingScreen roomCode="ABCD" dependencies={dependencies} {...props} />
  );
}

describe('WaitingScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    progressQuery.mockReturnValue(progress);
    endGame.mockResolvedValue({ abandoned: true });
  });

  it('distinguishes submitted, writing and away players by name without relying on color', () => {
    progressQuery.mockReturnValue({
      ...progress,
      players: [
        ...players,
        {
          userId: 'cy',
          stableId: 'cy',
          displayName: 'Cy',
          submitted: false,
          isAway: true,
        },
      ],
    });
    renderWaiting();
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('Alice')).toBeInTheDocument();
    expect(within(items[0]).getByText('Submitted')).toBeInTheDocument();
    expect(within(items[1]).getByText('Bob')).toBeInTheDocument();
    expect(within(items[1]).getByText('Writing')).toBeInTheDocument();
    expect(within(items[2]).getByText('Cy')).toBeInTheDocument();
    expect(within(items[2]).getByText('Away')).toBeInTheDocument();
  });

  it('uses supplied progress instead of an older subscription result', () => {
    progressQuery.mockReturnValue(undefined);
    renderWaiting({ progressOverride: progress });
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(
      document.querySelector('[aria-busy="true"]')
    ).not.toBeInTheDocument();
  });

  it('does not show an obsolete roster while current progress is unavailable', () => {
    const { rerender } = renderWaiting({ progressOverride: null });

    expect(screen.getByRole('status', { busy: true })).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /your line is in/i })
    ).not.toBeInTheDocument();

    rerender(
      <WaitingScreen
        roomCode="ABCD"
        dependencies={dependencies}
        progressOverride={{
          ...progress,
          players: [
            {
              ...players[0],
              userId: 'cy',
              stableId: 'cy',
              displayName: 'Cy',
            },
          ],
        }}
      />
    );

    expect(
      screen.getByRole('list', { name: 'Players this round' })
    ).toHaveTextContent('Cy');
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('status', { busy: true })
    ).not.toBeInTheDocument();
  });

  it('gives a late joiner round context without claiming they submitted a line', () => {
    progressQuery.mockReturnValue({
      ...progress,
      players: [
        ...players,
        {
          userId: 'late',
          stableId: 'late',
          displayName: 'Late poet',
          submitted: false,
          isSpectator: true,
        },
      ],
    });
    renderWaiting({ isLateJoiner: true });

    expect(
      screen.getByRole('heading', { name: /next game/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Round 4 of 9')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /your line is in/i })
    ).not.toBeInTheDocument();
  });

  it('does not treat a late spectator as an unfinished writer', () => {
    progressQuery.mockReturnValue({
      ...progress,
      isHost: true,
      players: [
        ...players.map((player) => ({ ...player, submitted: true })),
        {
          userId: 'late',
          stableId: 'late',
          displayName: 'Late player',
          submitted: false,
          isSpectator: true,
        },
      ],
    });
    renderWaiting();
    expect(screen.getByText('Late player')).toBeInTheDocument();
    expect(screen.getByText('Watching')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /next round/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'End game' })
    ).not.toBeInTheDocument();
  });

  it('announces the reveal rather than another round when all final lines arrive', () => {
    progressQuery.mockReturnValue({ round: 8, isHost: true, players });
    const { rerender } = renderWaiting();
    expect(screen.getByText('Round 9 of 9')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End game' })).toBeEnabled();

    progressQuery.mockReturnValue({
      round: 8,
      isHost: true,
      players: players.map((player) => ({ ...player, submitted: true })),
    });
    rerender(<WaitingScreen roomCode="ABCD" dependencies={dependencies} />);

    expect(
      screen.getByRole('heading', { name: /ready to read/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /next round/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'End game' })
    ).not.toBeInTheDocument();
  });

  it('requires explicit host confirmation before ending the game and permits cancellation', async () => {
    const user = userEvent.setup();
    progressQuery.mockReturnValue({ ...progress, isHost: true });
    renderWaiting();
    await user.click(screen.getByRole('button', { name: 'End game' }));
    expect(endGame).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(endGame).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'End game' }));
    await user.click(screen.getByRole('button', { name: 'End game' }));
    await waitFor(() => expect(endGame).toHaveBeenCalledTimes(1));
    expect(endGame).toHaveBeenCalledWith({
      roomCode: 'ABCD',
      guestToken: 'guest-token',
    });
  });

  it('keeps the end-game confirmation recoverable when the server rejects it', async () => {
    const user = userEvent.setup();
    const retryResponse = Promise.withResolvers<{ abandoned: boolean }>();
    endGame
      .mockRejectedValueOnce(new Error('Network error'))
      .mockReturnValueOnce(retryResponse.promise);
    progressQuery.mockReturnValue({ ...progress, isHost: true });
    renderWaiting();
    await user.click(screen.getByRole('button', { name: 'End game' }));
    await user.click(screen.getByRole('button', { name: 'End game' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep playing' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'End game' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'End game' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep playing' })).toBeDisabled();
    const endingButton = screen.getByRole('button', { name: /ending game/i });
    expect(endingButton).toBeDisabled();
    await user.click(endingButton);
    expect(endGame).toHaveBeenCalledTimes(2);
    expect(endGame).toHaveBeenLastCalledWith({
      roomCode: 'ABCD',
      guestToken: 'guest-token',
    });
    retryResponse.resolve({ abandoned: true });
    await retryResponse.promise;
  });

  it('does not offer the destructive host action to another player', () => {
    renderWaiting();
    expect(
      screen.queryByRole('button', { name: 'End game' })
    ).not.toBeInTheDocument();
  });
});
