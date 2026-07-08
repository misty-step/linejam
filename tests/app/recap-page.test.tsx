// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockFetchQuery = vi.fn();
vi.mock('convex/nextjs', () => ({
  fetchQuery: (...args: unknown[]) => mockFetchQuery(...args),
}));

vi.mock('@/convex/_generated/api', () => ({
  api: { poems: { getPublicSessionRecap: {} } },
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/app/recap/[code]/metadata', () => ({
  generateMetadata: vi.fn(),
}));

import RecapPage from '@/app/recap/[code]/page';

const baseRecap = {
  roomCode: 'WFLM',
  cycle: 1,
  poemCount: 1,
  playerCount: 4,
  poems: [
    {
      _id: 'poem_1',
      indexInRoom: 0,
      createdAt: Date.now(),
      preview: 'Rain',
      readerName: 'Marcus',
      starterName: 'Emily',
      poetCount: 4,
      lines: [
        { text: 'Rain', authorName: 'Emily', isBot: false },
        { text: 'on rooftops', authorName: 'Wendell', isBot: true },
      ],
    },
  ],
};

describe('/recap/[code] page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attributes every author and marks the AI author, per line', async () => {
    mockFetchQuery.mockResolvedValue(baseRecap);

    const element = await RecapPage({
      params: Promise.resolve({ code: 'WFLM' }),
    });
    render(element);

    // Whole-poem line text still renders.
    expect(screen.getByText('Rain')).toBeInTheDocument();
    expect(screen.getByText('on rooftops')).toBeInTheDocument();

    // Aggregate attribution names both authors and tags the AI one.
    expect(screen.getByText('Emily, Wendell (AI)')).toBeInTheDocument();
  });

  it('offers a print-hidden export action and print-hidden nav CTAs', async () => {
    mockFetchQuery.mockResolvedValue(baseRecap);

    const element = await RecapPage({
      params: Promise.resolve({ code: 'WFLM' }),
    });
    render(element);

    expect(screen.getByRole('button', { name: /Export as PDF/i })).toHaveClass(
      'print:hidden'
    );
    expect(
      screen.getByRole('link', { name: 'Join this room' }).closest('footer')
    ).toHaveClass('print:hidden');
  });

  it('renders each poem inside a break-avoiding print surface', async () => {
    mockFetchQuery.mockResolvedValue(baseRecap);

    const element = await RecapPage({
      params: Promise.resolve({ code: 'WFLM' }),
    });
    render(element);

    expect(screen.getByText('Rain').closest('article')).toHaveClass(
      'poem-print-surface'
    );
  });
});
