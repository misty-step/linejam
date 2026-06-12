// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockApiRefs = vi.hoisted(() => ({
  getPoemDetail: {},
  getPublicPoemFull: {},
  isFavorited: {},
  toggleFavorite: {},
}));

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

const mockQueryResults = {
  poemDetail: undefined as unknown,
  publicPoem: undefined as unknown,
  isFavorited: undefined as unknown,
};
const mockToggleFavorite = vi.fn();

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
  useUser: () => ({ guestToken: null }),
}));

import { PoemDetail } from '@/app/poem/[id]/PoemDetail';
import type { Id } from '@/convex/_generated/dataModel';

describe('PoemDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResults.poemDetail = undefined;
    mockQueryResults.publicPoem = undefined;
    mockQueryResults.isFavorited = undefined;
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
});
