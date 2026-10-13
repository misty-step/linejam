// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArchiveStats } from '@/components/archive/ArchiveStats';

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
});
