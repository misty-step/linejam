// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '@/app/page';
import {
  JoinPage,
  type JoinPageDependencies,
  type JoinRoom,
} from '@/app/join/JoinPage';

const searchParams = new URLSearchParams('code=ABCD');
const mockJoinRoom = vi.fn<JoinRoom>().mockResolvedValue({ _id: 'room-1' });

const joinDependencies: JoinPageDependencies = {
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => searchParams,
  useUser: () => ({
    guestToken: 'guest-token',
    isLoading: false,
    authError: null,
    retryAuth: vi.fn(),
  }),
  useJoinRoom: () => mockJoinRoom,
};

describe('onboarding copy', () => {
  it('sets the party-loop expectation on the landing page', () => {
    render(<Home />);

    expect(
      screen.getByText(
        /pass the phone around a room-code game, then read the surprise poems aloud/i
      )
    ).toBeInTheDocument();
  });

  it('sets the party-loop expectation before a cold-linked friend enters a name', async () => {
    render(<JoinPage dependencies={joinDependencies} />);

    expect(
      await screen.findByText(
        /you'll add one hidden line at a time, then everyone reads the finished poems together/i
      )
    ).toBeInTheDocument();
  });
});
