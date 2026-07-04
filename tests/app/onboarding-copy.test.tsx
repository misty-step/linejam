// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseSearchParams = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn().mockResolvedValue(undefined),
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: false }),
}));

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: null, isLoaded: true }),
}));

import Home from '@/app/page';
import JoinPage from '@/app/join/page';

describe('onboarding copy', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams('code=ABCD'));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ guestId: 'guest-123', token: 'guest-token' }),
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sets the party-loop expectation on the landing page', () => {
    render(<Home />);

    expect(
      screen.getByText(
        /pass the phone around a room-code game, then read the surprise poems aloud/i
      )
    ).toBeInTheDocument();
  });

  it('sets the party-loop expectation before a cold-linked friend enters a name', async () => {
    render(<JoinPage />);

    expect(
      await screen.findByText(
        /you'll add one hidden line at a time, then everyone reads the finished poems together/i
      )
    ).toBeInTheDocument();
  });
});
