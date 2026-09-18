// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render as rtlRender,
  screen,
  act,
  fireEvent,
  within,
} from '@testing-library/react';
import { ConvexProvider } from 'convex/react';
import { createTestConvexClient } from '@/tests/helpers/convexClient';

import type { UseSharePoemDependencies } from '@/hooks/useSharePoem';

const mockConvexClient = Object.assign(createTestConvexClient(), {
  mutation: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  watchQuery: vi.fn(() => ({
    localQueryResult: () => false,
    onUpdate: () => () => {},
  })),
  connectionState: vi.fn(() => ({
    hasInflightRequests: false,
    isWebSocketConnected: true,
    timeOfOldestInflightRequest: null,
  })),
  setAuth: vi.fn(),
  clearAuth: vi.fn(),
});

function render(
  ui: React.ReactElement,
  options?: Parameters<typeof rtlRender>[1]
) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <ConvexProvider client={mockConvexClient}>{children}</ConvexProvider>
    ),
    ...options,
  });
}

// Mock browser clipboard API (external boundary)
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  configurable: true,
});

const mockPreparePublicPoemShare = vi
  .fn()
  .mockResolvedValue({ slug: 'test-share-slug', nonce: 'test-nonce' });
const mockActivatePublicPoemShare = vi
  .fn()
  .mockResolvedValue({ changed: true });
const mockCancelPublicPoemShare = vi
  .fn()
  .mockResolvedValue({ cancelled: true, publicShareEnabled: false });
const mockDisablePublicPoemShare = vi.fn().mockResolvedValue({
  publicShareEnabled: false,
  changed: true,
  publicShareDisabledAt: 1,
});
const poemShareDependencies: UseSharePoemDependencies = {
  useMutations: () => ({
    prepare: mockPreparePublicPoemShare,
    activate: mockActivatePublicPoemShare,
    cancel: mockCancelPublicPoemShare,
    disable: mockDisablePublicPoemShare,
  }),
  shareClient: { writeClipboardText: mockClipboard.writeText },
  getOrigin: () => 'https://example.com',
  captureError: vi.fn(),
  trackPoemShared: vi.fn(),
  trackArtifactAction: vi.fn(),
  hashRoomId: () => 'test-room-hash',
};

// Import after mocking - these use REAL implementations
import { PoemDisplay, type PoemLine } from '@/components/PoemDisplay';
import type { Id } from '@/convex/_generated/dataModel';
import { installMatchMedia } from '@/tests/helpers/matchMedia';

