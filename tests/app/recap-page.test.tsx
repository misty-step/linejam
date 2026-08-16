// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  createRecapPage,
  type RecapPageDependencies,
  type RecapPageHandler,
} from '@/app/recap/[code]/RecapPage';

const mockFetchQuery = vi.fn();

const baseRecap = {
  roomCode: 'WFLM',
  cycle: 1,
  poemCount: 1,
  playerCount: 4,
  roomIdHash: 'room-hash',
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
        { text: 'Rain', authorName: 'Emily' },
        { text: 'on rooftops', authorName: 'Wendell' },
      ],
    },
  ],
};

describe('/recap/[code] page', () => {
  let RecapPage: RecapPageHandler;

  beforeEach(() => {
    mockFetchQuery.mockReset();
    const dependencies: RecapPageDependencies = {
      fetchSessionRecap: (roomCode) => mockFetchQuery(roomCode),
    };
    RecapPage = createRecapPage(dependencies);
  });

  it('attributes every human author once', async () => {
    mockFetchQuery.mockResolvedValue(baseRecap);

    const element = await RecapPage({
      params: Promise.resolve({ code: 'WFLM' }),
    });
    render(element);

    // Whole-poem line text still renders.
    expect(screen.getByText('Rain')).toBeInTheDocument();
    expect(screen.getByText('on rooftops')).toBeInTheDocument();

    // Aggregate attribution names both authors.
    expect(screen.getByText('Emily, Wendell')).toBeInTheDocument();
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
