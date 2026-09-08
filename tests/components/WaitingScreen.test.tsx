// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import {
  WaitingScreen,
  type WaitingScreenDependencies,
} from '@/components/WaitingScreen';

const progressQuery = vi.fn();
const dependencies: WaitingScreenDependencies = {
  useRoomQueryArgs: (roomCode, token) => ({
    guestToken: token ?? 'guest-token',
    shouldSkip: false,
    queryArgs: { roomCode, guestToken: token ?? 'guest-token' },
  }),
  useRoundProgress: () => progressQuery(),
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
  });

  it('distinguishes submitted, writing and away players by name without relying on color', () => {
    progressQuery.mockReturnValue({
      ...progress,
      players: [
        { ...players[0], isAway: true },
        players[1],
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

  it('uses the current supplied roster instead of an older subscription result', () => {
    renderWaiting({
      progressOverride: {
        ...progress,
        players: [
          {
            userId: 'cy',
            stableId: 'cy',
            displayName: 'Cy',
            submitted: false,
          },
        ],
      },
    });

    expect(
      screen.getByRole('list', { name: 'Players this round' })
    ).toHaveTextContent('Cy');
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('does not show an obsolete roster while current progress is unavailable', () => {
    const { rerender } = renderWaiting({ progressOverride: null });

    expect(screen.getByRole('status', { busy: true })).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();

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
  });

  it('does not announce round completion when no writers are known', () => {
    renderWaiting({
      progressOverride: { ...progress, round: 8, players: [] },
    });

    expect(screen.getByText('Round 9 of 9')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /next round|ready to read/i })
    ).not.toBeInTheDocument();
  });

  it('announces the reveal rather than another round when all final lines arrive', () => {
    progressQuery.mockReturnValue({
      ...progress,
      round: 4,
      totalRounds: 5,
    });
    const { rerender } = renderWaiting();
    expect(screen.getByText('Round 5 of 5')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /ready to read/i })
    ).not.toBeInTheDocument();

    progressQuery.mockReturnValue({
      round: 4,
      totalRounds: 5,
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
  });

  it('keeps destructive room controls out of the waiting pause, including for the host', () => {
    progressQuery.mockReturnValue({ ...progress, isHost: true });
    renderWaiting();

    expect(
      screen.getByRole('list', { name: 'Players this round' })
    ).toHaveTextContent('Alice');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