describe('PoemDisplay component', () => {
  // SAFETY: Synthetic Convex document id fixture for poem display tests.
  const mockPoemId = 'poem_test_123' as Id<'poems'>;
  const mockOnDone = vi.fn();

  const mockLines: PoemLine[] = [
    { text: 'One', authorName: 'Alice', authorStableId: 'stable_alice' },
    { text: 'Two words', authorName: 'Bob', authorStableId: 'stable_bob' },
    {
      text: 'Three simple words',
      authorName: 'Alice',
      authorStableId: 'stable_alice',
    },
    {
      text: 'Four words in line',
      authorName: 'Bob',
      authorStableId: 'stable_bob',
    },
    {
      text: 'Five words make this line',
      authorName: 'Alice',
      authorStableId: 'stable_alice',
    },
    {
      text: 'Four words in poem',
      authorName: 'Bob',
      authorStableId: 'stable_bob',
    },
    {
      text: 'Three words here',
      authorName: 'Alice',
      authorStableId: 'stable_alice',
    },
    { text: 'Two words', authorName: 'Bob', authorStableId: 'stable_bob' },
    { text: 'End', authorName: 'Alice', authorStableId: 'stable_alice' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockClipboard.writeText.mockClear();
    installMatchMedia(false);
    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn(),
      configurable: true,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('whole-poem ceremony', () => {
    it('renders every line and its attribution together on the first reveal paint', () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={false}
        />
      );

      const rows = within(
        screen.getByRole('list', { name: 'Poem lines' })
      ).getAllByRole('listitem');
      expect(rows).toHaveLength(mockLines.length);
      mockLines.forEach((line, index) => {
        expect(within(rows[index]).getByText(line.text)).toBeVisible();
        expect(within(rows[index]).getByText(line.authorName!)).toBeVisible();
      });
    });

    it('makes share, save, and done actions immediately discoverable', () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={false}
        />
      );

      expect(screen.getByRole('button', { name: 'Share poem' })).toBeVisible();
      expect(screen.getByRole('button', { name: /Save image/i })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Done' })).toBeVisible();
    });

    it('focuses the poem heading and announces one concise transition', () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={false}
        />
      );

      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: 'Poem' })
      );
      expect(screen.getByRole('dialog', { name: 'Poem' })).toBeInTheDocument();
      expect(screen.getByRole('status')).not.toHaveTextContent(
        mockLines[4].text
      );
    });
  });

  it('discloses that sharing publishes the poem before the share control', () => {
    render(
      <PoemDisplay
        poemId={mockPoemId}
        lines={mockLines}
        onDone={mockOnDone}
        alreadyRevealed
      />
    );

    expect(
      screen.getByRole('button', { name: 'Share poem' })
    ).toHaveAccessibleDescription(/public to anyone with the link/i);
  });

  describe('actions', () => {
    it('copies URL to clipboard when Share button clicked', async () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={true}
          shareDependencies={poemShareDependencies}
        />
      );

      const shareButton = screen.getByRole('button', { name: /Share/i });
      await act(async () => {
        fireEvent.click(shareButton);
      });

      // Verify clipboard was called with the share URL
      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/poem/poem_test_123')
      );
      expect(mockPreparePublicPoemShare).toHaveBeenCalledOnce();
      expect(mockActivatePublicPoemShare).toHaveBeenCalledOnce();
      expect(screen.getByText('Poem link copied.')).toBeInTheDocument();
    });

    it('calls onDone when Done button clicked', async () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          alreadyRevealed={true}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^Done$/i }));
      });
      expect(mockOnDone).toHaveBeenCalledTimes(1);
    });

    it('does not claim a public link was revoked until the server accepts it', async () => {
      mockDisablePublicPoemShare.mockRejectedValueOnce(
        new Error('Network error')
      );
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
          shareDependencies={poemShareDependencies}
        />
      );

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Revoke public link' })
        );
      });
      expect(screen.getByRole('alert')).toBeVisible();
      expect(
        screen.queryByText('Public poem link revoked.')
      ).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Revoke public link' })
        );
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('Public poem link revoked.')).toBeVisible();
    });

    it('keeps keyboard focus inside the reveal dialog and closes with Escape', () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          onDone={mockOnDone}
        />
      );
      const dialog = screen.getByRole('dialog', { name: 'Poem' });
      const controls = within(dialog).getAllByRole('button');
      const first = controls[0];
      const last = controls[controls.length - 1];

      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(last).toHaveFocus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(first).toHaveFocus();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnDone).toHaveBeenCalledTimes(1);
    });
  });

  describe('archive variant metadata header', () => {
    // Noon UTC keeps the calendar day stable across the local test-runner's
    // timezone, unlike a bare date string parsed at UTC midnight.
    const testCreatedAt = Date.UTC(2026, 0, 15, 12);
    const archiveMetadata = {
      createdAt: testCreatedAt,
      backHref: '/archive',
      backLabel: 'Back to archive',
      isParticipant: true,
      isFavorited: false,
      onToggleFavorite: vi.fn(),
    };

    it('shows the back link and lets a participant toggle the room-favorite heart', () => {
      const onToggleFavorite = vi.fn();
      const { rerender } = render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          variant="archive"
          metadata={{
            ...archiveMetadata,
            onToggleFavorite,
            isFavorited: false,
          }}
        />
      );

      expect(
        screen.getByRole('link', { name: 'Back to archive' })
      ).toHaveAttribute('href', '/archive');

      const heartButton = screen.getByRole('button', {
        name: 'Add to favorites',
      });
      fireEvent.click(heartButton);
      expect(onToggleFavorite).toHaveBeenCalledTimes(1);

      rerender(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          variant="archive"
          metadata={{ ...archiveMetadata, onToggleFavorite, isFavorited: true }}
        />
      );

      expect(
        screen.getByRole('button', { name: 'Remove from favorites' })
      ).toBeInTheDocument();
    });

    it('does not offer favorite controls to a non-participant viewer', () => {
      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={mockLines}
          variant="archive"
          metadata={{
            createdAt: testCreatedAt,
            isParticipant: false,
            onToggleFavorite: vi.fn(),
          }}
        />
      );

      expect(
        screen.queryByRole('button', { name: /favorites/i })
      ).not.toBeInTheDocument();
    });

    it('labels a contributor as Unknown when no author name is recorded', () => {
      const linesWithMysteryAuthor: PoemLine[] = [
        { text: 'A quiet line', authorStableId: 'stable_mystery' },
      ];

      render(
        <PoemDisplay
          poemId={mockPoemId}
          lines={linesWithMysteryAuthor}
          variant="archive"
          metadata={{ createdAt: testCreatedAt }}
        />
      );

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });
});
