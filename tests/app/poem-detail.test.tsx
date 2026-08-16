// @vitest-environment happy-dom
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import {
  PoemDetail,
  type DisablePublicShare,
  type MutateFavorite,
  type PoemDetailData,
  type PoemDetailDependencies,
  type PoemShareStatus,
} from '@/app/poem/[id]/PoemDetail';
import type { PoemDisplayProps } from '@/components/PoemDisplay';
import type { Id } from '@/convex/_generated/dataModel';
interface MockQueryResults {
  poemDetail: PoemDetailData | null | undefined;
  publicPoem: PoemDetailData | null | undefined;
  isFavorited: boolean | undefined;
  shareStatus: PoemShareStatus | null | undefined;
}

const mockQueryResults: MockQueryResults = {
  poemDetail: undefined,
  publicPoem: undefined,
  isFavorited: undefined,
  shareStatus: undefined,
};

const mockToggleFavorite = vi.fn<MutateFavorite>();
const mockDisablePublicShare = vi.fn<DisablePublicShare>();
const mockPoemDisplay = vi.fn<(props: PoemDisplayProps) => void>();
let guestToken: string | undefined;

function TestPoemDisplay(props: PoemDisplayProps) {
  mockPoemDisplay(props);
  return (
    <section data-testid="poem-display">{props.metadata?.backLabel}</section>
  );
}

const dependencies: PoemDetailDependencies = {
  useGuestToken: () => guestToken,
  usePoemDetail: () => mockQueryResults.poemDetail,
  usePublicPoem: () => mockQueryResults.publicPoem,
  useShareStatus: () => mockQueryResults.shareStatus,
  useIsFavorited: () => mockQueryResults.isFavorited,
  useToggleFavorite: () => mockToggleFavorite,
  useDisablePublicShare: () => mockDisablePublicShare,
  PoemDisplayComponent: TestPoemDisplay,
};

function TestPoemDetail({
  poemId,
  shareSlug,
}: {
  poemId: Id<'poems'>;
  shareSlug?: string;
}) {
  return (
    <PoemDetail
      poemId={poemId}
      shareSlug={shareSlug}
      dependencies={dependencies}
    />
  );
}

function renderPoemDetail(ui: ReactElement) {
  return render(ui);
}

describe('PoemDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResults.poemDetail = undefined;
    mockQueryResults.publicPoem = undefined;
    mockQueryResults.isFavorited = undefined;
    mockQueryResults.shareStatus = undefined;
    mockToggleFavorite.mockResolvedValue(undefined);
    mockDisablePublicShare.mockResolvedValue(undefined);
    guestToken = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows loading while poem queries are unresolved', () => {
    // SAFETY: Synthetic Convex document id fixture for poem detail tests.
    renderPoemDetail(<TestPoemDetail poemId={'poem1' as Id<'poems'>} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows a bounded pending state for an inactive share slug', () => {
    mockQueryResults.poemDetail = null;
    mockQueryResults.publicPoem = null;
    mockQueryResults.shareStatus = {
      state: 'pending',
      expiresAt: Date.now() + 1000,
    };
    // SAFETY: Synthetic Convex document id fixture for poem detail tests.
    renderPoemDetail(
      <TestPoemDetail poemId={'poem1' as Id<'poems'>} shareSlug="slug-1" />
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Preparing this shared poem'
    );
  });

  it('resets pending expiry when a new share slug arrives', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    mockQueryResults.poemDetail = null;
    mockQueryResults.publicPoem = null;
    mockQueryResults.shareStatus = { state: 'pending', expiresAt: 1000 };

    const view = renderPoemDetail(
      // SAFETY: Synthetic Convex document id fixture for poem detail tests.
      <TestPoemDetail poemId={'poem1' as Id<'poems'>} shareSlug="slug-1" />
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Preparing this shared poem'
    );

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Poem not found')).toBeInTheDocument();

    mockQueryResults.shareStatus = { state: 'pending', expiresAt: 2000 };
    // SAFETY: Synthetic Convex document id fixture for poem detail tests.
    const pendingPoemId = 'poem1' as Id<'poems'>;
    view.rerender(<TestPoemDetail poemId={pendingPoemId} shareSlug="slug-2" />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Preparing this shared poem'
    );
  });

  it('shows not found when both participant and public queries return null', () => {
    mockQueryResults.poemDetail = null;
    mockQueryResults.publicPoem = null;

    // SAFETY: Synthetic Convex document id fixture for poem detail tests.
    renderPoemDetail(<TestPoemDetail poemId={'poem1' as Id<'poems'>} />);

    expect(screen.getByText('Poem not found')).toBeInTheDocument();
    expect(
      screen.getByText(/Shared poem links only work/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Return to Linejam/i })
    ).toHaveAttribute('href', '/');
  });

  it('renders participant poem details with archive metadata', async () => {
    guestToken = 'guest-token';
    mockQueryResults.poemDetail = {
      poem: { createdAt: 1234 },
      lines: [
        {
          text: 'first line',
          authorName: 'Ada',
          authorKey: 'user-ada',
        },
        {
          text: 'second line',
          authorName: 'Lin',
          authorKey: 'user-lin',
        },
      ],
    };
    mockQueryResults.publicPoem = null;
    mockQueryResults.isFavorited = true;

    // SAFETY: Synthetic Convex document id fixture for poem detail tests.
    renderPoemDetail(<TestPoemDetail poemId={'poem1' as Id<'poems'>} />);

    expect(screen.getByTestId('poem-display')).toHaveTextContent('Archive');
    expect(mockPoemDisplay).toHaveBeenCalledWith(
      expect.objectContaining({
        poemId: 'poem1',
        guestToken: 'guest-token',
        alreadyRevealed: true,
        allStableIds: ['user-ada', 'user-lin'],
        lines: [
          {
            text: 'first line',
            authorName: 'Ada',
            authorStableId: 'user-ada',
          },
          {
            text: 'second line',
            authorName: 'Lin',
            authorStableId: 'user-lin',
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

    await mockPoemDisplay.mock.calls[0][0].metadata?.onToggleFavorite?.();

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
        },
      ],
    };

    // SAFETY: Synthetic Convex document id fixture for poem detail tests.
    renderPoemDetail(<TestPoemDetail poemId={'poem2' as Id<'poems'>} />);

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

    // SAFETY: Synthetic Convex document id fixture for poem detail tests.
    renderPoemDetail(<TestPoemDetail poemId={'poem3' as Id<'poems'>} />);

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

    await mockPoemDisplay.mock.calls[0][0].metadata?.onToggleFavorite?.();

    expect(mockToggleFavorite).toHaveBeenCalledWith({
      poemId: 'poem3',
      guestToken: undefined,
    });
  });
});
