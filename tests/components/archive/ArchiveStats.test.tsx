// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ArchiveStats,
  ArchiveStatsSkeleton,
} from '@/components/archive/ArchiveStats';

describe('ArchiveStats component', () => {
  const mockStats = {
    totalPoems: 42,
    totalFavorites: 7,
    uniqueCollaborators: 15,
    totalLinesWritten: 189,
  };

  describe('rendering', () => {
    it('renders with accessible region role', () => {
      render(<ArchiveStats stats={mockStats} />);
      const region = screen.getByRole('region', {
        name: /archive statistics/i,
      });
      expect(region).toBeInTheDocument();
    });

    it('displays all stat values correctly', () => {
      render(<ArchiveStats stats={mockStats} />);
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('189')).toBeInTheDocument();
    });
  });

  describe('pluralization', () => {
    it('uses singular "poem" for 1 poem', () => {
      render(<ArchiveStats stats={{ ...mockStats, totalPoems: 1 }} />);
      expect(screen.getByText('poem')).toBeInTheDocument();
    });

    it('uses plural "poems" for multiple poems', () => {
      render(<ArchiveStats stats={{ ...mockStats, totalPoems: 5 }} />);
      expect(screen.getByText('poems')).toBeInTheDocument();
    });

    it('uses plural "poems" for 0 poems', () => {
      render(<ArchiveStats stats={{ ...mockStats, totalPoems: 0 }} />);
      expect(screen.getByText('poems')).toBeInTheDocument();
    });

    it('uses singular "favorite" for 1 favorite', () => {
      render(<ArchiveStats stats={{ ...mockStats, totalFavorites: 1 }} />);
      expect(screen.getByText('favorite')).toBeInTheDocument();
    });

    it('uses plural "favorites" for multiple favorites', () => {
      render(<ArchiveStats stats={{ ...mockStats, totalFavorites: 3 }} />);
      expect(screen.getByText('favorites')).toBeInTheDocument();
    });

    it('uses singular "collaborator" for 1 collaborator', () => {
      render(<ArchiveStats stats={{ ...mockStats, uniqueCollaborators: 1 }} />);
      expect(screen.getByText('collaborator')).toBeInTheDocument();
    });

    it('uses plural "collaborators" for multiple collaborators', () => {
      render(
        <ArchiveStats stats={{ ...mockStats, uniqueCollaborators: 10 }} />
      );
      expect(screen.getByText('collaborators')).toBeInTheDocument();
    });

    it('uses singular "line written" for 1 line', () => {
      render(<ArchiveStats stats={{ ...mockStats, totalLinesWritten: 1 }} />);
      expect(screen.getByText('line written')).toBeInTheDocument();
    });

    it('uses plural "lines written" for multiple lines', () => {
      render(<ArchiveStats stats={{ ...mockStats, totalLinesWritten: 99 }} />);
      expect(screen.getByText('lines written')).toBeInTheDocument();
    });
  });

  describe('number formatting', () => {
    it('formats large numbers with locale separators', () => {
      render(
        <ArchiveStats
          stats={{
            totalPoems: 1234,
            totalFavorites: 567,
            uniqueCollaborators: 890,
            totalLinesWritten: 12345,
          }}
        />
      );
      // Numbers should be formatted (e.g., 1,234 in en-US)
      expect(screen.getByText('1,234')).toBeInTheDocument();
      expect(screen.getByText('12,345')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('applies custom className', () => {
      render(<ArchiveStats stats={mockStats} className="my-stats-class" />);
      const region = screen.getByRole('region');
      expect(region).toHaveClass('my-stats-class');
    });

    it('applies accent styling to poems stat', () => {
      render(<ArchiveStats stats={mockStats} />);
      // The poems line should have accent color
      const poemsText = screen.getByText('42');
      const statLine = poemsText.parentElement;
      expect(statLine).toHaveClass('text-[var(--color-primary)]');
    });

    it('applies muted styling to other stats', () => {
      render(<ArchiveStats stats={mockStats} />);
      // Favorites should have muted color
      const favoritesText = screen.getByText('7');
      const statLine = favoritesText.parentElement;
      expect(statLine).toHaveClass('text-[var(--color-text-muted)]');
    });
  });
});

describe('ArchiveStatsSkeleton component', () => {
  it('renders skeleton placeholder lines', () => {
    const { container } = render(<ArchiveStatsSkeleton />);
    // Should have 4 skeleton lines
    const skeletonLines = container.querySelectorAll(
      '.flex.items-center.gap-2'
    );
    expect(skeletonLines).toHaveLength(4);
  });

  it('applies pulse animation', () => {
    const { container } = render(<ArchiveStatsSkeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });
});
