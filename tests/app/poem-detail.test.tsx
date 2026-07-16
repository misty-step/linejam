// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockApiRefs = vi.hoisted(() => ({
  getPoemDetail: {},
  getPublicPoemFull: {},
  isFavorited: {},
  toggleFavorite: {},
}));
const mockPoemDisplay = vi.hoisted(() => vi.fn());

vi.mock('@/convex/_generated/api', () => ({
  api: {
    poems: {
      getPoemDetail: mockApiRefs.getPoemDetail,
      getPublicPoemFull: mockApiRefs.getPublicPoemFull,
    },
    favorites: {
      isFavorited: mockApiRefs.isFavorited,
      toggleFavorite: mockApiRefs.toggleFavorite,
    },
  },
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('@/components/PoemDisplay', () => ({
  PoemDisplay: (
    props: Record<string, unknown> & { metadata: { backLabel: string } }
  ) => {
    mockPoemDisplay(props);
    return (
      <section data-testid="poem-display">{props.metadata.backLabel}</section>
    );
  },
}));

const mockQueryResults = {
  poemDetail: undefined as unknown,
  publicPoem: undefined as unknown,
  isFavorited: undefined as unknown,
};
const mockToggleFavorite = vi.fn();
let mockGuestToken: string | null = null;

vi.mock('convex/react', () => ({
  useMutation: () => mockToggleFavorite,
  useQuery: (queryRef: unknown) => {
    if (queryRef === mockApiRefs.getPoemDetail) {
      return mockQueryResults.poemDetail;
    }
    if (queryRef === mockApiRefs.getPublicPoemFull) {
      return mockQueryResults.publicPoem;
    }
    if (queryRef === mockApiRefs.isFavorited) {
      return mockQueryResults.isFavorited;
    }
    throw new Error('Unexpected query reference');
  },
}));

vi.mock('@/lib/auth', () => ({
  useUser: () => ({ guestToken: mockGuestToken }),
}));

import { PoemDetail } from '@/app/poem/[id]/PoemDetail';
import type { Id } from '@/convex/_generated/dataModel';

describe('PoemDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResults.poemDetail = undefined;
    mockQueryResults.publicPoem = undefined;
    mockQueryResults.isFavorited = undefined;
    mockGuestToken = null;
  });

  it('shows loading while poem queries are unresolved', () => {
    render(<PoemDetail poemId={'poem1' as Id<'poems'>} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows not found when both participant and public queries return null', () => {
    mockQueryResults.poemDetail = null;
    mockQueryResults.publicPoem = null;

    render(<PoemDetail poemId={'poem1' as Id<'poems'>} />);

    expect(screen.getByText('Poem not found')).toBeInTheDocument();
    expect(
      screen.getByText(/Shared poem links only work/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Return to Linejam/i })
    ).toHaveAttribute('href', '/');
  });

  it('renders participant poem details with archive metadata', async () => {
    mockGuestToken = 'guest-token';
    mockQueryResults.poemDetail = {
      poem: { createdAt: 1234 },
      lines: [
        {
          text: 'first line',
          authorName: 'Ada',
          authorKey: 'user-ada',
          isBot: false,
        },
        {
          text: 'second line',
          authorName: 'Bot',
          authorKey: null,
          isBot: true,
        },
      ],
    };
    mockQueryResults.publicPoem = null;
    mockQueryResults.isFavorited = true;

    render(<PoemDetail poemId={'poem1' as Id<'poems'>} />);

    expect(screen.getByTestId('poem-display')).toHaveTextContent('Archive');
    expect(mockPoemDisplay).toHaveBeenCalledWith(
      expect.objectContaining({
        poemId: 'poem1',
        guestToken: 'guest-token',
        alreadyRevealed: true,
        allStableIds: ['user-ada'],
        lines: [
          {
            text: 'first line',
            authorName: 'Ada',
            authorStableId: 'user-ada',
            isBot: false,
          },
          {
            text: 'second line',
            authorName: 'Bot',
            authorStableId: null,
            isBot: true,
          },
        ],
        metadata: expect.objectContaining({
          backHref: '/me/poems',
          backLabel: '← Archive',
          createdAt: 1234,
          firstLine: 'first line',
          isFavorited: true,
          isParticipant: true,
          uniquePoets: 2,
        }),
      })
    );

    await mockPoemDisplay.mock.calls[0][0].metadata.onToggleFavorite();

    expect(mockToggleFavorite).toHaveBeenCalledWith({
      poemId: 'poem1',
      guestToken: 'guest-token',
    });
  });

  it('renders public poem fallback with Linejam metadata', () => {
    mockQueryResults.poemDetail = null;
    mockQueryResults.publicPoem = {
      poem: { createdAt: 5678 },
      lines: [
        {
          text: 'public first line',
          authorName: 'Ada',
          authorKey: 'public-ada',
          isBot: false,
        },
      ],
    };

    render(<PoemDetail poemId={'poem2' as Id<'poems'>} />);

    expect(screen.getByTestId('poem-display')).toHaveTextContent('Linejam');
    expect(mockPoemDisplay).toHaveBeenCalledWith(
      expect.objectContaining({
        poemId: 'poem2',
        guestToken: undefined,
        allStableIds: ['public-ada'],
        metadata: expect.objectContaining({
          backHref: '/',
          backLabel: '← Linejam',
          firstLine: 'public first line',
          isFavorited: false,
          isParticipant: false,
          uniquePoets: 1,
        }),
      })
    );
  });

  it('renders participant poem metadata without a guest token or lines', async () => {
    mockQueryResults.poemDetail = {
      poem: { createdAt: 9012 },
      lines: [],
    };
    mockQueryResults.publicPoem = null;

    render(<PoemDetail poemId={'poem3' as Id<'poems'>} />);

    expect(mockPoemDisplay).toHaveBeenCalledWith(
      expect.objectContaining({
        guestToken: undefined,
        allStableIds: [],
        lines: [],
        metadata: expect.objectContaining({
          firstLine: '',
          isFavorited: false,
          isParticipant: true,
        }),
      })
    );

    await mockPoemDisplay.mock.calls[0][0].metadata.onToggleFavorite();

    expect(mockToggleFavorite).toHaveBeenCalledWith({
      poemId: 'poem3',
      guestToken: undefined,
    });
  });
});
